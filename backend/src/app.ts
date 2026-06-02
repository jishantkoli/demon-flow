import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
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
import commentRoutes from './routes/comments.js';

const app = express();

// Trust proxy for rate limiting on Render
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// Permissive CORS for development/network access
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow everything
    if (process.env.NODE_ENV === 'development' || !process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    // Always allow local access
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('http://192.168.')) {
      return callback(null, true);
    }

    // Always allow the Vercel frontend
    const alwaysAllowed = ['https://demon-flow.vercel.app'];
    if (alwaysAllowed.includes(origin)) return callback(null, true);

    const allowed = (process.env.FRONTEND_URL || '').split(',').map(u => u.trim());
    if (allowed.indexOf(origin) !== -1 || allowed.includes('*')) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept', 'Origin']
}));

app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('dev'));

// Simple MongoDB sanitization — removes $ prefixed keys
const sanitize = (data: any): any => {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const sanitized: any = {};
    for (const key in data) {
      if (key.startsWith('$')) {
        console.warn(`[Security] Blocked NoSQL injection attempt in key ${key}`);
        continue;
      }
      sanitized[key] = sanitize(data[key]);
    }
    return sanitized;
  } else if (Array.isArray(data)) {
    return data.map(sanitize);
  }
  return data;
};

// Sanitize req.body only (since req.query/req.params can't be overwritten in Express 5)
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    // Create a new sanitized object for body
    (req as any).sanitizedBody = sanitize(req.body);
  }
  next();
});

// Rate Limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: process.env.NODE_ENV === 'development' ? 10000 : 500, // 500 in prod
//   message: 'Too many requests from this IP, please try again after 15 minutes',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api', limiter);

// Strict rate limiting on authentication endpoints — prevents brute-force
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: process.env.NODE_ENV === 'development' ? 1000 : 10, // 10 attempts in prod
//   message: 'Too many authentication attempts, please try again after 15 minutes',
//   standardHeaders: true,
//   legacyHeaders: false,
//   keyGenerator: (req) => {
//     // Use simple key for now to avoid validation errors
//     let ip = req.ip || req.socket.remoteAddress || 'unknown';
//     if (ip && ip.startsWith('::ffff:')) ip = ip.slice(7);
//     const email = req.body?.email || '';
//     return `${ip}-${email}`;
//   },
//   // Skip the IP+email key validation by using validationsConfig
//   validate: {
//     keyGeneratorIpFallback: false,
//   } as any,
// });
// app.use('/api/v1/auth', authLimiter);

// Static fallback for local uploads (used when Cloudinary is unavailable)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check — must be before routes
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Demon Flow API is running' });
});

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
app.use('/api/v1/comments', commentRoutes);

// Health check endpoint
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

// Dummy endpoint to prevent 404s from older frontend clients
app.get('/api/v1/comments', (req, res) => {
  res.status(200).json([]);
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
