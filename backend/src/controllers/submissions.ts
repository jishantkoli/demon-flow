import { Request, Response } from 'express';
import { Submission } from '../models/Submission.js';
import { Form } from '../models/Form.js';
import { Nomination } from '../models/Nomination.js';
import { AuthRequest } from '../middleware/auth.js';

export const submitForm = async (req: AuthRequest, res: Response) => {
  try {
    let { form_id, formId, responses } = req.body;
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

    // Check authorization for teachers
    if (req.user && req.user.role === 'teacher') {
      const nomination = await Nomination.findOne({
        form_id: form._id,
        teacher_email: { $regex: new RegExp(`^${req.user.email}$`, 'i') }
      });
      if (!nomination) {
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

    const submission = await Submission.findByIdAndUpdate(id, {
      ...req.body,
      responses: responses || req.body.responses,
      isDraft: is_draft !== undefined ? is_draft : req.body.isDraft
    }, { new: true });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    res.status(200).json({ ...submission.toObject(), id: submission._id, is_draft: submission.isDraft });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const { formId, form_id, user_id } = req.query;
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

    if (req.user) {
      if (req.user.role === 'teacher') {
        query.userId = req.user._id;
      }
    } else {
      // Anonymous users can only see their own submissions if we had a session, 
      // but for now they see nothing to protect privacy.
      if (!actualFormId) return res.status(200).json([]);
      query.userId = null; // Only show anonymous submissions for this form? No, still risky.
      return res.status(200).json([]); 
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
