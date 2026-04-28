import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  GraduationCap, Send, Save, CheckCircle2, Clock, AlertCircle,
  Loader2, ChevronLeft, ChevronRight, Upload, Wifi, WifiOff
} from 'lucide-react';
import { api } from '../lib/api';

import { User } from '../lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────
type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'dropdown' | 'radio' | 'checkbox' | 'file' | 'mcq';

type Field = {
  id: string; type: FieldType; label: string; required?: boolean; placeholder?: string;
  options?: string[]; maxLength?: number; fileTypes?: string; maxSizeMB?: number;
  correct?: number | string; marks?: number; negative?: number;
  visibleIf?: { fieldId: string; op: 'eq' | 'neq'; value: string };
};

type Section = {
  id: string; title: string; description?: string; fields: Field[];
  visibleIf?: { fieldId: string; op: 'eq' | 'neq'; value: string };
};

type FormData = {
  id: string; _id?: string; title: string; description: string; form_type: string;
  form_schema?: { sections: Section[] };
  schema?: { sections: Section[] };
  settings: Record<string, unknown>;
  status: string; expires_at: string | null;
};

type Step = 'loading' | 'filling' | 'submitted' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Badge (App 1 style) ──────────────────────────────────────────────────────
function Badge({ tone = 'blue', children }: { tone?: 'blue' | 'green' | 'amber' | 'rose' | 'slate'; children: React.ReactNode }) {
  return <span className={`badge badge-${tone} inline-flex items-center gap-1`}>{children}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FormFill({ user }: { user: User }) {
  const { id } = useParams();
  const nav = useNavigate();

  const [form, setForm] = useState<FormData | null>(null);
  const [nomination, setNomination] = useState<any>(null);
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState('');

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [sectionIdx, setSectionIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [receipt, setReceipt] = useState<{ id: string; score?: number | null; max?: number | null } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // Online/offline events
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Load form
  useEffect(() => {
    if (!id) { setStep('error'); setError('No form specified'); return; }
    
    // School Functionaries should not be filling forms, they should be nominating
    if (user.role === 'functionary') {
      setStep('error');
      setError('School Functionaries cannot fill out forms. Please use the "Nominate Teachers" button on the Forms page.');
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const token = query.get('token');

    const getNomination = async () => {
      // 1. If token exists, use it (highest priority)
      if (token) {
        try {
          const res: any = await api.get(`/nominations/token/${token}`);
          if (res.success && res.data) {
            setEmail(res.data.teacher_email);
            setSchoolCode(res.data.school_code || '');
            const nomData = { ...res.data };
            if (!nomData.id && !nomData._id && nomData.form) {
              nomData._id = nomData._id || nomData.id;
            }
            return nomData;
          }
        } catch (e) {
          console.error("Token verification failed", e);
        }
      }

      // 2. If no token but user is logged in, fetch by form_id
      if (user && user.id !== 'anon') {
        try {
          const res: any = await api.get(`/nominations?form_id=${id}`);
          if (Array.isArray(res) && res.length > 0) {
            setEmail(res[0].teacher_email);
            setSchoolCode(res[0].school_code || '');
            return res[0];
          }
        } catch (e) {
          console.error("Failed to fetch nomination by form_id", e);
        }
      }
      return null;
    };

    Promise.all([
      api.get(`/forms?id=${id}`),
      api.get(`/submissions?form_id=${id}`),
      getNomination()
    ]).then(([res, subs, nomination]: any[]) => {
      if (!res || res.error) { setStep('error'); setError('Form not found'); return; }

      const schemaSource = res.form_schema || res.schema;
      if (schemaSource) {
        try {
          res.schema = typeof schemaSource === 'string' ? JSON.parse(schemaSource) : schemaSource;
        } catch (e) {
          console.error("Failed to parse schema", e);
        }
      }

      if ((!res.schema || !res.schema.sections) && res.fields) {
        try {
          const fields = typeof res.fields === 'string' ? JSON.parse(res.fields) : res.fields;
          res.schema = { sections: [{ id: 's1', title: 'Questions', fields }] };
        } catch {}
      }
      if (!res.schema) res.schema = { sections: [] };

      res.form_type = res.form_type || res.formType || 'normal';
      res.settings = typeof res.settings === 'string' ? (JSON.parse(res.settings) || {}) : (res.settings || {});

      setForm(res);
      if (nomination) setNomination(nomination);

      const authMode = res.settings.auth_mode || 'login';
      const isAnon = user.id === 'anon';

      if (authMode === 'login' && isAnon && !token && !nomination) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }

      if (res.status !== 'active') { setStep('error'); setError('This form is not active.'); return; }
      if (res.expires_at && new Date(res.expires_at) < new Date()) { setStep('error'); setError('This form has closed.'); return; }

      if (authMode === 'otp' && isAnon && !otpVerified) {
        setStep('filling');
        return;
      }

      const existing = (subs || []).find((s: any) => !s.is_draft && !s.isDraft);
      const draft = (subs || []).find((s: any) => s.is_draft || s.isDraft);

      if (existing) {
        const score = typeof existing.score === 'object' && existing.score !== null
          ? existing.score.earnedPoints
          : existing.score ?? null;
        const max = typeof existing.score === 'object' && existing.score !== null
          ? existing.score.totalPoints
          : null;
        setReceipt({ id: existing._id || existing.id, score, max });
        setStep('submitted');
      } else {
        if (draft) {
          try { setAnswers(typeof draft.responses === 'string' ? JSON.parse(draft.responses) : Array.isArray(draft.responses) ? Object.fromEntries(draft.responses.map((r: any) => [r.fieldId, r.value])) : (draft.responses || {})); } catch {}
          setSubmissionId(draft._id || draft.id);
        }
        setStep('filling');
      }
    }).catch(err => { setStep('error'); setError(err.message || 'Failed to load form'); });
  }, [id]);

  // Autosave every 30s
  useEffect(() => {
    if (step !== 'filling' || !form) return;
    const t = setInterval(saveDraft, 30000);
    return () => clearInterval(t);
  }, [step, form, answers, submissionId]);

  // Quiz timer
  useEffect(() => {
    if (!form || step !== 'filling') return;
    const cat = form.form_type;
    if ((cat === 'quiz' || cat === 'multi') && form.settings.time_limit_min) {
      if (timeLeft === null) setTimeLeft((form.settings.time_limit_min as number) * 60);
    }
  }, [form, step]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { submit(); return; }
    const t = setTimeout(() => setTimeLeft(v => (v || 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const sections = form?.schema?.sections || form?.form_schema?.sections || [];

  const parseObject = (raw: any): Record<string, any> => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    return typeof raw === 'object' ? raw : {};
  };

  const nominationAdditionalData = useMemo(() => parseObject(nomination?.additional_data), [nomination]);
  const formSettings = useMemo(() => parseObject(form?.settings), [form]);

  const visibleSections = useMemo(() => {
    return sections.filter((s: Section) => {
      if (!s.visibleIf) return true;
      const v = answers[s.visibleIf.fieldId];
      if (s.visibleIf.op === 'eq') return String(v) === s.visibleIf.value;
      if (s.visibleIf.op === 'neq') return String(v) !== s.visibleIf.value;
      return true;
    });
  }, [form, answers]);

  const fieldVisible = (f: Field) => {
    if (!f.visibleIf) return true;
    const v = answers[f.visibleIf.fieldId];
    if (f.visibleIf.op === 'eq') return String(v) === f.visibleIf.value;
    if (f.visibleIf.op === 'neq') return String(v) !== f.visibleIf.value;
    return true;
  };

  const handleSendOtp = async () => {
    if (!email || !email.includes('@')) { setError('Please enter a valid email.'); return; }
    setOtpLoading(true);
    setError('');
    try {
      const res: any = await api.post('/auth/otp/send', { email });
      setOtpSent(true);
      if (res.school_code) setSchoolCode(res.school_code);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) { setError('Please enter OTP'); return; }
    setOtpLoading(true);
    setError('');
    try {
      const res: any = await api.post('/auth/otp/verify', { email, otp });
      if (res.accessToken) {
        localStorage.setItem('auth_token', res.accessToken);
        localStorage.setItem('auth_user', JSON.stringify(res.user));
      }
      setOtpVerified(true);
      
      if (id) {
        const subs: any = await api.get(`/submissions?form_id=${id}&user_email=${encodeURIComponent(email)}`).catch(() => []);
        const existing = (subs || []).find((s: any) => !s.is_draft && !s.isDraft);
        const draft = (subs || []).find((s: any) => s.is_draft || s.isDraft);

        if (existing) {
          const score = typeof existing.score === 'object' && existing.score !== null
            ? existing.score.earnedPoints
            : existing.score ?? null;
          const max = typeof existing.score === 'object' && existing.score !== null
            ? existing.score.totalPoints
            : null;
          setReceipt({ id: existing._id || existing.id, score, max });
          setStep('submitted');
        } else if (draft) {
          try { 
            setAnswers(typeof draft.responses === 'string' 
              ? JSON.parse(draft.responses) 
              : Array.isArray(draft.responses) 
                ? Object.fromEntries(draft.responses.map((r: any) => [r.fieldId, r.value])) 
                : (draft.responses || {})
            ); 
          } catch {}
          setSubmissionId(draft._id || draft.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const currentSection = visibleSections[sectionIdx];
  const progress = visibleSections.length ? ((sectionIdx + 1) / visibleSections.length) * 100 : 0;

  const computeScore = () => {
    if (!form) return null;
    const mcqs = sections.flatMap((s: Section) => s.fields).filter((f: Field) => f.type === 'mcq');
    if (!mcqs.length) return null;
    let score = 0, max = 0;
    mcqs.forEach((f: Field) => {
      max += f.marks || 1;
      const ans = answers[f.id];
      if (ans === undefined) return;
      if (String(ans) === String(f.correct)) score += f.marks || 1;
      else if (form.settings.negative_marking) score -= f.negative || 0;
    });
    return { score: Math.max(0, score), max };
  };

  const saveDraft = async () => {
    if (!form || !online) return;
    setSaving(true);
    try {
      const payload = { 
        form_id: form._id || form.id, 
        responses: answers, 
        status: 'draft', 
        is_draft: true,
        nomination_id: nomination?.id || nomination?._id,
        user_email: user.id === 'anon' ? email : user.email,
        user_name: user.id === 'anon' ? (email.split('@')[0]) : user.name,
        school_code: schoolCode || (user.id !== 'anon' ? user.school_code : '')
      };
      if (submissionId) {
        await api.put('/submissions', { id: submissionId, ...payload });
      } else {
        const r: any = await api.post('/submissions', payload);
        setSubmissionId(r.data?._id || r.data?.id || r._id || r.id);
      }
      setLastSaved(new Date().toISOString());
    } catch { /* offline */ }
    finally { setSaving(false); }
  };

  const submit = async () => {
    if (!form) return;
    for (const s of visibleSections) {
      for (const f of s.fields) {
        if (!fieldVisible(f)) continue;
        if (f.required && (answers[f.id] === undefined || answers[f.id] === '' || (Array.isArray(answers[f.id]) && (answers[f.id] as []).length === 0))) {
          setError(`"${f.label}" is required.`);
          const errIdx = visibleSections.findIndex((x: Section) => x.id === s.id);
          if (errIdx !== -1) setSectionIdx(errIdx);
          return;
        }
      }
    }
    setError('');
    const sc = computeScore();
    const currentEmail = user.id === 'anon' ? (email || nomination?.teacher_email) : user.email;
    const payload = {
      form_id: form._id || form.id, 
      responses: answers,
      status: 'submitted', 
      is_draft: false,
      nomination_id: nomination?.id || nomination?._id,
      score: sc?.score ?? null,
      user_email: currentEmail,
      user_name: user.id === 'anon' ? (nomination?.teacher_name || currentEmail?.split('@')[0]) : user.name,
      school_code: schoolCode || nomination?.school_code || (user.id !== 'anon' ? user.school_code : '')
    };
    
    console.log('[FormFill] Submitting payload:', payload);
    try {
      let saved: any;
      if (submissionId) saved = await api.put('/submissions', { id: submissionId, ...payload });
      else saved = await api.post('/submissions', payload);
      
      const realId = saved?.data?._id || saved?.data?.id || saved?._id || saved?.id || submissionId || 'DONE';
      
      const nomId = nomination?.id || nomination?._id;
      if (nomId) {
        try {
          await api.put(`/nominations/${nomId}`, { id: nomId, status: 'completed' });
        } catch (e) {
          console.warn('Failed to update nomination status:', e);
        }
      }
      
      setReceipt({ id: realId, score: sc?.score, max: sc?.max });
      setStep('submitted');
    } catch (err: any) {
      console.error('[FormFill] Submission error:', err);
      setError(err.message || 'Failed to submit. Please try again.');
    }
  };

  // ─── Renders ────────────────────────────────────────────────────────────────
  if (step === 'loading') return (
    <div className="min-h-screen grid place-items-center bg-canvas p-6">
      <div className="card p-8 text-center max-w-md">
        <div className="w-14 h-14 rounded-full bg-blue-soft text-blue mx-auto mb-3 grid place-items-center">
          <Loader2 className="animate-spin" size={22}/>
        </div>
        <div className="text-ink">Loading form…</div>
      </div>
    </div>
  );

  if (step === 'error') return (
    <div className="min-h-screen grid place-items-center bg-canvas p-6">
      <div className="card p-8 text-center max-w-md !border-rose-200 bg-rose-50">
        <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 mx-auto mb-3 grid place-items-center"><AlertCircle size={28}/></div>
        <div className="text-lg font-semibold text-ink">{error}</div>
        <button onClick={() => nav('/forms')} className="btn btn-ghost mt-5">Go back to Forms</button>
      </div>
    </div>
  );

  if (step === 'submitted' && receipt && form) {
    return (
      <div className="min-h-screen bg-canvas grid place-items-center p-6">
        <div className="card max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-full bg-mint-soft text-mint grid place-items-center mx-auto mb-4"><CheckCircle2 size={34}/></div>
          <div className="font-display text-2xl font-bold text-ink">Submission Complete!</div>
          <p className="text-muted mt-1">Your response for "{form.title}" has been recorded.</p>
          <div className="mt-5 bg-canvas rounded-xl p-4 text-left text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted">Receipt #</span><span className="font-mono">R-{receipt.id.slice(-6).toUpperCase()}</span></div>
            <div className="flex justify-between"><span className="text-muted">Form</span><span>{form.title}</span></div>
            <div className="flex justify-between"><span className="text-muted">Submitted</span><span>{fmtDate(new Date().toISOString())}</span></div>
            {receipt.max ? <div className="flex justify-between"><span className="text-muted">Score</span><span className="font-semibold">{receipt.score}/{receipt.max}</span></div> : null}
          </div>
          <button onClick={() => nav('/forms')} className="btn btn-ghost mt-5">Back to Forms</button>
        </div>
      </div>
    );
  }

  if (!form || !currentSection) return null;

  const authMode = form.settings.auth_mode || 'login';
  const isAnon = user.id === 'anon';

  // Render OTP verification screen if required
  if (authMode === 'otp' && isAnon && !otpVerified) {
    return (
      <div className="min-h-screen bg-canvas grid place-items-center p-6">
        <div className="card max-w-md w-full p-8">
          <div className="w-16 h-16 rounded-full bg-blue-soft text-blue grid place-items-center mx-auto mb-4">
            <GraduationCap size={34}/>
          </div>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-ink">Verification Required</h2>
            <p className="text-sm text-muted mt-1">Please verify your email to access this form.</p>
          </div>

          <div className="space-y-4">
            {!otpSent ? (
              <>
                <label className="block">
                  <span className="text-xs font-semibold text-muted mb-1 block">School Email</span>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="input" placeholder="teacher@school.edu" />
                </label>
                <button onClick={handleSendOtp} disabled={otpLoading}
                  className="btn btn-primary w-full flex items-center justify-center gap-2">
                  {otpLoading ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                  Send Verification Code
                </button>
              </>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 mb-4">
                  Code sent to <strong>{email}</strong>. Check your inbox.
                </div>
                <label className="block">
                  <span className="text-xs font-semibold text-muted mb-1 block">Verification Code</span>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value)}
                    className="input text-center text-xl tracking-widest font-bold" placeholder="••••••" maxLength={6} />
                </label>
                {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
                <button onClick={handleVerifyOtp} className="btn btn-primary w-full">
                  Verify & Access Form
                </button>
                <button onClick={() => setOtpSent(false)} className="btn btn-ghost w-full text-xs">
                  Change email address
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={() => nav('/forms')} className="p-2 hover:bg-slate-100 rounded-lg text-muted hover:text-ink transition-colors" title="Back to Forms">
              <ChevronLeft size={20}/>
            </button>
            <div className="w-9 h-9 rounded-xl bg-navy text-white grid place-items-center"><GraduationCap size={18}/></div>
            <div>
              <div className="font-display font-bold text-sm text-ink">{form.title}</div>
              <div className="text-[11px] text-muted">Section {sectionIdx + 1} of {visibleSections.length}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {timeLeft !== null && (
              <Badge tone={timeLeft < 60 ? 'rose' : 'amber'}>
                <Clock size={11}/> {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
              </Badge>
            )}
            {online
              ? <Badge tone="green"><Wifi size={11}/> online</Badge>
              : <Badge tone="rose"><WifiOff size={11}/> offline</Badge>
            }
            {saving
              ? <Badge tone="blue"><Loader2 size={11} className="animate-spin"/> saving</Badge>
              : lastSaved && <Badge tone="slate"><Save size={11}/> saved {relTime(lastSaved)}</Badge>
            }
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-border">
          <div className="h-full bg-mint transition-all duration-300" style={{ width: `${progress}%` }}/>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto p-5 md:p-8 space-y-5">
        {nomination && (
          <div className="card !bg-blue-50/50 border-blue-100 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue text-white grid place-items-center">
                <Inbox size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Nomination Details</h3>
                <p className="text-[10px] text-muted uppercase font-semibold">Filled by {nomination.functionary_name || 'School Head'}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted uppercase font-bold">Nominated Teacher</p>
                <p className="text-sm font-semibold">{nomination.teacher_name}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted uppercase font-bold">School Code</p>
                <p className="text-sm font-semibold font-mono">{nomination.school_code}</p>
              </div>
              
              {Object.entries(nominationAdditionalData).map(([key, val]) => {
                const isFile = typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val);
                const fileUrl = isFile ? (typeof val === 'string' && val.startsWith('http') ? val as string : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(val as string)}`) : '';
                
                let label = key;
                const customField = formSettings.nomination_custom_fields?.find((cf: any) => cf.id === key);
                if (customField) label = customField.label;

                return (
                  <div key={key} className="space-y-0.5">
                    <p className="text-[10px] text-muted uppercase font-bold">{label}</p>
                    {isFile ? (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue hover:underline">
                        <ExternalLink size={10} /> View Attachment
                      </a>
                    ) : (
                      <p className="text-sm font-semibold">{String(val)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="text-xs text-muted uppercase tracking-wider font-semibold">Section {sectionIdx + 1}</div>
          <h2 className="font-display text-2xl font-bold text-ink mt-1">{currentSection.title}</h2>
          {currentSection.description && <p className="text-muted mt-1">{currentSection.description}</p>}
        </div>

        <div className="space-y-4">
          {currentSection.fields.filter(fieldVisible).map((f: Field) => (
            <div key={f.id} className="card">
              <FieldRenderer
                f={f}
                value={answers[f.id]}
                onChange={v => setAnswers(a => ({ ...a, [f.id]: v }))}
                shuffle={!!form.settings.shuffle && (form.form_type === 'quiz' || form.form_type === 'multi') && f.type === 'mcq'}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            <AlertCircle size={14} className="inline mr-1"/> {error}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
          <button 
            onClick={() => {
              if (sectionIdx === 0) {
                if (confirm('Are you sure you want to exit? Any unsaved changes might be lost.')) {
                  nav('/forms');
                }
              } else {
                setSectionIdx(sectionIdx - 1);
              }
            }} 
            className="btn btn-ghost"
          >
            <ChevronLeft size={16}/> {sectionIdx === 0 ? 'Back to Forms' : 'Previous'}
          </button>
          <div className="flex gap-2">
            <button onClick={saveDraft} className="btn btn-ghost"><Save size={16}/> Save draft</button>
            {sectionIdx < visibleSections.length - 1 ? (
              <button onClick={() => { setError(''); setSectionIdx(sectionIdx + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="btn btn-primary">
                Next <ChevronRight size={16}/>
              </button>
            ) : (
              <button onClick={submit} className="btn btn-accent"><Send size={16}/> Submit</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Field Renderer ───────────────────────────────────────────────────────────
function FieldRenderer({ f, value, onChange, shuffle }: { f: Field; value: unknown; onChange: (v: unknown) => void; shuffle?: boolean }) {
  const opts = useMemo(() => {
    if (!f.options) return [];
    if (shuffle) return [...f.options].sort(() => Math.random() - 0.5);
    return f.options;
  }, [f.options, shuffle]);

  return (
    <div>
      <label className="text-sm font-semibold text-ink">{f.label}{f.required && <span className="text-rose-500"> *</span>}</label>
      {(() => {
        switch (f.type) {
          case 'textarea':
            return <textarea className="textarea mt-2" rows={4} placeholder={f.placeholder} maxLength={f.maxLength}
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
          case 'number':
            return <input type="number" className="input mt-2" placeholder={f.placeholder}
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
          case 'email':
            return <input type="email" className="input mt-2" placeholder={f.placeholder || 'name@example.com'}
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
          case 'phone':
            return <input type="tel" className="input mt-2" placeholder={f.placeholder || '9876543210'}
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
          case 'date':
            return <input type="date" className="input mt-2" value={String(value || '')} onChange={e => onChange(e.target.value)} />;
          case 'dropdown':
            return (
              <select className="select mt-2" value={String(value || '')} onChange={e => onChange(e.target.value)}>
                <option value="">— Select —</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            );
          case 'radio':
          case 'mcq':
            return (
              <div className="mt-2 space-y-1.5">
                {opts.map((o, i) => {
                  const val = f.type === 'mcq' ? String(i) : o;
                  const checked = String(value) === val;
                  return (
                    <label key={o} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-blue bg-blue-soft' : 'border-border hover:bg-canvas'}`}>
                      <input type="radio" name={f.id} checked={checked} onChange={() => onChange(val)} className="w-4 h-4 accent-blue"/>
                      <span className="text-sm flex-1">{o}</span>
                      {f.type === 'mcq' && <span className="ml-auto text-xs text-muted font-bold">{String.fromCharCode(65 + i)}</span>}
                    </label>
                  );
                })}
              </div>
            );
          case 'checkbox':
            return (
              <div className="mt-2 space-y-1.5">
                {opts.map(o => {
                  const arr = Array.isArray(value) ? value as string[] : [];
                  const on = arr.includes(o);
                  return (
                    <label key={o} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${on ? 'border-blue bg-blue-soft' : 'border-border hover:bg-canvas'}`}>
                      <input type="checkbox" checked={on} onChange={() => onChange(on ? arr.filter(x => x !== o) : [...arr, o])} className="w-4 h-4 accent-blue rounded"/>
                      <span className="text-sm">{o}</span>
                    </label>
                  );
                })}
              </div>
            );
          case 'file':
            return (
              <label className="mt-2 block rounded-xl border-2 border-dashed border-border p-6 text-center cursor-pointer hover:border-blue hover:bg-blue-soft transition-colors">
                <Upload className="mx-auto text-muted" size={22}/>
                <div className="text-sm font-medium mt-2">{value ? String(value) : 'Click or drop file'}</div>
                <div className="text-xs text-muted mt-1">{f.fileTypes ? `Types: ${f.fileTypes}` : ''} {f.maxSizeMB ? `· Max ${f.maxSizeMB}MB` : ''}</div>
                <input type="file" className="hidden" accept={f.fileTypes ? f.fileTypes.split(',').map(x => `.${x.trim()}`).join(',') : undefined}
                  onChange={e => onChange(e.target.files?.[0]?.name || '')} />
              </label>
            );
          default:
            return <input className="input mt-2" placeholder={f.placeholder} maxLength={f.maxLength}
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
        }
      })()}
      {f.maxLength && <div className="text-[11px] text-muted mt-1">{String(value || '').length}/{f.maxLength}</div>}
    </div>
  );
}
