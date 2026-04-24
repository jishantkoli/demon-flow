import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import formRoutes from './routes/forms.js';
import submissionRoutes from './routes/submissions.js';
import statsRoutes from './routes/stats.js';
import auditRoutes from './routes/audit.js';
import notificationRoutes from './routes/notifications.js';
import nominationRoutes from './routes/nominations.js';
import reviewRoutes from './routes/reviews.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import uploadRoutes from './routes/uploads.js';



const app = express();
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : true; // Allow all in development
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.json());
app.use(morgan('dev'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 10000 : 300, // Higher in production to avoid shared-proxy false positives
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api', limiter);

// Note: File uploads now served via Cloudinary — no local static folder needed

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/forms', formRoutes);
app.use('/api/v1/submissions', submissionRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/nominations', nominationRoutes);
app.use('/api/v1', reviewRoutes); // Handles /review-levels, /shortlist, /reviews, /review-scores
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/uploads', uploadRoutes);

// Health check
const dbStateLabel = (readyState: number): string => {
  if (readyState === 0) return 'disconnected';
  if (readyState === 1) return 'connected';
  if (readyState === 2) return 'connecting';
  if (readyState === 3) return 'disconnecting';
  return 'unknown';
};

app.get('/health', (req, res) => {
  const readyState = mongoose.connection.readyState;
  const dbConnected = readyState === 1;
  const statusCode = dbConnected ? 200 : 503;

  res.status(statusCode).json({
    status: dbConnected ? 'ok' : 'degraded',
    service: 'flow-agent-backend',
    database: {
      connected: dbConnected,
      state: dbStateLabel(readyState)
    },
    uptimeSeconds: Math.floor(process.uptime())
  });
});

app.get('/api/v1', (req, res) => {
  res.status(200).json({
    service: 'flow-agent-backend',
    version: 'v1',
    status: 'ok',
    health: '/health'
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500 
    ? 'Internal Server Error' 
    : err.message;
    
  console.error(`[\u274C Error] ${status} - ${message}`);
  if (err.stack && process.env.NODE_ENV !== 'production') console.error(err.stack);
  
  res.status(status).json({ error: message });
});

export default app;
