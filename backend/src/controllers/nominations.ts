import { Request, Response } from 'express';
import { Nomination } from '../models/Nomination.js';
import { User } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.js';
import { sendEmail } from '../utils/email.js';
import { SystemSetting } from '../models/SystemSetting.js';

const sendNominationEmails = async (nomination: any, headUser: any) => {
  try {
    const settings = await SystemSetting.findOne({ key: 'email_settings' });
    if (!settings || !settings.value || !settings.value.templates) return;

    const { teacher_template, head_template } = settings.value.templates;
    const publicUrl = process.env.PUBLIC_URL || 'http://127.0.0.1:5173';
    const nominationLink = `${publicUrl}/fill/${nomination.form_id}?token=${nomination.unique_token}`;

    // Helper to replace placeholders
    const replace = (tpl: string) => tpl
      .replace(/{{teacher_name}}/g, nomination.teacher_name)
      .replace(/{{head_name}}/g, headUser.profile?.fullName || headUser.email)
      .replace(/{{form_link}}/g, nominationLink)
      .replace(/{{school_code}}/g, nomination.school_code);

    // Send to Teacher
    if (teacher_template && nomination.teacher_email) {
      await sendEmail(
        nomination.teacher_email,
        teacher_template.subject || 'You have been nominated!',
        replace(teacher_template.body || '')
      );
    }

    // Send to Head
    if (head_template && headUser.email) {
      await sendEmail(
        headUser.email,
        head_template.subject || 'Nomination Successful',
        replace(head_template.body || '')
      );
    }
  } catch (err) {
    console.error('Email sending failed:', err);
  }
};

const ensureTeacherUser = async (teacherData: any) => {
  const email = teacherData.teacher_email?.toLowerCase().trim();
  if (!email) return;

  const existingUser = await User.findOne({ email });
  if (!existingUser) {
    await User.create({
      email,
      role: 'teacher',
      profile: {
        fullName: teacherData.teacher_name || 'Teacher',
        phone: teacherData.teacher_phone || '',
        schoolCode: teacherData.school_code || ''
      }
    });
  }
};

export const getNominations = async (req: AuthRequest, res: Response) => {
  try {
    const { functionary_id, form_id, teacher_email } = req.query;
    const query: any = {};
    if (functionary_id) query.functionary_id = functionary_id;
    if (form_id) query.form_id = form_id;
    if (teacher_email) {
      query.teacher_email = { $regex: new RegExp(`^${teacher_email}$`, 'i') };
    }
    
    // Admins can see all
    // If specific form_id AND teacher_email are provided (usually for linking a submission), allow access
    // Otherwise, restrict by role
    if (req.user.role === 'admin') {
      // No filter
    } else if (form_id && teacher_email) {
      // Allow lookup for linking submissions
    } else if (req.user.role === 'functionary') {
      query.functionary_id = req.user._id;
    } else if (req.user.role === 'teacher') {
      query.teacher_email = { $regex: new RegExp(`^${req.user.email}$`, 'i') };
    }

    const nominations = await Nomination.find(query)
      .populate('functionary_id', 'profile.fullName email')
      .sort({ createdAt: -1 });
    const mapped = nominations.map(n => {
      const obj = n.toObject();
      return { 
        ...obj, 
        id: obj._id,
        functionary_name: (obj.functionary_id as any)?.profile?.fullName || (obj.functionary_id as any)?.email || 'Unknown'
      };
    });
    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createNomination = async (req: AuthRequest, res: Response) => {
  try {
    const { action, nominations } = req.body;

    if (action === 'bulk-nominate' && Array.isArray(nominations)) {
      const created = await Nomination.insertMany(nominations);
      // Create user accounts and send emails for each nominated teacher
      for (const nom of created) {
        await ensureTeacherUser(nom);
        await sendNominationEmails(nom, req.user);
      }
      return res.status(201).json({ success: true, count: created.length });
    }

    const nomination = await Nomination.create({
      ...req.body,
      functionary_id: req.user._id, // Ensure functionary_id is set to the current user
    });

    // Create user account for the nominated teacher
    await ensureTeacherUser(req.body);

    // Send Emails in background so it doesn't block the response
    sendNominationEmails(nomination, req.user).catch(err => console.error('Background email failed:', err));

    res.status(201).json({ success: true, data: { ...nomination.toObject(), id: nomination._id } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateNomination = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id || req.body.id;
    if (!id) return res.status(400).json({ error: 'Nomination ID required' });
    
    const updates = { ...req.body };
    delete updates.id;
    
    const nomination = await Nomination.findByIdAndUpdate(id, updates, { new: true });
    if (!nomination) return res.status(404).json({ error: 'Nomination not found' });
    res.status(200).json({ success: true, data: { ...nomination.toObject(), id: nomination._id } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteNomination = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Nomination ID required' });
    const nomination = await Nomination.findByIdAndDelete(id);
    if (!nomination) return res.status(404).json({ error: 'Nomination not found' });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
export const getNominationByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const nomination = await Nomination.findOne({ unique_token: token }).populate('form_id');
    if (!nomination) return res.status(404).json({ error: 'Nomination link invalid or expired' });
    
    res.status(200).json({ 
      success: true, 
      data: {
        ...nomination.toObject(),
        id: nomination._id,
        form: nomination.form_id // This is now the populated form object
      } 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
