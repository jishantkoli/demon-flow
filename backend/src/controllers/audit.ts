import { Response } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { AuthRequest } from '../middleware/auth.js';

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await AuditLog.find()
      .populate('userId', 'email role profile.fullName')
      .sort({ createdAt: -1 })
      .limit(limit);
    const mapped = logs.map((l: any) => {
      const obj = l.toObject();
      const user = obj.userId && typeof obj.userId === 'object' ? obj.userId : null;
      return {
        ...obj,
        id: obj._id,
        created_at: obj.createdAt,
        user_id: user?._id || obj.userId || null,
        user_name: user?.profile?.fullName || null,
        user_email: user?.email || null,
        user_role: user?.role || null
      };
    });
    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createAuditLog = async (req: AuthRequest, res: Response) => {
  try {
    const { action, details } = req.body;
    const log = await AuditLog.create({
      userId: req.user?._id || req.body.user_id,
      action,
      details,
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });
    res.status(201).json(log);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
