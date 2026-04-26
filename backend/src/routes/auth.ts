import express, { Request, Response } from 'express';
import { login, requestOTP, verifyOTP, logout, verifySession, refreshSession } from '../controllers/auth.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', async (req: Request, res: Response) => {
  const { action } = req.body;
  switch (action) {
    case 'login-password': return login(req, res);
    case 'request-otp': return requestOTP(req, res);
    case 'verify-otp': return verifyOTP(req, res);
    case 'verify-token': return verifySession(req, res);
    default: return res.status(400).json({ error: 'Invalid action' });
  }
});

router.post('/logout', logout);
router.post('/refresh', refreshSession);
router.get('/me', authenticate, (req: any, res) => res.json({ user: req.user }));

export default router;
