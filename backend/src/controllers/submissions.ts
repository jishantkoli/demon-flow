import { Request, Response } from 'express';
import { Submission } from '../models/Submission.js';
import { Form } from '../models/Form.js';
import { Nomination } from '../models/Nomination.js';
import { AuthRequest } from '../middleware/auth.js';

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

    let linkedNomination: any = null;
    if (rawNominationId) {
      linkedNomination = await Nomination.findById(rawNominationId);
      if (!linkedNomination) {
        return res.status(404).json({ error: 'Linked nomination not found' });
      }
      if (linkedNomination.form_id?.toString() !== form._id.toString()) {
        return res.status(400).json({ error: 'Linked nomination does not belong to this form' });
      }
    }

    // Prevention of duplicate submissions/drafts:
    // If no ID is provided, check if a draft already exists for this form and email
    const userEmail = req.body.user_email || req.user?.email;
    if (userEmail && (req.body.is_draft || req.body.status === 'draft')) {
      const existingDraft = await Submission.findOne({
        formId: form._id,
        userEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') },
        isDraft: true
      });
      if (existingDraft) {
        // Update the existing draft instead of creating a new one
        existingDraft.responses = responses;
        existingDraft.userName = req.body.user_name || existingDraft.userName;
        existingDraft.schoolCode = req.body.school_code || existingDraft.schoolCode;
        await existingDraft.save();
        return res.status(200).json({ ...existingDraft.toObject(), id: existingDraft._id, is_draft: true });
      }
    }

    // Check authorization for teachers
    if (req.user && req.user.role === 'teacher') {
      if (!linkedNomination) {
        linkedNomination = await Nomination.findOne({
          form_id: form._id,
          teacher_email: { $regex: new RegExp(`^${req.user.email}$`, 'i') }
        });
      }
      const isTeacherMatch = linkedNomination
        ? new RegExp(`^${req.user.email}$`, 'i').test(linkedNomination.teacher_email || '')
        : false;
      if (!linkedNomination || !isTeacherMatch) {
        return res.status(403).json({ error: 'You are not authorized to submit this form. Please contact your school functionary.' });
      }
    }

    // Expiration check
    if (form.expiresAt && new Date() > form.expiresAt) {
      return res.status(403).json({ error: 'This form has expired' });
    }

    // Scoring for Quizzes
    let score = null;
    let earnedPoints = 0;
    let totalPoints = 0;
    
    // Fallback to recalculate if not provided by frontend
    if (req.body.score !== undefined && req.body.score !== null) {
      earnedPoints = req.body.score;
      // Extract max score
      if (form.form_schema && form.form_schema.sections) {
        form.form_schema.sections.forEach((sec: any) => {
          sec.fields?.forEach((f: any) => {
            if (f.type === 'mcq') totalPoints += f.marks || 1;
          });
        });
      }
      const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
      score = {
        earnedPoints,
        totalPoints,
        percentage,
        passed: percentage >= (form.settings?.passing_score || 0)
      };
    } else if (form.form_schema && form.form_schema.sections) {
      form.form_schema.sections.forEach((sec: any) => {
        sec.fields?.forEach((field: any) => {
          if (field.type === 'mcq' && field.correct !== undefined) {
            totalPoints += field.marks || 1;
            const resp = responses.find((r: any) => r.fieldId === field.id);
            if (resp && String(resp.value) === String(field.correct)) {
              earnedPoints += field.marks || 1;
            } else if (resp && form.settings?.negative_marking) {
              earnedPoints -= field.negative || 0;
            }
          }
        });
      });
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

    const submission = await Submission.create({
      formId: form._id,
      userId: req.user?._id || null,
      userName: req.body.user_name || req.user?.profile?.fullName,
      userEmail: req.body.user_email || req.user?.email,
      schoolCode: req.body.school_code || req.user?.profile?.schoolCode,
      nominationId: linkedNomination?._id || undefined,
      formTitle: req.body.form_title || form.title,
      responses,
      score,
      status: req.body.status || 'pending',
      isDraft: req.body.is_draft || false,
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

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

    const payload: any = {
      ...req.body,
      responses: responses || req.body.responses,
      isDraft: is_draft !== undefined ? is_draft : req.body.isDraft
    };
    if (req.body.nomination_id || req.body.nominationId) {
      payload.nominationId = req.body.nomination_id || req.body.nominationId;
    }

    const submission = await Submission.findByIdAndUpdate(id, payload, { new: true });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    res.status(200).json({ ...submission.toObject(), id: submission._id, is_draft: submission.isDraft });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const { formId, form_id, user_id, user_email } = req.query;
    const actualFormId = formId || form_id;
    const query: any = {};
    if (actualFormId) {
      if (actualFormId.toString().match(/^[0-9a-fA-F]{24}$/)) {
        query.formId = actualFormId;
      } else {
        const f = await Form.findOne({ shareableLink: actualFormId as string });
        if (f) query.formId = f._id;
        else return res.status(200).json([]); // Form not found, so no submissions
      }
    }
    if (user_id) query.userId = user_id;
    if (user_email) query.userEmail = { $regex: new RegExp(`^${user_email}$`, 'i') };

    if (req.user) {
      if (req.user.role === 'teacher') {
        // Teachers see submissions matching their ID OR their email
        query.$or = [
          { userId: req.user._id },
          { userEmail: { $regex: new RegExp(`^${req.user.email}$`, 'i') } }
        ];
      } else if (req.user.role === 'functionary') {
        // Functionaries see submissions for teachers they nominated
        const myNominations = await Nomination.find({ functionary_id: req.user._id });
        const teacherEmails = myNominations.map(n => n.teacher_email);
        query.userEmail = { $in: teacherEmails.map(email => new RegExp(`^${email}$`, 'i')) };
      }
    } else {
      // For truly anonymous requests (before OTP), we can only filter by email if provided
      // and only if the form is found. But to be safe, we only allow this if user_email is explicitly requested.
      if (!user_email) return res.status(200).json([]);
      query.userEmail = { $regex: new RegExp(`^${user_email}$`, 'i') };
    }

    const submissions = await Submission.find(query)
      .sort({ createdAt: -1 });
      
    const mapped = submissions.map(s => ({
      ...s.toObject(),
      id: s._id,
      form_id: s.formId,
      user_id: s.userId,
      user_name: s.userName,
      user_email: s.userEmail,
      nomination_id: s.nominationId,
      form_title: s.formTitle,
      submitted_at: s.createdAt,
      is_draft: s.isDraft
    }));
      
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
