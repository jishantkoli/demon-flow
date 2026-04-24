import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

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
  max: process.env.NODE_ENV === 'development' ? 10000 : 100, // Relaxed for development
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
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

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
