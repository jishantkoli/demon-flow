import { Response } from 'express';
import { User } from '../models/User.js';
import { Form } from '../models/Form.js';
import { Submission } from '../models/Submission.js';
import { Nomination } from '../models/Nomination.js';
import { Review } from '../models/Review.js';
import { AuthRequest } from '../middleware/auth.js';

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const { form_id } = req.query;
    const role = req.user?.role;
    const userId = req.user?._id;
    const email = req.user?.email;

    let subQuery: any = {};
    let nominationQuery: any = {};

    if (form_id) {
      subQuery.formId = form_id;
      nominationQuery.form_id = form_id;
    }

    if (role === 'admin') {
      // Admin sees everything
    } else if (role === 'teacher') {
      subQuery.userEmail = { $regex: new RegExp(`^${email}$`, 'i') };
      nominationQuery.teacher_email = { $regex: new RegExp(`^${email}$`, 'i') };
    } else if (role === 'functionary') {
      subQuery.schoolCode = req.user.profile?.schoolCode;
      nominationQuery.functionary_id = userId; // Filter by functionary_id for functionaries
    } else if (role === 'reviewer') {
      const myReviews = await Review.find({ reviewer_id: userId });
      subQuery._id = { $in: myReviews.map(r => r.submission_id) };
    }

    // 1. KPI Stats
    const totalUsers = await User.countDocuments({ passwordHash: { $exists: true, $ne: null } });
    
    // For Teacher, activeForms should ONLY count forms they are specifically nominated for
    let activeFormsQuery: any = { status: 'active' };
    if (role === 'teacher') {
      const myNominations = await Nomination.find({ 
        teacher_email: { $regex: new RegExp(`^${email}$`, 'i') } 
      });
      const nominatedFormIds = myNominations.map(n => n.form_id);
      activeFormsQuery = { 
        _id: { $in: nominatedFormIds }, 
        status: 'active' 
      };
    }
    const activeForms = await Form.countDocuments(activeFormsQuery);
    const draftForms = await Form.countDocuments({ status: 'draft' });
    const expiredForms = await Form.countDocuments({ status: 'expired' });
    const totalSubmissions = await Submission.countDocuments(subQuery);
    
    // 2. Submissions by Status
    const submissionsByStatus = {
      submitted: await Submission.countDocuments({ ...subQuery, status: 'submitted' }),
      under_review: await Submission.countDocuments({ ...subQuery, status: 'under_review' }),
      approved: await Submission.countDocuments({ ...subQuery, status: { $in: ['approved', 'next_level'] } }),
      rejected: await Submission.countDocuments({ ...subQuery, status: 'rejected' }),
      pending: await Submission.countDocuments({ ...subQuery, status: 'pending' }),
    };

    // Fix for "under_review" items that are actually approved or rejected
    // If a submission is marked under_review but all reviews are finished, we should count it correctly
    if (role === 'admin') {
      const underReviewSubs = await Submission.find({ ...subQuery, status: 'under_review' });
      for (const sub of underReviewSubs) {
        const reviews = await Review.find({ submission_id: sub._id, level: sub.highest_level || 1 });
        if (reviews.length > 0 && reviews.every(r => ['approved', 'rejected', 'completed'].includes(String(r.status)))) {
          const allApproved = reviews.every(r => r.recommendation === 'next_level');
          const allRejected = reviews.every(r => r.recommendation === 'reject');
          if (allApproved) {
            submissionsByStatus.approved++;
            submissionsByStatus.under_review--;
          } else if (allRejected) {
            submissionsByStatus.rejected++;
            submissionsByStatus.under_review--;
          }
        }
      }
    }

    // 2b. Users by Role
    const usersByRole = {
      admin: await User.countDocuments({ role: 'admin' }),
      reviewer: await User.countDocuments({ role: 'reviewer' }),
      functionary: await User.countDocuments({ role: 'functionary' }),
      teacher: await User.countDocuments({ role: 'teacher' }),
      form_creator: await User.countDocuments({ role: 'form_creator' }),
    };

    // 2c. Review Stats
    let reviewQuery: any = {};
    if (role === 'reviewer') {
      reviewQuery.reviewer_id = userId;
    }
    const pendingReviews = await Review.countDocuments({ ...reviewQuery, status: 'pending' });
    const completedReviews = await Review.countDocuments({ ...reviewQuery, status: { $in: ['approved', 'rejected', 'completed'] } });

    // 3. Nominations Stats
    const nominationsByStatus = {
      invited: await Nomination.countDocuments({ ...nominationQuery, status: 'invited' }),
      in_progress: await Nomination.countDocuments({ ...nominationQuery, status: 'in_progress' }),
      completed: await Nomination.countDocuments({ ...nominationQuery, status: 'completed' }),
    };
    const totalNominations = nominationsByStatus.invited + nominationsByStatus.in_progress + nominationsByStatus.completed;
    const completionRate = totalNominations > 0 
      ? Math.round((nominationsByStatus.completed / totalNominations) * 100) 
      : (totalSubmissions > 0 ? 100 : 0);

    // 4. Scores & Performance
    const submissionsWithScore = await Submission.find({ 
      ...subQuery, 
      'score.percentage': { $exists: true, $ne: null } 
    });
    
    let avgScore = 0;
    const scoreDistribution: Record<string, number> = {
      '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0
    };

    if (submissionsWithScore.length > 0) {
      const sum = submissionsWithScore.reduce((acc, s) => acc + (s.score?.percentage || 0), 0);
      avgScore = Math.round(sum / submissionsWithScore.length);

      submissionsWithScore.forEach(s => {
        const p = s.score?.percentage || 0;
        if (p <= 20) scoreDistribution['0-20']++;
        else if (p <= 40) scoreDistribution['21-40']++;
        else if (p <= 60) scoreDistribution['41-60']++;
        else if (p <= 80) scoreDistribution['61-80']++;
        else scoreDistribution['81-100']++;
      });
    }

    // 5. Timeline (Last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    const timelineData = await Submission.aggregate([
      { $match: { ...subQuery, createdAt: { $gte: fourteenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const submissionTimeline = Object.fromEntries(timelineData.map(d => [d._id, d.count]));

    // 6. Form List for Filter
    const forms = await Form.find({ status: { $ne: 'draft' } }, 'title status').sort({ createdAt: -1 });

    // 7. Active School Codes (for Admin/Global view)
    let schoolCodes: string[] = [];
    if (!form_id && role === 'admin') {
      schoolCodes = await Submission.distinct('schoolCode', subQuery);
    }

    res.status(200).json({
      totalUsers,
      activeForms,
      draftForms,
      expiredForms,
      totalSubmissions,
      submissionsByStatus,
      usersByRole,
      pendingReviews,
      completedReviews,
      nominationsByStatus,
      completionRate,
      avgScore,
      scoreDistribution,
      submissionTimeline,
      forms: forms.map(f => ({ id: f._id, title: f.title, status: f.status })),
      schoolCodes: schoolCodes.filter(Boolean).slice(0, 10)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
