import { Response } from 'express';
import { User } from '../models/User.js';
import { Form } from '../models/Form.js';
import { Submission } from '../models/Submission.js';
import { Nomination } from '../models/Nomination.js';
import { Review } from '../models/Review.js';
import { AuthRequest } from '../middleware/auth.js';

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const userId = req.user?._id;
    const email = req.user?.email;

    let formQuery: any = {};
    let subQuery: any = {};

    if (role === 'admin') {
      // Admin sees everything
    } else if (role === 'teacher') {
      const nominations = await Nomination.find({ 
        teacher_email: { $regex: new RegExp(`^${email}$`, 'i') } 
      });
      const assignedFormIds = nominations.map(n => n.form_id);
      formQuery._id = { $in: assignedFormIds };
      formQuery.status = 'active';
      subQuery.userId = userId;
    } else if (role === 'functionary') {
      formQuery.status = 'active';
      subQuery.schoolCode = req.user.school_code;
    } else if (role === 'reviewer') {
      formQuery.status = 'active';
      // Reviewers see submissions they need to review
      const myReviews = await Review.find({ reviewer_id: userId });
      const mySubmissionIds = myReviews.map(r => r.submission_id);
      subQuery._id = { $in: mySubmissionIds };
    }

    const totalUsers = await User.countDocuments();
    const activeForms = await Form.countDocuments({ ...formQuery, status: 'active' });
    const draftForms = await Form.countDocuments({ ...formQuery, status: 'draft' });
    const expiredForms = await Form.countDocuments({ ...formQuery, status: 'expired' });
    const totalSubmissions = await Submission.countDocuments(subQuery);
    
    // Submissions by status
    const submissionsByStatus = {
      submitted: await Submission.countDocuments({ ...subQuery, status: 'submitted' }),
      under_review: await Submission.countDocuments({ ...subQuery, status: 'under_review' }),
      approved: await Submission.countDocuments({ ...subQuery, status: 'approved' }),
      rejected: await Submission.countDocuments({ ...subQuery, status: 'rejected' }),
    };

    // Users by role
    const usersByRole = {
      admin: await User.countDocuments({ role: 'admin' }),
      reviewer: await User.countDocuments({ role: 'reviewer' }),
      functionary: await User.countDocuments({ role: 'functionary' }),
      teacher: await User.countDocuments({ role: 'teacher' }),
    };

    // Functionary specific stats
    let totalNominations = 0;
    let nominationsByStatus: any = {};
    let completionRate = 0;

    if (role === 'functionary') {
      totalNominations = await Nomination.countDocuments({ functionary_id: userId });
      nominationsByStatus = {
        pending: await Nomination.countDocuments({ functionary_id: userId, status: 'pending' }),
        invited: await Nomination.countDocuments({ functionary_id: userId, status: 'invited' }),
        completed: await Nomination.countDocuments({ functionary_id: userId, status: 'completed' }),
      };
      if (totalNominations > 0) {
        completionRate = Math.round((nominationsByStatus.completed / totalNominations) * 100);
      }
    }

    // Review stats
    let pendingReviews = 0;
    let completedReviews = 0;
    let avgScore = 0;

    if (role === 'admin') {
      pendingReviews = await Review.countDocuments({ status: 'pending' });
      completedReviews = await Review.countDocuments({ status: { $ne: 'pending' } });
    } else if (role === 'reviewer') {
      pendingReviews = await Review.countDocuments({ reviewer_id: userId, status: 'pending' });
      const completed = await Review.find({ reviewer_id: userId, status: { $ne: 'pending' } });
      completedReviews = completed.length;
      if (completedReviews > 0) {
        const total = completed.reduce((acc, r) => acc + (Number(r.overall_score) || 0), 0);
        avgScore = Math.round(total / completedReviews);
      }
    }

    res.status(200).json({
      totalUsers,
      activeForms,
      draftForms,
      expiredForms,
      totalSubmissions,
      submissionsByStatus,
      usersByRole,
      totalNominations,
      nominationsByStatus,
      completionRate,
      pendingReviews,
      completedReviews,
      avgScore
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
