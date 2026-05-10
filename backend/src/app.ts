import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy for rate limiting on Render
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
}));

// CORS
app.use(cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'https://demon-flow.vercel.app'],
    credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', limiter);

// Health check routes
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Demon Flow API is running' });
});

app.get('/api/v1/uploads-direct', (req, res) => {
    res.json({ message: 'Direct uploads route is working' });
});

// Routes
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/forms', formRoutes);
app.use('/api/v1/submissions', submissionRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/nominations', nominationRoutes);
app.use('/api/v1', reviewRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/comments', commentRoutes);

// Error handling
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

export default app;
