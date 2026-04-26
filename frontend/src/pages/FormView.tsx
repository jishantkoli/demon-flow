import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import FormRenderer from '../components/FormRenderer';
import type { FormField } from '../components/FormRenderer';
import { ArrowLeft, User as UserIcon, Calendar, Award } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function FormView({ user }: { user: User }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const submissionId = searchParams.get('submission');
  const [submission, setSubmission] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!submissionId) { setLoading(false); return; }
    // Fetch submission by ID using the correct path parameter endpoint
    api.get(`/submissions/${submissionId}`).then(async (res) => {
      const sub = res.data || res;
      
      // Map backend fields to frontend expected fields if needed
      const normalizedSub = {
        ...sub,
        id: sub._id || sub.id,
        form_id: sub.formId?._id || sub.formId || sub.form_id,
        user_name: sub.userName || sub.user_name,
        submitted_at: sub.createdAt || sub.submitted_at
      };
      setSubmission(normalizedSub);

      const formId = normalizedSub.form_id;
      if (formId) {
        const f = await api.get(`/forms?id=${formId}`);
        setForm(f);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [submissionId]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!submission || !form) return <div className="text-center py-16 text-slate-500">Submission not found</div>;

  let fields: FormField[] = [];
  try { 
    const schemaSource = form.form_schema || form.schema;
    if (schemaSource) {
      const parsed = typeof schemaSource === 'string' ? JSON.parse(schemaSource) : schemaSource;
      if (parsed.sections) {
        // Map backend sections to FormRenderer sections
        fields = parsed.sections.map((s: any) => ({
          id: s.id,
          type: 'section',
          label: s.title,
          children: s.fields || [],
          section_type: form.form_type || form.formType || 'normal'
        }));
      }
    }
    
    if (fields.length === 0) {
      fields = typeof form.fields === 'string' ? JSON.parse(form.fields) : (form.fields || []);
    }
  } catch {}
  let settings: any = {};
  try { settings = typeof form.settings === 'string' ? JSON.parse(form.settings) : (form.settings || {}); } catch {}
  
  // Normalize responses: backend array [{fieldId, value}] -> frontend record {fieldId: value}
  let responses: Record<string, any> = {};
  try { 
    const respSource = submission.responses;
    const parsed = typeof respSource === 'string' ? JSON.parse(respSource) : respSource;
    if (Array.isArray(parsed)) {
      parsed.forEach((r: any) => {
        if (r.fieldId) responses[r.fieldId] = r.value;
      });
    } else {
      responses = parsed || {};
    }
  } catch {}

  // Visibility rules:
  // user: sees questions + own answers only. NO correct answers, NO marks, NO score.
  // reviewer: sees user answers + total score. Does NOT see correct answers.
  // admin: sees everything — correct answers, marks per question, total score.
  const viewMode: 'user' | 'reviewer' | 'admin' = user.role === 'admin' ? 'admin' : user.role === 'reviewer' ? 'reviewer' : 'user';

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-slate-100 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-sidebar to-sidebar-light p-6 text-white">
          <h1 className="text-lg font-bold font-heading">{form.title}</h1>
          <div className="flex flex-wrap gap-3 mt-3 text-[11px]">
            <span className="bg-white/15 px-2.5 py-0.5 rounded-full flex items-center gap-1"><UserIcon size={10} /> {submission.user_name || 'Anonymous'}</span>
            <span className="bg-white/15 px-2.5 py-0.5 rounded-full flex items-center gap-1"><Calendar size={10} /> {new Date(submission.submitted_at).toLocaleString()}</span>
            <StatusBadge status={submission.status} size="xs" />
            {/* Score: only admin and reviewer see it */}
            {submission.score != null && viewMode !== 'user' && (
              <span className="bg-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1"><Award size={10} /> Score: {submission.score}%</span>
            )}
          </div>
        </div>

        <div className="p-6">
          <FormRenderer
            fields={fields}
            formType={form.form_type || form.formType || 'normal'}
            settings={settings}
            initialValues={responses}
            onSubmit={() => {}}
            readOnly={true}
            viewMode={viewMode}
          />
        </div>
      </div>
    </div>
  );
}
