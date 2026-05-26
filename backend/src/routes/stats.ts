import express from 'express';
import { getFormAnalytics, getStats } from '../controllers/stats.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, getStats);
router.get('/form-analytics', authenticate, getFormAnalytics);

export default router;
