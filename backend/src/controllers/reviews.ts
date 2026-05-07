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
    res.status(200).json(levels.map(l => {
      const obj = l.toObject();
      return {
          ...obj,
          id: obj._id,
          level_number: obj.levelNumber,
          scoring_type: obj.scoringType,
          assignment_type: obj.assignmentType,
          section_id: obj.sectionId,
          blind_review: obj.blindReview,
          show_previous_reviews: obj.showPreviousReviews,
          reviewer_ids: obj.assignedReviewers
        };
    }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createLevel = async (req: AuthRequest, res: Response) => {
  try {
    const { form_id, level_number, name, scoring_type, assignment_type, section_id, blind_review, show_previous_reviews, reviewer_ids } = req.body;
    const normalizedLevelNumber = Number(level_number) || 1;
    const level = await Level.create({
      formId: form_id,
      levelNumber: normalizedLevelNumber,
      name,
      scoringType: scoring_type,
      assignmentType: assignment_type,
      sectionId: section_id,
      blindReview: blind_review,
      showPreviousReviews: normalizedLevelNumber === 1 ? false : !!show_previous_reviews,
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
      const sub = await Submission.findById(submission_id).populate('formId').populate('nominationId');
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

      const submissions = await Submission.find({ formId: actualFormId, isDraft: false }).populate('nominationId');
      const levels = await Level.find({ formId: actualFormId }).sort({ levelNumber: 1 });
      const reviews = await Review.find({ submission_id: { $in: submissions.map(s => s._id) } }).populate('reviewer_id', 'name');

      const subData = submissions.map(s => {
        const subReviews = reviews.filter(r => r.submission_id.toString() === s._id.toString());
        
        // Return actual review details for each level
        const levelReviews = subReviews.map(r => ({
          level: r.level,
          status: r.status,
          overall_score: r.overall_score,
          recommendation: r.recommendation,
          reviewer_id: r.reviewer_id,
          reviewer_name: (r.reviewer_id as any)?.name || 'Reviewer',
          question_scores: r.question_scores,
          id: r._id
        }));

        return {
          ...s.toObject(),
          id: s._id,
          user_name: s.userName,
          user_email: s.userEmail,
          score: s.score?.percentage,
          highest_level: subReviews.length > 0 ? Math.max(...subReviews.map(r => r.level)) : 0,
          level_reviews: levelReviews
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
    const { action, form_id, level_id, filter_type, filter_value, reviewer_ids, field_id, field_value, field_filters, submission_ids, show_previous_reviews } = req.body;
    
    if (action !== 'create-shortlist') return res.status(400).json({ error: 'Invalid action' });

    let level = await Level.findById(level_id);
    if (!level && !level_id) {
        // Fallback: if level doesn't exist, we might be creating it here
        const { level_number, name, scoring_type, assignment_type, section_id, blind_review } = req.body;
        const normalizedLevelNumber = Number(level_number) || 1;
        level = await Level.create({
            formId: form_id,
            levelNumber: normalizedLevelNumber,
            name: name || `Level ${normalizedLevelNumber}`,
            scoringType: scoring_type,
            assignmentType: assignment_type,
            sectionId: section_id,
            blindReview: blind_review,
            showPreviousReviews: normalizedLevelNumber === 1 ? false : !!show_previous_reviews,
            assignedReviewers: reviewer_ids
        });
    }

    if (!level) return res.status(404).json({ error: 'Level not found' });

    let actualFormId = form_id;
    if (!mongoose.Types.ObjectId.isValid(form_id)) {
      const form = await Form.findOne({ shareableLink: form_id as string });
      if (!form) return res.status(404).json({ error: 'Form not found' });
      actualFormId = form._id;
    }

    const isFinalizedReviewStatus = (status: any) => ['approved', 'rejected', 'completed'].includes(String(status));
    const groupReviewsByReviewer = (reviews: any[]) => {
      const grouped = new Map<string, any[]>();
      for (const review of reviews) {
        const reviewerKey = String((review as any).reviewer_id || '');
        const list = grouped.get(reviewerKey) || [];
        list.push(review);
        grouped.set(reviewerKey, list);
      }
      return grouped;
    };

    let query: any = { formId: actualFormId, isDraft: false };
    
    // NEW: If explicit submission_ids are provided, use them
    if (Array.isArray(submission_ids) && submission_ids.length > 0) {
      query._id = { $in: submission_ids };
    } else {
      // Filter by recommendations for Next Level
      if (filter_type === 'next_level_only') {
        const { source_level_id } = req.body;
        if (source_level_id) {
          const sourceLevel = await Level.findById(source_level_id);
          if (!sourceLevel) {
            return res.status(400).json({ error: 'Invalid source_level_id' });
          }

          const levelReviews = await Review.find({ level_id: source_level_id });
          const groupedBySubmission = new Map<string, any[]>();
          for (const review of levelReviews) {
            const key = String(review.submission_id);
            const list = groupedBySubmission.get(key) || [];
            list.push(review);
            groupedBySubmission.set(key, list);
          }

          const eligibleSubmissionIds: string[] = [];
          for (const [submissionId, reviewsAtLevel] of groupedBySubmission.entries()) {
            const reviewerGroups = groupReviewsByReviewer(reviewsAtLevel);
            const allReviewed = Array.from(reviewerGroups.values()).every((reviewerRows) =>
              reviewerRows.some((r: any) => isFinalizedReviewStatus(r.status))
            );
            const hasNextLevelRecommendation = Array.from(reviewerGroups.values()).some((reviewerRows) =>
              reviewerRows.some((r: any) => isFinalizedReviewStatus(r.status) && r.recommendation === 'next_level')
            );
            if (allReviewed && hasNextLevelRecommendation) {
              eligibleSubmissionIds.push(submissionId);
            }
          }

          query._id = { $in: eligibleSubmissionIds };
        } else {
          const nextLevelReviews = await Review.find({ recommendation: 'next_level', status: { $in: ['approved', 'completed'] } });
          const subIds = [...new Set(nextLevelReviews.map(r => r.submission_id))];
          query._id = { $in: subIds };
        }
      } else if (filter_type === 'form_score_gte') {
        query['score.percentage'] = { $gte: parseFloat(filter_value) };
      }
    }
    
    const submissions = await Submission.find(query);
    const normalize = (value: any) => String(value ?? '').trim().toLowerCase();
    const isFinalizedReview = (status: any) => ['approved', 'rejected', 'completed'].includes(String(status));
    const previousLevelNumber = Number(level.levelNumber) - 1;
    let previousLevel: any = null;
    if (previousLevelNumber >= 1) {
      previousLevel = await Level.findOne({ formId: level.formId, levelNumber: previousLevelNumber });
      if (!previousLevel) {
        return res.status(400).json({ error: `Previous level (L${previousLevelNumber}) not found` });
      }
    }
    
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
    let reviewerIndex = 0;

    for (const sub of submissions) {
      if (!matchesFieldFilters(sub)) continue;

      // Hard rule: for L2+ this submission can move only when previous level is fully reviewed.
      if (previousLevel) {
        const prevLevelReviews = await Review.find({
          submission_id: sub._id,
          level: previousLevel.levelNumber
        });

        if (prevLevelReviews.length === 0) continue;

        const reviewerGroups = groupReviewsByReviewer(prevLevelReviews);
        const allPrevReviewed = Array.from(reviewerGroups.values()).every((reviewerRows) =>
          reviewerRows.some((r: any) => isFinalizedReviewStatus(r.status))
        );
        const hasNextLevelRecommendation = Array.from(reviewerGroups.values()).some((reviewerRows) =>
          reviewerRows.some((r: any) => isFinalizedReviewStatus(r.status) && r.recommendation === 'next_level')
        );
        if (!allPrevReviewed || !hasNextLevelRecommendation) continue;
      }

      // Check if already shortlisted for this level
      const existing = await Review.findOne({ submission_id: sub._id, level_id: level._id });
      if (existing) continue;

      shortlistedCount++;
      
      if (level.assignmentType === 'divide_sections') {
        // Round-robin assignment of candidates to reviewers
        const rid = reviewer_ids[reviewerIndex % reviewer_ids.length];
        await Review.create({
          submission_id: sub._id,
          reviewer_id: rid,
          level: level.levelNumber,
          level_id: level._id,
          status: 'pending'
        });
        reviewsCreated++;
        reviewerIndex++;
      } else {
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

    const reviews = await Review.find(query)
      .populate('level_id', 'scoringType showPreviousReviews')
      .populate('reviewer_id', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(reviews.map(r => {
      const obj = r.toObject();
      return {
        ...obj,
        id: obj._id,
        submission_id: obj.submission_id,
        reviewer_name: (obj.reviewer_id as any)?.name || 'Reviewer',
        scoring_type: (obj.level_id as any)?.scoringType || 'form_level',
        show_previous_reviews: (obj.level_id as any)?.showPreviousReviews || false
      };
    }));
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
    const normalizedOverallScore = Number(overall_score) || 0;
    if (normalizedOverallScore < 0 || normalizedOverallScore > 100) {
      return res.status(400).json({ error: 'Overall score must be between 0 and 100' });
    }

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
      overall_score: normalizedOverallScore,
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
