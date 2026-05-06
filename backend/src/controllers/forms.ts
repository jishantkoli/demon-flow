import { Request, Response } from 'express';
import { Form } from '../models/Form.js';
import { Nomination } from '../models/Nomination.js';
import { Submission } from '../models/Submission.js';
import { Review } from '../models/Review.js';
import { AuthRequest } from '../middleware/auth.js';
import archiver from 'archiver';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

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
      if (req.user?.role === 'teacher') {
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
    if (req.user?.role !== 'admin') {
      query.status = 'active';
    }

    // Teachers only see forms they are nominated for
    if (req.user?.role === 'teacher') {
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

export const exportZip = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, school_code, search, namingStrategy, subNamingStrategy, fields: fieldsJson, shortlisted_only, level, include_reviews, include_nomination } = req.query;
    const form = await Form.findById(id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const query: any = { formId: id, isDraft: false };
    const selectedFields = fieldsJson ? JSON.parse(fieldsJson as string) : null;

    if (status) query.status = status;
    if (school_code) query.schoolCode = { $regex: new RegExp(`^${school_code}$`, 'i') };
    if (level !== undefined && level !== '') query.currentLevel = Number(level);

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

    if (search) {
      const searchRegex = { $regex: new RegExp(String(search), 'i') };
      const searchOr = [
        { userName: searchRegex },
        { userEmail: searchRegex },
        { schoolCode: searchRegex },
        { formTitle: searchRegex },
        { 
          responses: { 
            $elemMatch: { 
              value: { $regex: new RegExp(String(search), 'i') } 
            } 
          } 
        }
      ];
      if (!query.$and) query.$and = [];
      query.$and.push({ $or: searchOr });
    }

    // Advanced Field Filtering
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
                value: { $regex: new RegExp(String(val), 'i') }
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

    const submissions = await Submission.find(query).populate('nominationId');
    if (submissions.length === 0) return res.status(404).json({ error: 'No submissions found matching the current filters' });

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.attachment(`${form.title.replace(/[^a-z0-9]/gi, '_')}_export.zip`);
    archive.pipe(res);

    // Helper to extract field labels
    const fieldMap: Record<string, string> = {};
    const walkSchema = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach(f => {
        if (f.id && f.label) fieldMap[f.id] = f.label;
        if (Array.isArray(f.children)) walkSchema(f.children);
      });
    };
    if (form.form_schema?.sections) {
      form.form_schema.sections.forEach((s: any) => walkSchema(s.fields || []));
    }

    for (const sub of submissions) {
      const nomination = sub.nominationId as any;

      let rootFolder = '';
      let subFolder = '';

      if (namingStrategy === 'school') {
        rootFolder = (sub.schoolCode || nomination?.school_code || 'No_School_Code').replace(/[^a-z0-9]/gi, '_');
        
        let subId = '';
        switch (subNamingStrategy) {
          case 'name': subId = sub.userName || 'Unknown'; break;
          case 'email': subId = sub.userEmail || 'NoEmail'; break;
          case 'phone': subId = nomination?.teacher_phone || 'NoPhone'; break;
          case 'id': subId = sub._id.toString(); break;
          default: subId = sub.userName || sub._id.toString();
        }
        subFolder = `${subId.replace(/[^a-z0-9@.]/gi, '_')}_${sub._id}`;
      } else {
        let rootId = '';
        switch (namingStrategy) {
          case 'email': rootId = sub.userEmail || 'NoEmail'; break;
          case 'name': rootId = sub.userName || 'Unknown'; break;
          case 'id': rootId = sub._id.toString(); break;
          case 'phone': rootId = nomination?.teacher_phone || 'NoPhone'; break;
          default: rootId = sub.userEmail || sub._id.toString();
        }
        rootFolder = `${rootId.replace(/[^a-z0-9@.]/gi, '_')}_${sub._id}`;
      }
      
      const teacherPath = subFolder ? `${rootFolder}/${subFolder}` : rootFolder;

      // Generate CSV content for this submission
      const csvRows: string[][] = [['Field', 'Value']];
      const isFieldSelected = (id: string) => !selectedFields || selectedFields.includes(id);

      const formatDate = (d?: Date) => {
        if (!d) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}-${month}-${year} ${hours}:${minutes}`;
      };

      const getFieldLabel = (fieldId: string, val: any) => {
        let field: any = null;
        const findField = (list: any[]) => {
          if (field || !Array.isArray(list)) return;
          for (const f of list) {
            if (f.id === fieldId) { field = f; break; }
            if (Array.isArray(f.children)) findField(f.children);
            if (Array.isArray(f.fields)) findField(f.fields);
          }
        };
        if (form.form_schema?.sections) {
          form.form_schema.sections.forEach((s: any) => findField(s.fields || []));
        } else if (Array.isArray(form.form_schema)) {
          findField(form.form_schema);
        }

        if (field?.options && Array.isArray(field.options)) {
          if (Array.isArray(val)) {
            return val.map(v => {
              const opt = field.options.find((o: any) => String(o.value) === String(v));
              return opt ? opt.label : v;
            }).join(', ');
          }
          const opt = field.options.find((o: any) => String(o.value) === String(val));
          return opt ? opt.label : val;
        }
        return val;
      };

      // Add Basic Info conditionally
      if (isFieldSelected('id')) csvRows.push(['Reference ID', sub._id.toString()]);
      if (isFieldSelected('form_title')) csvRows.push(['Form Title', form.title]);
      if (isFieldSelected('user_name')) csvRows.push(['Submitted By', sub.userName || 'Anonymous']);
      if (isFieldSelected('user_email')) csvRows.push(['Email', sub.userEmail || 'N/A']);
      if (isFieldSelected('school_code')) csvRows.push(['School Code', sub.schoolCode || 'N/A']);
      if (isFieldSelected('status')) csvRows.push(['Status', sub.status]);
      if (isFieldSelected('score')) csvRows.push(['Score', typeof sub.score === 'object' ? String(sub.score?.percentage ?? '') : String(sub.score ?? '')]);
      if (isFieldSelected('submitted_at')) csvRows.push(['Date', formatDate(sub.createdAt)]);

      // Add Form Responses if selected
      for (const resp of sub.responses) {
        if (isFieldSelected(resp.fieldId)) {
          const label = fieldMap[resp.fieldId] || resp.fieldId;
          let val = getFieldLabel(resp.fieldId, resp.value);
          if (Array.isArray(val)) val = val.join(', ');
          csvRows.push([label, String(val)]);
        }
      }

      // Add Review Data if requested
      if (include_reviews === 'true' || include_reviews === true) {
        const reviews = await Review.find({ submission_id: sub._id }).populate('reviewer_id', 'name');
        reviews.forEach(r => {
          csvRows.push(['---', '---']);
          csvRows.push([`Review Level ${r.level} Reviewer`, (r.reviewer_id as any)?.name || 'Reviewer']);
          csvRows.push([`Review Level ${r.level} Score`, String(r.overall_score || '')]);
          csvRows.push([`Review Level ${r.level} Grade`, String(r.grade || '')]);
          csvRows.push([`Review Level ${r.level} Recommendation`, String(r.recommendation || '')]);
          csvRows.push([`Review Level ${r.level} Comments`, String(r.comments || '')]);
        });
      }

      const csvContent = '\ufeff' + csvRows.map(row => 
        row.map(cell => {
          const s = String(cell);
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        }).join(',')
      ).join('\n');

      // Add submission.csv
      archive.append(csvContent, { name: `${teacherPath}/submission.csv` });

      // Handle separate nomination.csv and files if exists and requested
      if ((include_nomination === 'true' || include_nomination === true) && nomination && nomination.additional_data) {
        let addData = nomination.additional_data;
        if (typeof addData === 'string') { try { addData = JSON.parse(addData); } catch {} }
        
        if (typeof addData === 'object') {
          const nomRows: string[][] = [['Field', 'Value']];
          nomRows.push(['Nominated Name', nomination.teacher_name || 'N/A']);
          nomRows.push(['Nominated Email', nomination.teacher_email || 'N/A']);
          nomRows.push(['School Code', nomination.school_code || 'N/A']);

          Object.entries(addData).forEach(([k, v]) => {
            nomRows.push([k.replace(/_/g, ' '), String(v)]);

            // Handle files in nomination data (Cloudinary URLs or local files)
            const fileVal = v as string;
            const isCloudinaryUrl = typeof fileVal === 'string' && (fileVal.includes('res.cloudinary.com') || fileVal.includes('cloudinary'));
            const isLocalFile = typeof fileVal === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(fileVal);
            if (isCloudinaryUrl || isLocalFile) {
              if (fileVal.startsWith('http')) {
                try {
                  const dlRes = await axios.get(fileVal, { responseType: 'arraybuffer' });
                  const urlParts = fileVal.split('/');
                  const nameFromUrl = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
                  archive.append(dlRes.data, { name: `${teacherPath}/nomination_uploads/${nameFromUrl}` });
                } catch (dlErr) {
                  console.error(`Failed to download nomination file: ${fileVal}`, dlErr);
                }
              } else {
                const filePath = path.join(process.cwd(), 'uploads', fileVal);
                if (fs.existsSync(filePath)) {
                  archive.file(filePath, { name: `${teacherPath}/nomination_uploads/${fileVal}` });
                }
              }
            }
          });

          const nomCsvContent = '\ufeff' + nomRows.map(row => 
            row.map(cell => {
              const s = String(cell);
              if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
              }
              return s;
            }).join(',')
          ).join('\n');
          
          archive.append(nomCsvContent, { name: `${teacherPath}/nomination.csv` });
        }
      }

      // Handle files in responses (Teacher's uploads — Cloudinary URLs or local files)
      for (const resp of sub.responses) {
        const val = resp.value;
        const isCloudUrl = typeof val === 'string' && (val.includes('res.cloudinary.com') || val.includes('cloudinary'));
        const isLocalFile = typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val);
        
        if (isCloudUrl || isLocalFile) {
          const fileName = val as string;
          
          if (fileName.startsWith('http')) {
            // Download from Cloudinary or any remote URL
            try {
              const response = await axios.get(fileName, { responseType: 'arraybuffer' });
              const urlParts = fileName.split('/');
              const nameFromUrl = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
              archive.append(response.data, { name: `${teacherPath}/uploads/${nameFromUrl}` });
            } catch (err) {
              console.error(`Failed to download file: ${fileName}`, err);
            }
          } else {
            // Local file fallback
            const filePath = path.join(process.cwd(), 'uploads', fileName);
            if (fs.existsSync(filePath)) {
              archive.file(filePath, { name: `${teacherPath}/uploads/${fileName}` });
            }
          }
        }
      }
    }

    archive.finalize();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
};
