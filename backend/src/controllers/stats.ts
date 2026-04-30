import { Response } from 'express';
import { User } from '../models/User.js';
import { Form } from '../models/Form.js';
import { Submission } from '../models/Submission.js';
import { Nomination } from '../models/Nomination.js';
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
      completionRate
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
