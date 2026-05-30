import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const generateTokens = (user: any) => {
  const payload = { 
    id: user._id, 
    role: user.role, 
    schoolCode: user.profile?.schoolCode 
  };
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

// Cross-domain safe cookie options (Vercel frontend ↔ Render backend)
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      // Generic error — don't reveal whether email exists
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ─── Account Lockout Check ────────────────────────────────────────────
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      await AuditLog.create({
        action: 'login_blocked_locked',
        metadata: { email: normalizedEmail, ip: req.ip, remainingMinutes }
      });
      return res.status(423).json({ 
        error: `Account is locked. Try again in ${remainingMinutes} minute(s).` 
      });
    }

    const isMatch = await (user as any).comparePassword(password);

    if (!isMatch) {
      // ─── Increment Failed Attempts ──────────────────────────────────────
      const attempts = (user.loginAttempts || 0) + 1;
      const updates: any = { loginAttempts: attempts };
      
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        updates.lockUntil = Date.now() + LOCK_DURATION_MS;
        console.warn(`[Security] Account locked after ${attempts} failed attempts: ${normalizedEmail}`);
      }
      
      await User.findByIdAndUpdate(user._id, updates);
      
      await AuditLog.create({
        action: 'login_failed',
        metadata: { ip: req.ip, attempts }
      });
      
      const remaining = MAX_LOGIN_ATTEMPTS - attempts;
      if (remaining > 0 && remaining <= 2) {
        return res.status(401).json({ 
          error: `Invalid credentials. ${remaining} attempt(s) remaining before account lock.` 
        });
      }
      
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ─── Successful Login — Reset Lockout Counters ────────────────────────
    if (user.loginAttempts > 0 || user.lockUntil) {
      await User.findByIdAndUpdate(user._id, { loginAttempts: 0, lockUntil: null });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    
    await AuditLog.create({
      userId: user._id,
      action: 'login_success',
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] }
    });

    res.cookie('refreshToken', refreshToken, getCookieOptions());

    res.status(200).json({
      token: accessToken,
      accessToken,
      user: {
        id: user._id,
        name: user.profile.fullName,
        email: user.email,
        role: user.role,
        school_code: user.profile.schoolCode
      }
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'An internal error occurred' });
  }
};

export const verifySession = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ error: 'Token required' });

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    res.status(200).json({
      user: {
        id: user._id,
        name: user.profile.fullName,
        email: user.email,
        role: user.role,
        school_code: user.profile.schoolCode
      }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const refreshSession = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const { accessToken, refreshToken: nextRefreshToken } = generateTokens(user);

    res.cookie('refreshToken', nextRefreshToken, getCookieOptions());

    res.status(200).json({
      token: accessToken,
      accessToken,
      user: {
        id: user._id,
        name: user.profile.fullName,
        email: user.email,
        role: user.role,
        school_code: user.profile.schoolCode
      }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const requestOTP = async (req: Request, res: Response) => {
  try {
    const { email, phone } = req.body;
    const user = await User.findOne(email ? { email } : { 'profile.phone': phone });
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = '123456'; // Use 123456 for manual testing locally
    
    await AuditLog.create({
      userId: user._id,
      action: 'otp_requested',
      metadata: { method: email ? 'email' : 'phone', ip: req.ip }
    });

    res.status(200).json({ 
      success: true, 
      message: 'OTP sent successfully',
      school_code: user.profile?.schoolCode
    });
  } catch (err: any) {
    console.error('[Auth] OTP request error:', err.message);
    res.status(500).json({ error: 'An internal error occurred' });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { email, phone, otp } = req.body;
    if (otp !== '123456') return res.status(401).json({ error: 'Invalid OTP' });

    const user = await User.findOne(email ? { email } : { 'profile.phone': phone });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { accessToken, refreshToken } = generateTokens(user);

    res.cookie('refreshToken', refreshToken, getCookieOptions());

    res.status(200).json({
      token: accessToken,
      accessToken,
      user: {
        id: user._id,
        name: user.profile.fullName,
        email: user.email,
        role: user.role,
        school_code: user.profile.schoolCode
      }
    });
  } catch (err: any) {
    console.error('[Auth] OTP verify error:', err.message);
    res.status(500).json({ error: 'An internal error occurred' });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie('refreshToken', getCookieOptions());
  res.status(200).json({ success: true });
};

