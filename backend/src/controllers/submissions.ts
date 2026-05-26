import { Request, Response } from 'express';
import { Submission } from '../models/Submission.js';
import { Form } from '../models/Form.js';
import { Review } from '../models/Review.js';
import { Nomination } from '../models/Nomination.js';
import { AuthRequest } from '../middleware/auth.js';
import { escapeRegex } from '../utils/escape.js';

export const submitForm = async (req: AuthRequest, res: Response) => {
  try {
    let { form_id, formId, responses } = req.body;
    const rawNominationId = req.body.nomination_id || req.body.nominationId;
    const actualFormId = form_id || formId || req.body.formId;
    
    // Convert object responses to array if needed
    if (responses && !Array.isArray(responses)) {
      responses = Object.entries(responses).map(([fieldId, value]) => ({ fieldId, value }));
    }
    
    if (!responses) responses = [];
    
    if (!actualFormId) {
      console.log('Submission failed: No formId provided in request body');
      return res.status(400).json({ error: 'formId is required' });
    }

    let form;
    if (actualFormId.toString().match(/^[0-9a-fA-F]{24}$/)) {
      form = await Form.findById(actualFormId);
    } else {
      form = await Form.findOne({ shareableLink: actualFormId });
    }

    if (!form) {
      console.log('Submission failed: Form not found with ID/Link', actualFormId, 'from payload', req.body);
      return res.status(404).json({ error: 'Form not found' });
    }

    const formSettings = typeof form.settings === 'string'
      ? (() => { try { return JSON.parse(form.settings); } catch { return {}; } })()
      : (form.settings || {});

    if (formSettings.functionary_only && req.user?.role !== 'functionary') {
      return res.status(403).json({ error: 'This form can only be filled by a school functionary.' });
    }

    // ─── NOMINATION LINKING (3-layer: ID → Token → Email) ───────────────
    let linkedNomination: any = null;

    // Layer 1: Direct nomination ID (if frontend sent it)
    if (rawNominationId) {
      try {
        linkedNomination = await Nomination.findById(rawNominationId);
      } catch (e) {
        console.log('Nomination ID lookup failed (invalid ID format):', rawNominationId);
      }
    }

    // Layer 2: Nomination token from URL (MOST RELIABLE - 1 token = 1 nomination)
    const nominationToken = req.body.nomination_token;
    if (!linkedNomination && nominationToken) {
      // First try exact match on unique_token
      linkedNomination = await Nomination.findOne({ unique_token: nominationToken });
      // If not found, try matching by token field (some systems store it as just 'token')
      if (!linkedNomination) {
        linkedNomination = await Nomination.findOne({ token: nominationToken });
      }
      if (linkedNomination) {
        console.log('✅ Nomination linked via TOKEN:', nominationToken, '→', linkedNomination._id);
      } else {
        console.log('❌ Token not found in any nomination:', nominationToken);
      }
    }

    // Layer 3: Email + form_id fallback (works for OTP and login flows)
    const searchEmail = req.body.user_email || req.user?.email;
    if (!linkedNomination && searchEmail) {
      linkedNomination = await Nomination.findOne({
        form_id: form._id,
        teacher_email: { $regex: new RegExp(`^${escapeRegex(String(searchEmail).trim())}$`, 'i') }
      });
      if (linkedNomination) {
        console.log('✅ Nomination linked via EMAIL:', searchEmail, '→', linkedNomination._id);
      }
    }

    if (linkedNomination) {
      console.log('✅ Final linked nomination:', linkedNomination._id, 'teacher:', linkedNomination.teacher_email);
    } else {
      console.log('ℹ️ No nomination found for this submission (form:', form._id, 'email:', searchEmail, ')');
    }

    // Expiration check
    if (form.expiresAt && new Date() > form.expiresAt) {
      return res.status(403).json({ error: 'This form has expired' });
    }

    // Scoring for Quizzes
    let score = null;
    let earnedPoints = 0;
    let totalPoints = 0;
    
    // ALWAYS calculate score on backend for security and accuracy
    if (form.form_schema && (form.form_schema.sections || form.form_schema.fields || Array.isArray(form.form_schema))) {
      const getOptionValue = (opt: any): any => typeof opt === 'object' && opt !== null ? (opt.value ?? opt.label) : opt;
      const getOptionLabel = (opt: any): string => typeof opt === 'object' && opt !== null ? (opt.label ?? opt.value) : String(opt);
      
      const toOptionText = (raw: any, options: any[] = []) => {
        if (raw === undefined || raw === null) return raw;
        const rawStr = String(raw).trim();
        const optByValue = options.find(o => String(getOptionValue(o)) === rawStr);
        if (optByValue) return getOptionLabel(optByValue);
        if (typeof raw === 'number' && options[raw] !== undefined) return getOptionLabel(options[raw]);
        const n = Number(String(raw));
        if (!Number.isNaN(n) && String(raw).trim() !== '' && options[n] !== undefined) return getOptionLabel(options[n]);
        return raw;
      };

      const processFields = (fields: any[]) => {
        if (!Array.isArray(fields)) return;
        fields.forEach((field: any) => {
          if (field.type === 'mcq' && field.correct !== undefined) {
            const qMarks = field.points ?? field.marks ?? 1;
            totalPoints += qMarks;
            const resp = responses.find((r: any) => r.fieldId === field.id);
            if (resp) {
              const options = Array.isArray(field.options) ? field.options : [];
              const ansText = toOptionText(resp.value, options);
              const corrText = toOptionText(field.correct, options);

              if (String(ansText).trim() === String(corrText).trim()) {
                earnedPoints += qMarks;
              } else if (field.negative && field.negative < 0) {
                earnedPoints += Number(field.negative);
              }
            }
          }
          if (field.children) processFields(field.children);
        });
      };

      if (form.form_schema.sections) {
        form.form_schema.sections.forEach((sec: any) => processFields(sec.fields));
      } else if (form.form_schema.fields) {
        processFields(form.form_schema.fields);
      } else if (Array.isArray(form.form_schema)) {
        processFields(form.form_schema);
      }

      if (totalPoints > 0) {
        earnedPoints = Math.max(0, earnedPoints);
        const percentage = (earnedPoints / totalPoints) * 100;
        score = {
          earnedPoints,
          totalPoints,
          percentage,
          passed: percentage >= (form.settings?.passing_score || 0)
        };
      }
    }

    const submissionData: any = {
      formId: form._id,
      nominationId: linkedNomination?._id || null,
      nominationToken: req.body.nomination_token || null,
      userId: req.user?._id || null,
      userName: req.body.user_name || req.user?.profile?.fullName,
      userEmail: req.body.user_email || req.user?.email || linkedNomination?.teacher_email,
      schoolCode: req.body.school_code || linkedNomination?.school_code || req.user?.profile?.schoolCode,
      formTitle: req.body.form_title || form.title,
      responses,
      score,
      status: req.body.status || 'pending',
      isDraft: req.body.is_draft || false,
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    };

    console.log('📋 Submission data:', { formId: submissionData.formId, nominationId: submissionData.nominationId, userEmail: submissionData.userEmail, schoolCode: submissionData.schoolCode });

    // Check for existing non-draft submission to prevent duplicates
    if (!submissionData.isDraft) {
      const existingSub = await Submission.findOne({
        formId: form._id,
        userEmail: { $regex: new RegExp(`^${escapeRegex(String(submissionData.userEmail || '').trim())}$`, 'i') },
        isDraft: false
      });

      if (existingSub) {
        // Update existing instead of creating new
        const updated = await Submission.findByIdAndUpdate(existingSub._id, submissionData, { new: true });
        return res.status(200).json({ ...updated!.toObject(), id: updated!._id, is_duplicate: true });
      }
    }

    const submission = await Submission.create(submissionData);

    // Update nomination status to 'completed' after successful non-draft submission
    if (linkedNomination && !submissionData.isDraft) {
      try {
        await Nomination.findByIdAndUpdate(linkedNomination._id, { status: 'completed' });
      } catch (e) {
        console.error('Failed to update nomination status:', e);
      }
    }

    res.status(201).json({ ...submission.toObject(), id: submission._id, is_draft: submission.isDraft, school_code: submission.schoolCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSubmission = async (req: AuthRequest, res: Response) => {
  try {
    let { id, is_draft, responses } = req.body;

    if (responses && !Array.isArray(responses)) {
      responses = Object.entries(responses).map(([fieldId, value]) => ({ fieldId, value }));
    }

    const existingSub = await Submission.findById(id);
    if (!existingSub) return res.status(404).json({ error: 'Submission not found' });

    const existingForm = await Form.findById(existingSub.formId);
    const existingFormSettings = typeof existingForm?.settings === 'string'
      ? (() => { try { return JSON.parse(existingForm.settings); } catch { return {}; } })()
      : (existingForm?.settings || {});

    if (existingFormSettings.functionary_only && req.user?.role !== 'functionary') {
      return res.status(403).json({ error: 'This form can only be filled by a school functionary.' });
    }

    // ─── NOMINATION LINKING ON UPDATE (if not already linked) ─────────────
    let nominationId = req.body.nomination_id || req.body.nominationId;
    let nominationToken = req.body.nomination_token;

    // Only try to link if not already linked
    if (!existingSub?.nominationId && (nominationId || nominationToken)) {
      let linkedNom: any = null;

      // Try by nomination ID first
      if (nominationId) {
        try {
          linkedNom = await Nomination.findById(nominationId);
        } catch {}
      }

      // Try by token
      if (!linkedNom && nominationToken) {
        linkedNom = await Nomination.findOne({ unique_token: nominationToken });
        if (!linkedNom) {
          linkedNom = await Nomination.findOne({ token: nominationToken });
        }
      }

      if (linkedNom) {
        console.log('✅ Nomination linked during update:', linkedNom._id);
        nominationId = linkedNom._id;
        nominationToken = linkedNom.unique_token || nominationToken;
      }
    }

    const payload: any = {
      ...req.body,
      responses: responses || req.body.responses,
      isDraft: is_draft !== undefined ? is_draft : req.body.isDraft
    };
    if (nominationId) {
      payload.nominationId = nominationId;
    }
    if (nominationToken !== undefined) {
      payload.nominationToken = nominationToken;
    }

    const submission = await Submission.findByIdAndUpdate(id, payload, { new: true });

    // Update nomination status if submitting (not drafting)
    if (submission.nominationId && is_draft === false) {
      try {
        await Nomination.findByIdAndUpdate(submission.nominationId, { status: 'completed' });
      } catch (e) {
        console.error('Failed to update nomination status:', e);
      }
    }

    res.status(200).json({ ...submission.toObject(), id: submission._id, is_draft: submission.isDraft });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const { formId, form_id, user_id, user_email, status, school_code, search, level, shortlisted_only, ...rest } = req.query;
    const actualFormId = formId || form_id;
    const query: any = {};

    if (actualFormId) {
      if (actualFormId.toString().match(/^[0-9a-fA-F]{24}$/)) {
        query.formId = actualFormId;
      } else {
        const f = await Form.findOne({ shareableLink: actualFormId as string });
        if (f) query.formId = f._id;
        else return res.status(200).json([]);
      }
    }

    if (user_id) query.userId = user_id;
    if (user_email) query.userEmail = { $regex: new RegExp(`^${escapeRegex(String(user_email))}$`, 'i') };
    if (status) query.status = status;
    if (school_code) query.schoolCode = { $regex: new RegExp(`^${escapeRegex(String(school_code))}$`, 'i') };
    
    // Support multiple levels (comma separated)
    if (level !== undefined && level !== '') {
      const levelStr = String(level);
      if (levelStr.includes(',')) {
        query.currentLevel = { $in: levelStr.split(',').map(Number) };
      } else {
        query.currentLevel = Number(level);
      }
    }

    // Filter by Shortlisted candidates at a specific level
    if (shortlisted_only === 'true' && level !== undefined && level !== '') {
      const shortlistedReviews = await Review.find({
        level: Number(level),
        recommendation: 'next_level'
      });
      const shortlistedSubIds = shortlistedReviews.map(r => r.submission_id);
      if (!query.$and) query.$and = [];
      query.$and.push({ _id: { $in: shortlistedSubIds } });
    }

    // Search in multiple fields (Global Super Search)
    if (search) {
      const searchRegex = { $regex: new RegExp(escapeRegex(String(search)), 'i') };
      const searchOr = [
        { userName: searchRegex },
        { userEmail: searchRegex },
        { schoolCode: searchRegex },
        { formTitle: searchRegex },
        { 
          responses: { 
            $elemMatch: { 
              value: { $regex: new RegExp(escapeRegex(String(search)), 'i') } 
            } 
          } 
        }
      ];
      if (!query.$and) query.$and = [];
      query.$and.push({ $or: searchOr });
    }

    // Advanced Field Filtering (Filter by answers inside responses)
    // Supports query like ?field:dept=Primary&field:level=2
    const fieldFilters: any[] = [];
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('field:')) {
        const fieldId = key.replace('field:', '');
        const val = req.query[key];
        if (val) {
          fieldFilters.push({
            responses: {
              $elemMatch: {
                fieldId,
                value: { $regex: new RegExp(escapeRegex(String(val)), 'i') }
              }
            }
          });
        }
      }
    });

    if (fieldFilters.length > 0) {
      if (!query.$and) query.$and = [];
      query.$and.push(...fieldFilters);
    }

    if (req.user) {
      if (req.user.role === 'teacher') {
        // Teachers see submissions matching their ID OR their email
        const teacherOr = [
          { userId: req.user._id },
          { userEmail: { $regex: new RegExp(`^${escapeRegex(req.user.email)}$`, 'i') } }
        ];
        if (!query.$and) query.$and = [];
        query.$and.push({ $or: teacherOr });
      } else if (req.user.role === 'functionary') {
        const myNominations = await Nomination.find({ functionary_id: req.user._id });
        const teacherEmails = myNominations.map(n => n.teacher_email).filter(Boolean);
        const teacherEmailRegexes = teacherEmails.map(email => new RegExp(`^${escapeRegex(email)}$`, 'i'));

        if (query.formId) {
          const f = await Form.findById(query.formId).select('settings');
          const settings = typeof f?.settings === 'string'
            ? (() => { try { return JSON.parse(f.settings); } catch { return {}; } })()
            : (f?.settings || {});

          if (settings.functionary_only) {
            query.userEmail = { $regex: new RegExp(`^${escapeRegex(req.user.email)}$`, 'i') };
          } else {
            // Functionaries see submissions for teachers they nominated
            query.userEmail = { $in: teacherEmailRegexes };
          }
        } else {
          const functionaryOnlyForms = await Form.find({ 'settings.functionary_only': true }).select('_id');
          const functionaryOnlyFormIds = functionaryOnlyForms.map(f => f._id);

          const scoped: any[] = [];
          if (teacherEmailRegexes.length) {
            scoped.push({ userEmail: { $in: teacherEmailRegexes } });
          }
          if (functionaryOnlyFormIds.length) {
            scoped.push({
              userEmail: { $regex: new RegExp(`^${escapeRegex(req.user.email)}$`, 'i') },
              formId: { $in: functionaryOnlyFormIds }
            });
          }

          if (!query.$and) query.$and = [];
          query.$and.push({ $or: scoped.length ? scoped : [{ _id: null }] });
        }
      } else if (req.user.role === 'reviewer' && req.query.reviewed_by_me === 'true') {
        // Reviewers can filter for only submissions they have personally reviewed
        const myReviews = await Review.find({ reviewer_id: req.user._id });
        const mySubmissionIds = myReviews.map(r => r.submission_id);
        query._id = { $in: mySubmissionIds };
      }
    } else {
      // For truly anonymous requests (before OTP), we can only filter by email if provided
      // and only if the form is found. But to be safe, we only allow this if user_email is explicitly requested.
      if (!user_email) return res.status(200).json([]);
      query.userEmail = { $regex: new RegExp(`^${escapeRegex(String(user_email))}$`, 'i') };
    }

    const submissions = await Submission.find(query)
      .populate('nominationId')
      .sort({ createdAt: -1 });

    // Fetch reviews for these submissions if requested or if admin/reviewer
    const includeReviews = (req.user?.role === 'admin' || req.user?.role === 'reviewer');
    const submissionIds = submissions.map(s => s._id);
    const allReviews = includeReviews ? await Review.find({ submission_id: { $in: submissionIds } }) : [];
      
    const mapped = submissions.map(s => {
      const obj = s.toObject();
      const subReviews = allReviews.filter(r => r.submission_id.toString() === obj._id.toString());
      
      // Extract the specific review by the current user if they are a reviewer
      const myReview = (req.user?.role === 'reviewer')
        ? subReviews.find(r => r.reviewer_id.toString() === req.user?._id.toString())
        : null;
      
      return {
        ...obj,
        id: obj._id,
        form_id: obj.formId,
        user_id: obj.userId,
        user_name: obj.userName,
        user_email: obj.userEmail,
        nomination_id: obj.nominationId,
        nomination_token: obj.nominationToken || (obj.nominationId as any)?.unique_token || null,
        unique_token: obj.nominationToken || (obj.nominationId as any)?.unique_token || null,
        form_title: obj.formTitle,
        submitted_at: obj.createdAt,
        is_draft: obj.isDraft,
        level_reviews: subReviews.map(r => ({
          level: r.level,
          overall_score: r.overall_score,
          grade: r.grade,
          recommendation: r.recommendation,
          comments: r.comments,
          reviewer_id: r.reviewer_id
        })),
        my_review: myReview ? {
          overall_score: myReview.overall_score,
          grade: myReview.grade,
          comments: myReview.comments,
          level: myReview.level,
          recommendation: myReview.recommendation,
          reviewed_at: myReview.reviewed_at
        } : null
      };
    });
      
    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};


export const getSubmissionById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const submission = await Submission.findById(id).populate('formId');
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    
    // Privacy: Teachers only see own
    if (req.user) {
      if (req.user.role === 'teacher' && submission.userId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }
      // Admins and Reviewers are allowed to see any submission
    } else {
      // Anonymous users can only see anonymous submissions
      if (submission.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.status(200).json({ success: true, data: submission });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
