import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { Notification } from '../models/Notification.js';

const router = express.Router();

router.get('/', authenticate, async (req: any, res) => {
  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(notifications.map((n: any) => ({
    id: n._id,
    title: n.title,
    message: n.message,
    is_read: n.isRead,
    created_at: n.createdAt,
    type: n.type
  })));
});

router.put('/', authenticate, async (req: any, res) => {
  const { id, is_read } = req.body || {};
  const markRead = Boolean(is_read);

  if (id === 'all') {
    await Notification.updateMany({ userId: req.user._id }, { isRead: markRead });
    return res.json({ success: true });
  }

  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  const updated = await Notification.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    { isRead: markRead },
    { new: true }
  );

  if (!updated) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  res.json({ success: true });
});

export default router;
