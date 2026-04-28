import { Request, Response } from 'express';
import { Form } from '../models/Form.js';
import { Nomination } from '../models/Nomination.js';
import { AuthRequest } from '../middleware/auth.js';

export const getForms = async (req: AuthRequest, res: Response) => {
  try {
    const { status, id } = req.query;
    const query: any = {};
    if (id) {
      let form;
      if (id.toString().match(/^[0-9a-fA-F]{24}$/)) {
        form = await Form.findById(id);
      } else {
        form = await Form.findOne({ shareableLink: id as string });
      }
      
      if (!form) return res.status(404).json({ error: 'Form not found' });

      // If user is a teacher, verify they are nominated for this form
      if (req.user && req.user.role === 'teacher') {
        const nomination = await Nomination.findOne({
          form_id: form._id,
          teacher_email: { $regex: new RegExp(`^${req.user.email}$`, 'i') }
        });
        if (!nomination) {
          return res.status(403).json({ error: 'You are not authorized to access this form. Please contact your school functionary for assignment.' });
        }
      }

      return res.status(200).json({ ...form.toObject(), id: form._id });
    }

    if (status) query.status = status;
    
    // Admins see all, others see active by default
    if (!req.user || req.user.role !== 'admin') {
      query.status = 'active';
    }

    // Teachers only see forms they are nominated for
    if (req.user && req.user.role === 'teacher') {
      const userEmail = req.user.email;
      const nominations = await Nomination.find({ 
        teacher_email: { $regex: new RegExp(`^${userEmail}$`, 'i') } 
      });
      const assignedFormIds = nominations.map(n => n.form_id);
      query._id = { $in: assignedFormIds };
    }

    const forms = await Form.find(query).sort({ createdAt: -1 });
    const mapped = forms.map(f => ({ 
      ...f.toObject(), 
      id: f._id,
      form_type: f.formType,
      shareable_link: f.shareableLink,
      expires_at: f.expiresAt
    }));
    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getFormByLink = async (req: Request, res: Response) => {
  try {
    const { link } = req.params;
    const form = await Form.findOne({ shareableLink: link });
    
    if (!form) return res.status(404).json({ error: 'Form not found' });
    if (form.status === 'draft') return res.status(403).json({ error: 'Form is not yet published' });
    
    // Check expiration
    const isExpired = form.expiresAt && new Date() > form.expiresAt;

    res.status(200).json({ 
      ...form.toObject(), 
      id: form._id, 
      form_type: form.formType,
      shareable_link: form.shareableLink,
      expires_at: form.expiresAt,
      isExpired 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};



export const createForm = async (req: AuthRequest, res: Response) => {
  try {
    const { action, form_id } = req.body;

    // Handle cloning
    if (action === 'clone' && form_id) {
      const original = await Form.findById(form_id);
      if (!original) return res.status(404).json({ error: 'Original form not found' });

      const cloneData = original.toObject();
      delete cloneData._id;
      delete cloneData.createdAt;
      delete cloneData.updatedAt;
      cloneData.title = `${cloneData.title} (Clone)`;
      cloneData.status = 'draft';
      cloneData.shareableLink = Math.random().toString(36).substring(2, 10);
      cloneData.adminId = req.user._id;

      const clonedForm = await Form.create(cloneData);
      return res.status(201).json({ 
        success: true, 
        data: { ...clonedForm.toObject(), id: clonedForm._id, form_type: clonedForm.formType } 
      });
    }

    const data = { ...req.body };
    if (typeof data.settings === 'string') {
      try { data.settings = JSON.parse(data.settings); } catch {}
    }
    if (typeof data.schema === 'string') {
      try { data.form_schema = JSON.parse(data.schema); } catch {}
    } else if (typeof data.fields === 'string') {
      // Backwards compatibility if old payload hits
      try { data.form_schema = { sections: [{ id: 's1', title: 'Default', fields: JSON.parse(data.fields) }] }; } catch {}
    } else if (data.schema) {
      data.form_schema = data.schema;
    }
    if (data.form_type) { data.formType = data.form_type; delete data.form_type; }
    if (data.expires_at) { data.expiresAt = data.expires_at; delete data.expires_at; }
    if (data.slug) {
      data.shareableLink = data.slug;
    } else {
      data.shareableLink = Math.random().toString(36).substring(2, 10);
    }
    
    const form = await Form.create({
      ...data,
      adminId: req.user._id,
    });
    res.status(201).json({ success: true, data: { ...form.toObject(), schema: form.form_schema, id: form._id, form_type: form.formType, slug: form.shareableLink } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateForm = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id || req.body.id;
    if (!id) return res.status(400).json({ error: 'Form ID required' });
    
    const updates = { ...req.body };
    delete updates.id;
    if (typeof updates.settings === 'string') {
      try { updates.settings = JSON.parse(updates.settings); } catch {}
    }
    if (typeof updates.schema === 'string') {
      try { updates.form_schema = JSON.parse(updates.schema); } catch {}
    } else if (updates.schema) {
      updates.form_schema = updates.schema;
    }
    if (updates.form_type) { updates.formType = updates.form_type; delete updates.form_type; }
    if (updates.expires_at) { updates.expiresAt = updates.expires_at; delete updates.expires_at; }
    if (updates.slug) { updates.shareableLink = updates.slug; }
    
    const form = await Form.findByIdAndUpdate(id, updates, { new: true });
    if (!form) return res.status(404).json({ error: 'Form not found' });
    res.status(200).json({ success: true, data: { ...form.toObject(), schema: form.form_schema } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteForm = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Form ID required' });
    const form = await Form.findByIdAndDelete(id);
    if (!form) return res.status(404).json({ error: 'Form not found' });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
