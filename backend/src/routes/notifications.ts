import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Submission } from '../models/Submission.js';
import { Review } from '../models/Review.js';
import { Nomination } from '../models/Nomination.js';

const router = express.Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const notifications: any[] = [];

    if (user.role === 'admin') {
      const submissions = await Submission.find({ isDraft: false }).sort({ createdAt: -1 }).limit(10);
      notifications.push(...submissions.map((sub: any) => ({
        id: String(sub._id),
        title: 'New submission received',
        message: `${sub.userName || 'Anonymous'} submitted ${sub.formTitle || 'a form'}`,
        is_read: false,
        created_at: sub.createdAt
      })));
    } else if (user.role === 'reviewer') {
      const reviews = await Review.find({ reviewer_id: user._id }).sort({ createdAt: -1 }).limit(10);
      notifications.push(...reviews.map((review: any) => ({
        id: String(review._id),
        title: review.status === 'pending' ? 'Review assigned' : 'Review updated',
        message: `Level ${review.level} review is ${review.status}`,
        is_read: review.status !== 'pending',
        created_at: review.createdAt
      })));
    } else if (user.role === 'functionary') {
      const nominations = await Nomination.find({ functionary_id: user._id }).sort({ updatedAt: -1 }).limit(10);
      notifications.push(...nominations.map((nom: any) => ({
        id: String(nom._id),
        title: `Teacher ${nom.status}`,
        message: `${nom.teacher_name} nomination is currently ${nom.status}`,
        is_read: nom.status === 'completed',
        created_at: nom.updatedAt || nom.createdAt
      })));
    } else {
      const submissions = await Submission.find({ userId: user._id, isDraft: false }).sort({ updatedAt: -1 }).limit(10);
      notifications.push(...submissions.map((sub: any) => ({
        id: String(sub._id),
        title: 'Submission update',
        message: `${sub.formTitle || 'Form'} is ${sub.status}`,
        is_read: sub.status === 'submitted',
        created_at: sub.updatedAt || sub.createdAt
      })));
    }

    res.json(notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', authenticate, (_req, res) => {
  res.json({ success: true });
});

export default router;
