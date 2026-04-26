import { Request, Response } from 'express';
import { Submission } from '../models/Submission.js';
import { Level } from '../models/Level.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { Form } from '../models/Form.js';
import { AuthRequest } from '../middleware/auth.js';
import mongoose from 'mongoose';

// ─── Levels ───────────────────────────────────────────────────────────────────

export const getLevels = async (req: AuthRequest, res: Response) => {
  try {
    const { form_id } = req.query;
    const query: any = {};
    if (form_id) {
      if (!mongoose.Types.ObjectId.isValid(form_id as string)) {
        const form = await Form.findOne({ shareableLink: form_id as string });
        if (!form) return res.status(200).json([]);
        query.formId = form._id;
      } else {
        query.formId = form_id;
      }
    }
    const levels = await Level.find(query).sort({ levelNumber: 1 });
    res.status(200).json(levels.map(l => ({ ...l.toObject(), id: l._id, level_number: l.levelNumber })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createLevel = async (req: AuthRequest, res: Response) => {
  try {
    const { form_id, level_number, name, scoring_type, blind_review, reviewer_ids } = req.body;
    const level = await Level.create({
      formId: form_id,
      levelNumber: level_number,
      name,
      scoringType: scoring_type === 'form_level' ? 'form' : 'question',
      blindReview: blind_review,
      assignedReviewers: reviewer_ids
    });
    res.status(201).json({ ...level.toObject(), id: level._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Shortlisting ─────────────────────────────────────────────────────────────

export const getShortlistData = async (req: AuthRequest, res: Response) => {
  try {
    const { form_id, submission_id } = req.query;

    if (submission_id) {
      if (!mongoose.Types.ObjectId.isValid(submission_id as string)) {
        return res.status(400).json({ error: 'Invalid submission_id format' });
      }
      const sub = await Submission.findById(submission_id).populate('formId');
      if (!sub) return res.status(404).json({ error: 'Submission not found' });

      const levels = await Level.find({ formId: sub.formId }).sort({ levelNumber: 1 });
      const reviews = await Review.find({ submission_id: submission_id as string }).sort({ level: 1 });

      const levelData = levels.map(l => {
        const levelReviews = reviews.filter(r => r.level_id.toString() === l._id.toString());
        const scores = levelReviews.map(r => ({
          overall_score: r.overall_score,
          grade: r.grade,
          comments: r.comments,
          recommendation: r.recommendation,
          created_at: r.createdAt
        }));
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + (b.overall_score || 0), 0) / scores.length : null;
        
        return {
          level_id: l._id,
          level_number: l.levelNumber,
          level_name: l.name,
          scoring_type: l.scoringType,
          blind_review: l.blindReview,
          total_reviewers: levelReviews.length,
          average_score: avg != null ? Math.round(avg * 10) / 10 : null,
          scores
        };
      });

      return res.status(200).json({
        submission: {
          ...sub.toObject(),
          id: sub._id,
          form_title: (sub.formId as any).title,
          score: sub.score?.percentage
        },
        levels: levelData,
        highest_level: reviews.length > 0 ? Math.max(...reviews.map(r => r.level)) : 0,
        total_levels: levels.length,
        comments: [] // Could implement a separate Comment model if needed
      });
    }

    if (form_id) {
      if (!mongoose.Types.ObjectId.isValid(form_id as string)) {
        // If not a valid ObjectId, maybe it's a shareableLink? 
        // Let's try to find the form first
        const form = await Form.findOne({ shareableLink: form_id as string });
        if (!form) {
          // If still not found, return empty results instead of crashing
          return res.status(200).json({ submissions: [], levels: [] });
        }
        // Use the actual form _id
        var actualFormId: any = form._id;
      } else {
        var actualFormId: any = form_id;
      }

      const submissions = await Submission.find({ formId: actualFormId, isDraft: false });
      const levels = await Level.find({ formId: actualFormId }).sort({ levelNumber: 1 });
      const reviews = await Review.find({ submission_id: { $in: submissions.map(s => s._id) } });

      const subData = submissions.map(s => {
        const subReviews = reviews.filter(r => r.submission_id.toString() === s._id.toString());
        const levelAverages: any = {};
        subReviews.forEach(r => {
          if (!levelAverages[`level_${r.level}`]) levelAverages[`level_${r.level}`] = [];
          levelAverages[`level_${r.level}`].push(r.overall_score || 0);
        });

        Object.keys(levelAverages).forEach(k => {
          const vals = levelAverages[k];
          levelAverages[k] = vals.length > 0 ? Math.round((vals.reduce((a:any, b:any) => a + b, 0) / vals.length) * 10) / 10 : 0;
        });

        return {
          ...s.toObject(),
          id: s._id,
          user_name: s.userName,
          user_email: s.userEmail,
          score: s.score?.percentage,
          highest_level: subReviews.length > 0 ? Math.max(...subReviews.map(r => r.level)) : 0,
          level_averages: levelAverages
        };
      });

      return res.status(200).json({
        submissions: subData,
        levels: levels.map(l => ({ id: l._id, level_number: l.levelNumber, name: l.name }))
      });
    }

    res.status(400).json({ error: 'form_id or submission_id required' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createShortlist = async (req: AuthRequest, res: Response) => {
  try {
    const { action, form_id, level_id, filter_type, filter_value, reviewer_ids, field_id, field_value, field_filters, submission_ids } = req.body;
    
    if (action !== 'create-shortlist') return res.status(400).json({ error: 'Invalid action' });

    const level = await Level.findById(level_id);
    if (!level) return res.status(404).json({ error: 'Level not found' });

    let actualFormId = form_id;
    if (!mongoose.Types.ObjectId.isValid(form_id)) {
      const form = await Form.findOne({ shareableLink: form_id as string });
      if (!form) return res.status(404).json({ error: 'Form not found' });
      actualFormId = form._id;
    }

    let query: any = { formId: actualFormId, isDraft: false };
    
    // NEW: If explicit submission_ids are provided, use them
    if (Array.isArray(submission_ids) && submission_ids.length > 0) {
      query._id = { $in: submission_ids };
    } else {
      // Fallback to existing filter logic
      if (filter_type === 'form_score_gte') {
        query['score.percentage'] = { $gte: parseFloat(filter_value) };
      }
    }
    
    const submissions = await Submission.find(query);
    const normalize = (value: any) => String(value ?? '').trim().toLowerCase();
    
    // If we used submission_ids, we don't need to re-apply field filters (they were already applied on frontend)
    const skipFieldFilters = Array.isArray(submission_ids) && submission_ids.length > 0;

    const requestedFieldFilters = Array.isArray(field_filters) && field_filters.length > 0
      ? field_filters
      : (field_id && field_value !== undefined ? [{ field_id, field_value }] : []);

    const matchesFieldFilters = (sub: any) => {
      if (skipFieldFilters) return true;
      if (filter_type !== 'field_value' || requestedFieldFilters.length === 0) return true;
      const responseMap = new Map<string, any>();
      for (const response of sub.responses || []) {
        responseMap.set(String(response.fieldId), response.value);
      }

      return requestedFieldFilters.every((filter: any) => {
        const actualValue = responseMap.get(String(filter.field_id));
        if (Array.isArray(actualValue)) {
          return actualValue.some((item: any) => normalize(item) === normalize(filter.field_value));
        }
        return normalize(actualValue) === normalize(filter.field_value);
      });
    };

    let shortlistedCount = 0;
    let reviewsCreated = 0;

    for (const sub of submissions) {
      if (!matchesFieldFilters(sub)) continue;

      // Check if already shortlisted for this level
      const existing = await Review.findOne({ submission_id: sub._id, level_id });
      if (existing) continue;

      shortlistedCount++;
      // Assign to all selected reviewers
      for (const rid of reviewer_ids) {
        await Review.create({
          submission_id: sub._id,
          reviewer_id: rid,
          level: level.levelNumber,
          level_id: level._id,
          status: 'pending'
        });
        reviewsCreated++;
      }
    }

    res.status(201).json({
      shortlisted: shortlistedCount,
      reviews_created: reviewsCreated,
      reviewers: reviewer_ids.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const getReviews = async (req: AuthRequest, res: Response) => {
  try {
    const { reviewer_id } = req.query;
    const query: any = {};
    if (reviewer_id) query.reviewer_id = reviewer_id;
    
    // Reviewers only see theirs
    if (req.user.role === 'reviewer') {
      query.reviewer_id = req.user._id;
    }

    const reviews = await Review.find(query).populate('level_id', 'scoringType').sort({ createdAt: -1 });
    res.status(200).json(reviews.map(r => ({
      ...r.toObject(),
      id: r._id,
      submission_id: r.submission_id,
      reviewer_name: req.user.name, // Simple fallback
      scoring_type: (r.level_id as any)?.scoringType === 'question' ? 'question_level' : 'form_level'
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateReview = async (req: AuthRequest, res: Response) => {
  try {
    const { id, status, comments } = req.body;
    const review = await Review.findByIdAndUpdate(id, { status, comments, reviewed_at: new Date() }, { new: true });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.status(200).json(review);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const saveReviewScore = async (req: AuthRequest, res: Response) => {
  try {
    const { review_id, overall_score, grade, comments, recommendation, is_draft, question_scores } = req.body;
    const existingReview = await Review.findById(review_id);
    if (!existingReview) return res.status(404).json({ error: 'Review not found' });

    let normalizedQuestionScores = Array.isArray(question_scores) ? question_scores : [];
    if (normalizedQuestionScores.length > 0) {
      const submission = await Submission.findById(existingReview.submission_id).populate('formId');
      const formSchema = (submission?.formId as any)?.form_schema;
      const reviewerMaxByField: Record<string, number> = {};
      if (formSchema?.sections) {
        formSchema.sections.forEach((section: any) => {
          section.fields?.forEach((field: any) => {
            const maxMarks = Math.max(0, Number(field?.reviewer_max_marks) || 0);
            reviewerMaxByField[String(field?.id)] = maxMarks;
          });
        });
      }

      for (const entry of normalizedQuestionScores) {
        const fieldId = String(entry?.field_id || '');
        const score = Number(entry?.score) || 0;
        const allowedMax = reviewerMaxByField[fieldId] || 0;
        if (score < 0) {
          return res.status(400).json({ error: `Negative score is not allowed for field ${fieldId}` });
        }
        if (allowedMax > 0 && score > allowedMax) {
          return res.status(400).json({ error: `Score for field ${fieldId} cannot be more than ${allowedMax}` });
        }
      }

      normalizedQuestionScores = normalizedQuestionScores
        .map((entry: any) => ({
          field_id: String(entry?.field_id || ''),
          score: Number(entry?.score) || 0,
        }))
        .filter((entry: any) => entry.field_id);
    }

    const review = await Review.findByIdAndUpdate(review_id, {
      overall_score,
      grade,
      comments,
      recommendation,
      is_draft,
      question_scores: normalizedQuestionScores,
      status: is_draft ? 'pending' : (recommendation === 'reject' ? 'rejected' : 'approved'),
      reviewed_at: is_draft ? null : new Date()
    }, { new: true });

    res.status(200).json(review);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
