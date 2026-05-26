import { Response } from 'express';
import { User } from '../models/User.js';
import { Form } from '../models/Form.js';
import { Submission } from '../models/Submission.js';
import { Nomination } from '../models/Nomination.js';
import { Review } from '../models/Review.js';
import { AuthRequest } from '../middleware/auth.js';
import { escapeRegex } from '../utils/escape.js';

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
      subQuery.userEmail = { $regex: new RegExp(`^${escapeRegex(String(email))}$`, 'i') };
      nominationQuery.teacher_email = { $regex: new RegExp(`^${escapeRegex(String(email))}$`, 'i') };
    } else if (role === 'functionary') {
      subQuery.schoolCode = req.user?.profile?.schoolCode;
      nominationQuery.school_code = req.user?.profile?.schoolCode;
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
        teacher_email: { $regex: new RegExp(`^${escapeRegex(String(email))}$`, 'i') } 
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
        // Fix: highest_level doesn't exist on Submission model, find it from reviews
        const subReviews = await Review.find({ submission_id: sub._id });
        if (subReviews.length === 0) continue;
        
        const highestLevel = Math.max(...subReviews.map(r => r.level));
        const reviews = subReviews.filter(r => r.level === highestLevel);
        
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

export const getFormAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { form_id, limit } = req.query;
    const role = req.user?.role;
    const userId = req.user?._id;
    const email = req.user?.email;

    if (!form_id) return res.status(400).json({ error: 'form_id is required' });

    const form = await Form.findById(form_id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const subQuery: any = { formId: form_id };

    if (role === 'teacher') {
      subQuery.userEmail = { $regex: new RegExp(`^${escapeRegex(String(email))}$`, 'i') };
    } else if (role === 'functionary') {
      subQuery.schoolCode = req.user?.profile?.schoolCode;
    } else if (role === 'reviewer') {
      const myReviews = await Review.find({ reviewer_id: userId });
      subQuery._id = { $in: myReviews.map(r => r.submission_id) };
    }

    const max = (() => {
      const n = Number(limit);
      if (!Number.isFinite(n) || n <= 0) return 5000;
      return Math.min(Math.max(1, Math.floor(n)), 5000);
    })();

    const submissions = await Submission.find(subQuery)
      .select('responses userEmail createdAt submittedAt')
      .sort({ createdAt: -1 })
      .limit(max);

    const schema = (form as any).form_schema || (form as any).schema || {};
    const sections = Array.isArray(schema?.sections) ? schema.sections : [];
    const allFields: any[] = sections.flatMap((s: any) => Array.isArray(s?.fields) ? s.fields : []);

    const byField: Record<string, any> = {};
    const fieldOrder: string[] = [];
    allFields.forEach((f: any) => {
      const id = String(f.id);
      fieldOrder.push(id);
      byField[id] = {
        fieldId: id,
        label: f.label || 'Untitled question',
        type: f.type,
        options: Array.isArray(f.options) ? f.options : [],
        answeredCount: 0,
        skippedCount: 0,
        totalCount: 0,
        counts: {} as Record<string, number>,
        samples: [] as string[],
        numeric: { sum: 0, count: 0, min: null as number | null, max: null as number | null },
        dates: {} as Record<string, number>,
        files: { count: 0, latest: [] as string[] }
      };
    });

    const normalizeOption = (field: any, raw: any) => {
      if (raw === undefined || raw === null) return '';
      const opts = Array.isArray(field.options) ? field.options : [];
      if (typeof raw === 'number' && opts[raw] !== undefined) return String(opts[raw]);
      const rawStr = String(raw).trim();
      const n = Number(rawStr);
      if (!Number.isNaN(n) && rawStr !== '' && opts[n] !== undefined) return String(opts[n]);
      return rawStr;
    };

    const isBlank = (v: any) => {
      if (v === undefined || v === null) return true;
      if (Array.isArray(v)) return v.length === 0;
      if (typeof v === 'string') return v.trim() === '';
      return false;
    };

    const unique = new Set<string>();

    submissions.forEach((sub: any) => {
      const e = sub?.userEmail;
      if (typeof e === 'string' && e.trim()) unique.add(e.trim().toLowerCase());
      const responses = Array.isArray(sub.responses) ? sub.responses : [];
      const byResp: Record<string, any> = {};
      responses.forEach((r: any) => {
        if (!r) return;
        const fid = String(r.fieldId);
        byResp[fid] = r.value;
      });

      fieldOrder.forEach(fid => {
        const field = byField[fid];
        if (!field) return;
        field.totalCount += 1;
        const v = byResp[fid];
        if (isBlank(v)) {
          field.skippedCount += 1;
          return;
        }
        field.answeredCount += 1;

        const t = String(field.type || '');
        if (t === 'radio' || t === 'mcq' || t === 'dropdown' || t === 'select') {
          const key = normalizeOption(field, v) || '—';
          field.counts[key] = (field.counts[key] || 0) + 1;
          return;
        }
        if (t === 'checkbox') {
          const arr = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [v]);
          arr.forEach(item => {
            const key = normalizeOption(field, item) || '—';
            field.counts[key] = (field.counts[key] || 0) + 1;
          });
          return;
        }
        if (t === 'number' || t === 'rating') {
          const n = Number(String(v).trim());
          if (!Number.isNaN(n)) {
            field.numeric.sum += n;
            field.numeric.count += 1;
            field.numeric.min = field.numeric.min === null ? n : Math.min(field.numeric.min, n);
            field.numeric.max = field.numeric.max === null ? n : Math.max(field.numeric.max, n);
          }
          return;
        }
        if (t === 'date') {
          const d = String(v).slice(0, 10);
          const key = d || '—';
          field.dates[key] = (field.dates[key] || 0) + 1;
          return;
        }
        if (t === 'file') {
          field.files.count += 1;
          const s = String(v).trim();
          if (s && field.files.latest.length < 3) field.files.latest.push(s);
          return;
        }
        const s = String(v).trim();
        if (s && field.samples.length < 5) field.samples.push(s);
      });
    });

    const questions = fieldOrder.map(fid => {
      const f = byField[fid];
      if (!f) return null;

      const opts = Array.isArray(f.options) ? f.options.map((x: any) => String(x)) : [];
      const optionSet = new Set(opts);
      const optionEntries = (opts.length
        ? opts.map((label: string) => {
            const count = Number((f.counts as any)[label] || 0);
            return {
              label,
              count,
              pct: f.answeredCount ? Math.round((count / f.answeredCount) * 100) : 0
            };
          })
        : Object.entries(f.counts)
            .sort((a, b) => Number(b[1]) - Number(a[1]))
            .slice(0, 12)
            .map(([label, count]) => ({
              label,
              count,
              pct: f.answeredCount ? Math.round(((count as number) / f.answeredCount) * 100) : 0
            }))
      );

      // Include any unexpected values not in schema options (up to a small cap)
      if (opts.length) {
        const extras = Object.entries(f.counts)
          .filter(([label]) => !optionSet.has(String(label)))
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .slice(0, Math.max(0, 5));
        extras.forEach(([label, count]) => {
          optionEntries.push({
            label: String(label),
            count: Number(count || 0),
            pct: f.answeredCount ? Math.round((Number(count || 0) / f.answeredCount) * 100) : 0
          });
        });
      }

      const dateEntries = Object.entries(f.dates)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 10)
        .map(([label, count]) => ({
          label,
          count: Number(count),
          pct: f.answeredCount ? Math.round((Number(count) / f.answeredCount) * 100) : 0
        }));

      const numeric = f.numeric.count
        ? {
            avg: Math.round((f.numeric.sum / f.numeric.count) * 100) / 100,
            min: f.numeric.min,
            max: f.numeric.max
          }
        : null;

      return {
        fieldId: f.fieldId,
        label: f.label,
        type: f.type,
        totalResponses: f.totalCount,
        answered: f.answeredCount,
        skipped: f.skippedCount,
        options: optionEntries.length ? optionEntries : null,
        dates: dateEntries.length ? dateEntries : null,
        numeric,
        samples: f.samples.length ? f.samples : null,
        files: f.files.count ? { count: f.files.count, latest: f.files.latest } : null
      };
    }).filter(Boolean);

    res.status(200).json({
      form: { id: form._id, title: form.title, formType: (form as any).formType },
      totalSubmissions: submissions.length,
      uniqueRespondents: unique.size,
      truncated: submissions.length >= max,
      questions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
