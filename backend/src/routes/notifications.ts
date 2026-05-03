import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Submission } from '../models/Submission.js';
import { Review } from '../models/Review.js';
import { Nomination } from '../models/Nomination.js';
import { User } from '../models/User.js';
import { sendEmail } from '../utils/email.js';

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

router.post('/announcement', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can send announcements' });
    }

    const {
      subject,
      body,
      audience = 'teachers',
      school_code
    } = req.body || {};

    if (!subject || !String(subject).trim() || !body || !String(body).trim()) {
      return res.status(400).json({ message: 'Subject and body are required' });
    }

    const roleMap: Record<string, string[] | null> = {
      teachers: ['teacher'],
      functionaries: ['functionary'],
      all_users: ['teacher', 'functionary', 'reviewer', 'admin'],
      by_school: ['teacher', 'functionary']
    };

    const targetRoles = roleMap[String(audience)] || ['teacher'];
    const query: any = {
      isActive: { $ne: false },
      email: { $exists: true, $ne: '' }
    };

    if (targetRoles) query.role = { $in: targetRoles };
    if (school_code && String(school_code).trim()) {
      query['profile.schoolCode'] = String(school_code).trim();
    }

    const recipients = await User.find(query).select('email role profile.fullName profile.schoolCode');
    if (!recipients.length) {
      return res.status(200).json({
        success: true,
        sent_count: 0,
        failed_count: 0,
        total: 0,
        message: 'No recipients found for selected audience'
      });
    }

    const subjectTpl = String(subject);
    const bodyTpl = String(body);
    const replaceVars = (tpl: string, u: any) =>
      tpl
        .replace(/{{recipient_name}}/g, u?.profile?.fullName || 'User')
        .replace(/{{recipient_email}}/g, u?.email || '')
        .replace(/{{school_code}}/g, u?.profile?.schoolCode || '')
        .replace(/{{role}}/g, u?.role || '');

    let sent = 0;
    let failed = 0;
    const failed_emails: string[] = [];

    for (const u of recipients) {
      const ok = await sendEmail(
        u.email,
        replaceVars(subjectTpl, u),
        replaceVars(bodyTpl, u)
      );
      if (ok) {
        sent += 1;
      } else {
        failed += 1;
        failed_emails.push(u.email);
      }
    }

    res.status(200).json({
      success: true,
      total: recipients.length,
      sent_count: sent,
      failed_count: failed,
      failed_emails
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
