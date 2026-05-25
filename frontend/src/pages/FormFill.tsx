import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Send, Save, CircleCheck, Clock, AlertCircle,
  Loader2, ChevronLeft, ChevronRight, Upload, Wifi, WifiOff,
  Inbox, Check
} from 'lucide-react';
import { api } from '../lib/api';
import { getCleanFileName, isLightColor } from '../lib/utils';

import { User } from '../lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────
type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'dropdown' | 'radio' | 'checkbox' | 'file' | 'mcq';

type Field = {
  id: string; type: FieldType; label: string; required?: boolean; placeholder?: string;
  options?: string[]; option_images?: string[]; maxLength?: number; fileTypes?: string; maxSizeMB?: number;
  correct?: number | string; marks?: number; negative?: number;
  visibleIf?: { fieldId: string; op: 'eq' | 'neq' | 'in'; value: string | string[] };
  image?: string;
};

type Section = {
  id: string; title: string; description?: string; fields: Field[];
  visibleIf?: { fieldId: string; op: 'eq' | 'neq' | 'in'; value: string | string[] };
  image?: string;
};

type FormData = {
  id: string; _id?: string; title: string; description: string; form_type: string;
  form_schema?: { sections: Section[] };
  schema?: { sections: Section[] };
  settings: Record<string, any>;
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

function normCond(v: unknown) {
  return String(v ?? '').trim().toLowerCase();
}

function checkCondition(actual: unknown, expected: string | string[], op: 'eq' | 'neq' | 'in') {
  const expectedList = (Array.isArray(expected) ? expected : [expected]).map(normCond);
  const actualList = Array.isArray(actual) ? actual.map(normCond) : [normCond(actual)];
  const hasAny = expectedList.some(exp => actualList.includes(exp));

  if (op === 'in') return hasAny;
  if (Array.isArray(actual)) return op === 'eq' ? hasAny : !hasAny;

  const target = expectedList[0] ?? '';
  const ok = actualList[0] === target;
  return op === 'eq' ? ok : !ok;
}

function getAnswerByRef(
  ref: string,
  answers: Record<string, unknown>,
  sections: Section[]
): unknown {
  if (Object.prototype.hasOwnProperty.call(answers, ref)) return answers[ref];
  const target = normCond(ref);
  const allFields = sections.flatMap(s => s.fields || []);
  const matched = allFields.find(f => normCond(f.id) === target || normCond(f.label) === target);
  if (!matched) return undefined;
  return answers[matched.id];
}

function checkVisibleIf(
  condition: { fieldId: string; op: 'eq' | 'neq' | 'in'; value: string | string[] } | undefined,
  answers: Record<string, unknown>,
  sections: Section[]
) {
  if (!condition) return true;
  const v = getAnswerByRef(condition.fieldId, answers, sections);
  return checkCondition(v, condition.value, condition.op);
}

function checkShowWhen(
  showWhen: { field: string; equals: string } | undefined,
  answers: Record<string, unknown>,
  sections: Section[]
) {
  if (!showWhen) return true;
  const v = getAnswerByRef(showWhen.field, answers, sections);
  return checkCondition(v, String(showWhen.equals || ''), 'eq');
}

// ─── Badge (App 1 style) ──────────────────────────────────────────────────────
function Badge({ tone = 'blue', children }: { tone?: 'blue' | 'green' | 'amber' | 'rose' | 'slate'; children: React.ReactNode }) {
  return <span className={`badge badge-${tone} inline-flex items-center gap-1`}>{children}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FormFill({ user }: { user: User }) {
  const { id } = useParams();
  const nav = useNavigate();
  const dashboardPath = user?.id === 'anon' ? '/login?portal=teacher' : '/';

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
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [nominationToken, setNominationToken] = useState('');
  const otpSessionRestoreTried = useRef<string>('');
  const urlToken = useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('token') || ''; }
    catch { return ''; }
  }, []);

  // Online/offline events
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Load form
  useEffect(() => {
    if (!id) { setStep('error'); setError('No form specified'); return; }
    
    const query = new URLSearchParams(window.location.search);
    const token = query.get('token') || urlToken;
    if (token) setNominationToken(token);

    const getNomination = async () => {
      // 1. If token exists, use it (highest priority)
      if (token) {
        try {
          const res: any = await api.get(`/nominations/token/${token}`);
          if (res.success && res.data) {
            setEmail(res.data.teacher_email);
            setSchoolCode(res.data.school_code || '');
            setNominationToken(res.data.unique_token || token);
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
      return null;
    };

    Promise.all([
      api.get(`/forms?id=${id}`),
      api.get(`/submissions?form_id=${id}${token ? `&nomination_token=${token}` : ''}`),
      getNomination()
    ]).then(([res, subs, nomination]: any[]) => {
      if (!res || res.error) { setStep('error'); setError('Form not found'); return; }

      res.form_type = res.form_type || res.formType || 'normal';
      res.settings = typeof res.settings === 'string' ? (JSON.parse(res.settings) || {}) : (res.settings || {});

      // Important: Ensure schema sections are loaded even if form_schema is missing
      if (!res.schema || !res.schema.sections) {
        const schemaSource = res.form_schema || res.schema;
        if (schemaSource) {
          try {
            res.schema = typeof schemaSource === 'string' ? JSON.parse(schemaSource) : schemaSource;
          } catch (e) {
            console.error("Failed to parse schema", e);
          }
        }
      }

      if ((!res.schema || !res.schema.sections) && res.fields) {
        try {
          const fields = typeof res.fields === 'string' ? JSON.parse(res.fields) : res.fields;
          res.schema = { sections: [{ id: 's1', title: 'Questions', fields }] };
        } catch {}
      }
      if (!res.schema) res.schema = { sections: [] };

      setForm(res);
      if (nomination) setNomination(nomination);

      const isNominationForm = res.form_type === 'nomination';

      if (user.role === 'functionary') {
        if (isNominationForm) {
          setStep('error');
          setError('School Functionaries cannot fill out nomination forms. Please use the "Nominate Teachers" button on the Forms page.');
          return;
        }
        if (!res.settings?.functionary_only) {
          setStep('error');
          setError('School Functionaries cannot fill out this form. Please use the "Nominate Teachers" button on the Forms page.');
          return;
        }
      }

      // Resolve login mode with precedence:
      // nomination.link_type (teacher-specific override) > form teacher_login > legacy keys.
      const resolvedLoginMode = String(
        nomination?.link_type ||
        res.settings?.teacher_login ||
        res.settings?.login_type ||
        res.settings?.auth_mode ||
        (isNominationForm ? 'otp' : 'direct')
      ).toLowerCase();
      const requiresOtp = resolvedLoginMode === 'otp';
      setOtpRequired(requiresOtp);

      if (res.settings?.functionary_only && user.role !== 'functionary') {
        setStep('error');
        setError('This form is only available for school functionaries.');
        return;
      }

      const hasToken = !!token;

      // ─── STRICT ACCESS LOGIC ───
      // 1) Non-nomination forms => allow anonymous/direct access
      // 2) Nomination forms => token-based access only
      if (isNominationForm && !hasToken) {
        setStep('error');
        setError('This nomination form requires invite link access (token). Please use the nomination link sent to you.');
        return;
      }

      if (res.status !== 'active') { setStep('error'); setError('This form is not active.'); return; }
      if (res.expires_at && new Date(res.expires_at) < new Date()) { setStep('error'); setError('This form has closed.'); return; }

      const existing = (subs || []).find((s: any) => !s.is_draft && !s.isDraft);
      const draft = (subs || []).find((s: any) => s.is_draft || s.isDraft);

      const isFunctionaryOnly = !!res.settings?.functionary_only;
      const canEdit = !!res.allowEdit && user.id !== 'anon';
      const blockMultiple = isNominationForm || (isFunctionaryOnly && user.role === 'functionary') || canEdit;

      if (existing && blockMultiple) {
        const existingId = existing._id || existing.id;
        if (existingId) setSubmissionId(existingId);
        try {
          const respSource = existing.responses;
          const parsed = typeof respSource === 'string' ? JSON.parse(respSource) : respSource;
          if (Array.isArray(parsed)) {
            const out: Record<string, unknown> = {};
            parsed.forEach((r: any) => { if (r?.fieldId) out[r.fieldId] = r.value; });
            setAnswers(out);
          } else {
            setAnswers(parsed || {});
          }
        } catch {}

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
  }, [id, urlToken]);

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

  // Handle auto-redirect if URL provided (Microsoft Forms style)
  useEffect(() => {
    if (step === 'submitted' && form?.settings?.redirect_url) {
      const redirectUrl = form.settings.redirect_url as string;
      const t = setTimeout(() => {
        window.location.href = redirectUrl.startsWith('http') ? redirectUrl : `https://${redirectUrl}`;
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [step, form?.settings?.redirect_url]);

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
      // New format (visibleIf)
      if (s.visibleIf) {
        return checkVisibleIf(s.visibleIf, answers, sections);
      }
      // Legacy support (show_when)
      const anyS = s as any;
      if (anyS.show_when) {
        return checkShowWhen(anyS.show_when, answers, sections);
      }
      return true;
    });
  }, [form, answers, sections]);

  const fieldVisible = React.useCallback((f: Field) => {
    // New format (visibleIf)
    if (f.visibleIf) {
      return checkVisibleIf(f.visibleIf, answers, sections);
    }
    // Legacy support (show_when)
    const anyF = f as any;
    if (anyF.show_when) {
      return checkShowWhen(anyF.show_when, answers, sections);
    }
    return true;
  }, [answers, sections]);

  useEffect(() => {
    const lastIdx = Math.max(visibleSections.length - 1, 0);
    if (sectionIdx > lastIdx) setSectionIdx(lastIdx);
  }, [visibleSections.length, sectionIdx]);

  const getOtpScopeKey = () => {
    const formKey = String(id || '').trim();
    const tokenKey = String(nominationToken || urlToken || '').trim();
    const emailKey = String(nomination?.teacher_email || email || '').trim().toLowerCase();
    if (!formKey || !emailKey) return '';
    return `otp_verified_scope:${formKey}:${emailKey}:${tokenKey}`;
  };

  const handleFileUpload = async (field: Field, file: File) => {
      setError('');
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        setError('Only PDF, JPG, JPEG, and PNG files are allowed');
        return;
      }
    setUploadingFields(prev => ({ ...prev, [field.id]: true }));
    try {
      const data: any = await api.upload('/uploads', file);
      const uploaded = data?.url || data?.filename || file.name;
      setAnswers(a => ({ ...a, [field.id]: uploaded }));
    } catch (err: any) {
      setError(err?.message || `Failed to upload file for "${field.label}"`);
    } finally {
      setUploadingFields(prev => ({ ...prev, [field.id]: false }));
    }
  };

  // If teacher already verified OTP earlier in this browser, reuse saved auth session.
  useEffect(() => {
    if (!otpRequired || otpVerified) return;
    const otpScopeKey = getOtpScopeKey();
    if (!otpScopeKey || localStorage.getItem(otpScopeKey) !== '1') return;

    const savedToken = localStorage.getItem('auth_token');
    const savedUserRaw = localStorage.getItem('auth_user');
    if (!savedToken || !savedUserRaw) return;

    let savedUser: any = null;
    try { savedUser = JSON.parse(savedUserRaw); } catch { return; }

    const savedEmail = String(savedUser?.email || '').trim().toLowerCase();
    const expectedEmail = String(nomination?.teacher_email || email || '').trim().toLowerCase();
    if (!savedEmail || !expectedEmail || savedEmail !== expectedEmail) return;

    const restoreKey = `${savedEmail}:${nominationToken || urlToken || id || ''}`;
    if (otpSessionRestoreTried.current === restoreKey) return;
    otpSessionRestoreTried.current = restoreKey;

    api.post('/auth', { action: 'verify-token', token: savedToken })
      .then((res: any) => {
        const verifiedEmail = String(res?.user?.email || '').trim().toLowerCase();
        if (verifiedEmail && verifiedEmail === expectedEmail) {
          if (res?.user) {
            localStorage.setItem('auth_user', JSON.stringify(res.user));
          }
          setOtpVerified(true);
          if (!email && verifiedEmail) setEmail(verifiedEmail);
        }
      })
      .catch(() => {
        // Ignore silently; OTP screen will remain visible.
      });
  }, [otpRequired, otpVerified, nomination?.teacher_email, nominationToken, urlToken, id, email]);

  const handleSendOtp = async () => {
    if (!email || !email.includes('@')) { setError('Please enter a valid email.'); return; }
    if (otpRequired && nomination?.teacher_email && nomination.teacher_email.toLowerCase() !== email.toLowerCase()) {
      setError('Please use the nominated teacher email for OTP verification.');
      return;
    }
    setOtpLoading(true);
    setError('');
    try {
      const res: any = await api.post('/auth', { action: 'request-otp', email });
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
    if (otpRequired && nomination?.teacher_email && nomination.teacher_email.toLowerCase() !== email.toLowerCase()) {
      setError('Entered email does not match the nominated teacher email.');
      return;
    }
    setOtpLoading(true);
    setError('');
    try {
      const res: any = await api.post('/auth', { action: 'verify-otp', email, otp });
      const token = res?.accessToken || res?.token;
      if (token) {
        localStorage.setItem('auth_token', token);
      }
      if (res?.user) {
        localStorage.setItem('auth_user', JSON.stringify(res.user));
      }
      const otpScopeKey = getOtpScopeKey();
      if (otpScopeKey) {
        localStorage.setItem(otpScopeKey, '1');
      }
      setOtpVerified(true);
      
      if (id) {
        const subs: any = await api.get(`/submissions?form_id=${id}&user_email=${encodeURIComponent(email)}`).catch(() => []);
        const existing = (subs || []).find((s: any) => !s.is_draft && !s.isDraft);
        const draft = (subs || []).find((s: any) => s.is_draft || s.isDraft);

        // Consistency: Only block if it's a nomination form
        if (existing && form?.form_type === 'nomination') {
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

    mcqs.forEach((f: Field) => {
      const qMarks = f.points ?? f.marks ?? 1;
      max += qMarks;
      const ans = answers[f.id];
      if (ans === undefined || ans === null) return;

      const options = Array.isArray(f.options) ? f.options : [];
      const ansText = toOptionText(ans, options);
      const corrText = toOptionText(f.correct, options);

      if (String(ansText).trim() === String(corrText).trim()) {
        score += qMarks;
      } else if (f.negative && f.negative < 0) {
        score += Number(f.negative);
      }
    });
    return { score: Math.max(0, score), max };
  };

  const saveDraft = async () => {
    if (!form || !online || saving) return;
    setSaving(true);
    try {
      const effectiveToken = nominationToken || nomination?.unique_token || urlToken;
      const payload = { 
        form_id: form._id || form.id, 
        responses: answers, 
        status: 'draft', 
        is_draft: true,
        nomination_id: nomination?.id || nomination?._id,
        nomination_token: effectiveToken,
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
    if (!form || saving) return;
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
    const effectiveToken = nominationToken || nomination?.unique_token || urlToken;
    const payload = {
      form_id: form._id || form.id, 
      responses: answers,
      status: 'submitted', 
      is_draft: false,
      nomination_id: nomination?.id || nomination?._id,
      nomination_token: effectiveToken,
      score: sc?.score ?? null,
      user_email: currentEmail,
      user_name: user.id === 'anon' ? (nomination?.teacher_name || currentEmail?.split('@')[0]) : user.name,
      school_code: schoolCode || nomination?.school_code || (user.id !== 'anon' ? user.school_code : '')
    };
    
    try {
      let saved: any;
      if (submissionId) {
        const res = await api.put('/submissions', { id: submissionId, ...payload });
        saved = res.data || res;
      } else {
        const res = await api.post('/submissions', payload);
        saved = res.data || res;
      }
      
      const realId = effectiveToken || saved?._id || saved?.id || submissionId || 'DONE';
      
      const nomId = nomination?.id || nomination?._id;
      if (nomId) {
        try {
          await api.put(`/nominations/${nomId}`, { id: nomId, status: 'completed' });
        } catch (e) {
          console.warn('Failed to update nomination status:', e);
        }
      }

      // Use score from server if available, otherwise fallback to local calculation
      const serverScore = saved?.score?.earnedPoints ?? saved?.score;
      const serverMax = saved?.score?.totalPoints ?? sc?.max;

      setReceipt({ 
        id: realId, 
        score: serverScore !== undefined ? serverScore : sc?.score, 
        max: serverMax !== undefined ? serverMax : sc?.max 
      });
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
        <button onClick={() => nav(dashboardPath)} className="btn btn-ghost mt-5">Go to Dashboard</button>
      </div>
    </div>
  );

  if (step === 'submitted' && receipt && form) {
    const isNomination = form.form_type === 'nomination';
    const submittedBackPath = isNomination ? dashboardPath : '/forms';
    const submittedBackLabel = isNomination ? 'Back to Dashboard' : 'Back to Forms';
    const thankYouHeading = (form.settings.thank_you_heading as string) || 'Thank You!';
    const thankYouMsg = (form.settings.thank_you_message as string) || 'Your response has been recorded.';
    const showScore = form.settings.show_score_after_submit !== false && receipt.max;
    const redirectUrl = form.settings.redirect_url as string;
    
    return (
      <div className="min-h-screen bg-canvas grid place-items-center p-6 relative overflow-hidden" style={{ backgroundColor: (form.settings.bg_color as string) || undefined }}>
        {form.settings.bg_image && (
          <div className="absolute inset-0 z-0">
            <img src={form.settings.bg_image as string} className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5" />
          </div>
        )}
        <div className="card max-w-lg w-full text-center relative z-10 shadow-2xl border-0 ring-1 ring-black/5 bg-white/95 backdrop-blur-md p-8 sm:p-12">
          <div className="w-24 h-24 rounded-full bg-mint-soft text-mint grid place-items-center mx-auto mb-8 shadow-inner ring-4 ring-mint-soft/50 animate-in zoom-in duration-500"><CircleCheck size={48}/></div>
          <div className="font-display text-4xl font-extrabold text-ink tracking-tight mb-3 animate-in fade-in slide-in-from-bottom-2 duration-700">{thankYouHeading}</div>
          <p className="text-muted text-lg px-4 mb-10 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100">{thankYouMsg}</p>
          
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="bg-slate-50/50 rounded-2xl p-6 text-left text-sm space-y-4 border border-slate-100/50">
              <div className="flex justify-between items-center"><span className="text-muted font-medium">Submission ID</span><span className="text-[10px] font-mono bg-white px-2 py-1 rounded border border-slate-200">{receipt.id}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted font-medium">Submitted On</span><span className="text-slate-600 font-medium">{fmtDate(new Date().toISOString())}</span></div>
              {showScore && (
                <div className="flex justify-between items-center pt-4 border-t border-slate-200/50">
                  <span className="text-muted font-bold text-base">Your Result</span>
                  <span className="font-bold text-primary text-2xl">{receipt.score} / {receipt.max}</span>
                </div>
              )}
            </div>

            {redirectUrl && (
              <p className="text-xs text-muted italic">Redirecting you to <span className="text-primary font-bold">{redirectUrl}</span> in 5 seconds...</p>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-300">
            <button onClick={() => nav(submittedBackPath)} className="btn btn-ghost w-full sm:w-auto px-10 h-12 rounded-xl text-base">{submittedBackLabel}</button>
            {form.allowEdit && (
              <button
                onClick={() => {
                  setReceipt(null);
                  setSectionIdx(0);
                  setStep('filling');
                  setError('');
                }}
                className="btn btn-primary w-full sm:w-auto px-10 h-12 rounded-xl text-base shadow-xl shadow-primary/25 font-bold"
              >
                Edit Response
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!form || !currentSection) return null;
  const isNominationForm = form.form_type === 'nomination';
  const fillBackPath = isNominationForm ? dashboardPath : '/forms';
  const fillBackLabel = isNominationForm ? 'Back to Dashboard' : 'Back to Forms';

  // OTP gate for nomination forms configured with OTP login.
  if (otpRequired && !otpVerified) {
    return (
      <div className="min-h-screen bg-canvas grid place-items-center p-6">
        <div className="card max-w-md w-full space-y-4">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-blue-soft text-blue grid place-items-center mx-auto mb-3">
              <Inbox size={22} />
            </div>
            <h2 className="font-display text-xl font-bold text-ink">OTP Verification Required</h2>
            <p className="text-sm text-muted mt-1">
              This nomination form uses OTP-based access. Please verify OTP to continue.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted mb-1.5 block">Teacher Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="teacher@school.edu"
              disabled={!!nomination?.teacher_email}
            />
          </div>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="inline mr-1" /> {error}
            </div>
          )}

          {!otpSent ? (
            <button onClick={handleSendOtp} disabled={otpLoading || !email} className="btn btn-primary w-full">
              {otpLoading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted mb-1.5 block">Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                className="input text-center tracking-[0.35em] font-mono"
                placeholder="123456"
              />
              <button onClick={handleVerifyOtp} disabled={otpLoading || otp.length < 6} className="btn btn-primary w-full">
                {otpLoading ? 'Verifying...' : 'Verify OTP & Continue'}
              </button>
              <button
                onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
                className="btn btn-ghost w-full"
                type="button"
              >
                Resend OTP
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-500" 
      style={{ backgroundColor: (form.settings.bg_color as string || undefined) }}>
      
      {/* Dynamic Background - Always Full Screen */}
      {form.settings.bg_image && (
        <div className="fixed inset-0 z-0 transition-opacity duration-700 w-full">
          <img src={form.settings.bg_image as string} className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5" />
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => nav(fillBackPath)} className="p-2 hover:bg-slate-100 rounded-lg text-muted hover:text-ink transition-colors" title={fillBackLabel}>
              <ChevronLeft size={20}/>
            </button>
            <div className="hidden sm:block">
              <div className="font-display font-bold text-sm text-ink truncate max-w-[200px]">{form.title}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {timeLeft !== null && (
              <Badge tone={timeLeft < 60 ? 'rose' : 'amber'}>
                <Clock size={11}/> {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
              </Badge>
            )}
            {saving ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold animate-pulse">
                <Loader2 size={10} className="animate-spin"/> SAVING...
              </div>
            ) : lastSaved && (
              <div className="text-[10px] text-muted font-medium hidden sm:block">Last saved {relTime(lastSaved)}</div>
            )}
          </div>
        </div>
      </header>

      {/* Content Container - Always Centered & Clean */}
      <div className="relative z-10 px-5 py-8 md:py-12 max-w-4xl mx-auto">
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden ring-1 ring-black/5 min-h-[80vh]">
          
          {/* Premium Header Card */}
          <div className="relative">
            <div 
              className="relative flex flex-col justify-center transition-all p-8 sm:p-12 min-h-[200px]"
              style={{ 
                backgroundColor: (form.settings.header_color as string) || '#004b93',
                backgroundImage: form.settings.header_image ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${form.settings.header_image})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              <div className="flex items-start sm:items-center gap-6 relative z-10 flex-col sm:flex-row">
                {form.settings.logo_image && (
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shrink-0 overflow-hidden">
                    <img 
                      src={form.settings.logo_image as string} 
                      className={`max-w-full max-h-full object-contain ${form.settings.header_image || !isLightColor(form.settings.header_color as string) ? 'brightness-0 invert' : ''}`} 
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <h1 
                    className="text-2xl sm:text-3xl font-display font-extrabold leading-tight tracking-tight drop-shadow-sm uppercase" 
                    style={{ 
                      color: form.settings.header_image 
                        ? 'white' 
                        : isLightColor(form.settings.header_color as string) 
                          ? '#000000' 
                          : '#ffffff' 
                    }}
                  >
                    {form.title}
                  </h1>
                  {form.description && (
                    <p 
                      className="text-lg font-medium leading-relaxed uppercase tracking-wide"
                      style={{ 
                        color: form.settings.header_image 
                          ? 'rgba(255,255,255,0.9)' 
                          : isLightColor(form.settings.header_color as string) 
                            ? 'rgba(0,0,0,0.7)' 
                            : 'rgba(255,255,255,0.9)' 
                      }}
                    >
                      {form.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-16 space-y-16">

            {/* Current Section & Questions */}
            <div className="space-y-24">
              {(() => {
                // Calculate starting question index for numbering
                let questionOffset = 0;
                for (let i = 0; i < sectionIdx; i++) {
                  questionOffset += visibleSections[i].fields.filter(fieldVisible).length;
                }

                const section = visibleSections[sectionIdx];
                const sectionFields = section.fields.filter(fieldVisible);

                return (
                  <div key={section.id || sectionIdx} className="space-y-16">
                    {/* Section Header */}
                    <div className="pb-4 border-b-2 border-slate-100/50 flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight uppercase">
                          {section.title || `Section ${sectionIdx + 1}`}
                        </h2>
                        {section.description && (
                          <p className="mt-2 text-slate-500 font-medium text-base">
                            {section.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-16">
                      {sectionFields.map((f: Field, fIdx: number) => {
                        const currentNum = questionOffset + fIdx;
                        return (
                          <motion.div 
                            key={f.id} 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: fIdx * 0.05 }}
                            className="group/q"
                          >
                            <FieldRenderer
                              f={f}
                              value={answers[f.id]}
                              onChange={v => setAnswers(a => ({ ...a, [f.id]: v }))}
                              onUpload={handleFileUpload}
                              uploading={!!uploadingFields[f.id]}
                              shuffle={!!form.settings.shuffle && (form.form_type === 'quiz' || form.form_type === 'multi') && f.type === 'mcq'}
                              idx={currentNum}
                            />
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {error && (
              <div className="mt-6 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-5 py-4 flex items-center gap-3 shadow-sm">
                <AlertCircle size={20} className="shrink-0"/> 
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Section Info & Progress Bar at bottom */}
            {visibleSections.length > 1 && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <Badge tone="slate">Section {sectionIdx + 1} of {visibleSections.length}</Badge>
                  <div className="text-sm font-semibold text-slate-600">
                    {Math.round(((sectionIdx + 1) / visibleSections.length) * 100)}% Complete
                  </div>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-teal-500 h-full transition-all duration-700 ease-out rounded-full"
                    style={{ width: `${((sectionIdx + 1) / visibleSections.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-4 mt-12 pt-8 border-t border-slate-200/60">
              <div>
                {sectionIdx > 0 ? (
                  <button onClick={() => setSectionIdx(v => v - 1)} className="btn btn-ghost px-6 flex items-center gap-2">
                    <ChevronLeft size={18}/> Previous
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      if (confirm('Are you sure you want to exit? Any unsaved changes might be lost.')) nav(fillBackPath);
                    }} 
                    className="btn btn-ghost px-6"
                  >
                    <ChevronLeft size={18}/> Exit
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={saveDraft} className="btn btn-ghost px-6 hidden sm:flex" title="Save Progress">
                  <Save size={18}/> Save
                </button>
                
                {sectionIdx < visibleSections.length - 1 ? (
                  <button 
                    onClick={() => {
                      // Basic validation for current section before moving next
                      const currentFields = visibleSections[sectionIdx].fields.filter(fieldVisible);
                      for (const f of currentFields) {
                        if (f.required && (answers[f.id] === undefined || answers[f.id] === '' || (Array.isArray(answers[f.id]) && (answers[f.id] as []).length === 0))) {
                          setError(`"${f.label}" is required.`);
                          return;
                        }
                      }
                      setError('');
                      setSectionIdx(v => v + 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} 
                    className="btn btn-primary px-12 shadow-lg shadow-primary/20 h-12 rounded-xl font-bold uppercase tracking-wider flex items-center gap-2"
                  >
                    Next <ChevronRight size={18}/>
                  </button>
                ) : (
                  <button onClick={submit} className="btn btn-accent px-12 shadow-lg shadow-accent/20 h-12 rounded-xl font-bold uppercase tracking-wider">
                    <Send size={18}/> Submit Response
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center pb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/50 backdrop-blur-sm rounded-full text-[10px] font-bold text-muted uppercase tracking-widest border border-slate-200/50 shadow-sm">
            <img src="/logo.png" className="w-4 h-4 grayscale opacity-50" />
            Powered by CISCE Data Collection Portal
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Field Renderer ───────────────────────────────────────────────────────────
function FieldRenderer({
  f,
  value,
  onChange,
  onUpload,
  uploading,
  shuffle,
  idx
}: {
  f: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  onUpload?: (f: Field, file: File) => Promise<void>;
  uploading?: boolean;
  shuffle?: boolean;
  idx: number;
}) {
  const opts = useMemo(() => {
    if (!f.options) return [];
    if (shuffle) return [...f.options].sort(() => Math.random() - 0.5);
    return f.options;
  }, [f.options, shuffle]);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <label className="text-xl font-semibold text-slate-800 flex items-start gap-3 leading-snug">
          <span className="text-slate-400 font-medium min-w-[1.5rem]">{idx + 1}.</span>
          <span className="flex-1">{f.label}{f.required && <span className="text-rose-500 ml-1">*</span>}</span>
        </label>
        {f.placeholder && <p className="text-slate-400 text-sm ml-9 font-medium leading-relaxed">{f.placeholder}</p>}
        {f.image && (
          <div className="mt-4 ml-9 rounded-xl overflow-hidden border border-slate-100 shadow-lg max-w-2xl">
            <img src={f.image} className="w-full h-auto object-contain" />
          </div>
        )}
      </div>

      <div className="ml-9">
      {(() => {
        const baseInputClass = "w-full max-w-2xl px-4 py-2.5 bg-white border border-slate-200 rounded-md text-base text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all shadow-sm";
        switch (f.type) {
          case 'textarea':
            return <textarea className={`${baseInputClass} min-h-[120px] resize-none`} rows={4} placeholder="Enter your answer" maxLength={f.maxLength}
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
          case 'number':
            return <input type="number" className={baseInputClass} placeholder="Enter your answer"
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
          case 'email':
            return <input type="email" className={baseInputClass} placeholder="Enter your answer"
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
          case 'phone':
            return <input type="tel" className={baseInputClass} placeholder="Enter your answer"
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
          case 'date':
            return <input type="date" className={baseInputClass}
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
          case 'dropdown':
            return (
              <select className={baseInputClass} value={String(value || '')} onChange={e => onChange(e.target.value)}>
                <option value="">Select an option</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            );
          case 'radio':
          case 'mcq':
            return (
              <div className="space-y-4 max-w-2xl">
                {opts.map((o, i) => {
                  const img = f.option_images?.[f.options?.indexOf(o) ?? -1];
                  const active = value === o;
                  return (
                    <label key={i} className={`flex items-start gap-4 p-4 rounded-xl transition-all cursor-pointer border-2 group ${active ? 'border-teal-500 bg-teal-50/30' : 'border-slate-100 hover:border-slate-200 bg-white shadow-sm'}`}>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${active ? 'border-teal-500' : 'border-slate-300 bg-white group-hover:border-teal-500'}`}>
                        {active && <div className="w-3 h-3 rounded-full bg-teal-500 shadow-sm" />}
                      </div>
                      <input type="radio" className="hidden" name={f.id} value={o} checked={active} onChange={() => onChange(o)} />
                      <div className="flex-1">
                        <span className={`text-lg font-medium transition-colors ${active ? 'text-teal-900' : 'text-slate-700'}`}>{o}</span>
                        {img && (
                          <div className="mt-4 rounded-xl overflow-hidden border border-inherit shadow-md max-w-sm">
                            <img src={img} className="w-full h-auto object-cover" />
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            );
          case 'checkbox':
            return (
              <div className="space-y-4 max-w-2xl">
                {opts.map((o, i) => {
                  const img = f.option_images?.[f.options?.indexOf(o) ?? -1];
                  const active = Array.isArray(value) && value.includes(o);
                  return (
                    <label key={i} className={`flex items-start gap-4 p-4 rounded-xl transition-all cursor-pointer border-2 group ${active ? 'border-teal-500 bg-teal-50/30' : 'border-slate-100 hover:border-slate-200 bg-white shadow-sm'}`}>
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${active ? 'border-teal-500 bg-teal-500' : 'border-slate-300 bg-white group-hover:border-teal-500'}`}>
                        {active && <Check size={14} className="text-white" strokeWidth={4} />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        value={o} 
                        checked={active}
                        onChange={e => {
                          const cur = Array.isArray(value) ? value : [];
                          if (e.target.checked) onChange([...cur, o]);
                          else onChange(cur.filter(x => x !== o));
                        }} 
                      />
                      <div className="flex-1">
                        <span className={`text-lg font-medium transition-colors ${active ? 'text-teal-900' : 'text-slate-700'}`}>{o}</span>
                        {img && (
                          <div className="mt-4 rounded-xl overflow-hidden border border-inherit shadow-md max-w-sm">
                            <img src={img} className="w-full h-auto object-cover" />
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            );
          case 'file':
            return (
              <label className="block rounded-xl border-2 border-dashed border-slate-200 p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 transition-all max-w-2xl group bg-white shadow-sm">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-teal-100 transition-all">
                  <Upload className="text-slate-400 group-hover:text-teal-600 transition-colors" size={24}/>
                </div>
                <div className="text-lg font-bold text-slate-700">
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-teal-500" size={20}/> Uploading...
                    </span>
                  ) : (value ? (
                    <span className="text-teal-600 flex items-center justify-center gap-2">
                      <CircleCheck size={20} className="text-teal-500"/> 
                      {getCleanFileName(String(value))}
                    </span>
                  ) : 'Upload File')}
                </div>
                <div className="text-sm text-slate-400 mt-2 font-medium">{f.fileTypes ? `Accepted: ${f.fileTypes}` : ''} {f.maxSizeMB ? `· Max ${f.maxSizeMB}MB` : ''}</div>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file && onUpload) await onUpload(f, file);
                  }} />
              </label>
            );
          default:
            return <input className={baseInputClass} placeholder="Enter your answer" maxLength={f.maxLength}
              value={String(value || '')} onChange={e => onChange(e.target.value)} />;
        }
      })()}
      {f.maxLength && <div className="text-xs text-muted mt-2 ml-2 font-bold uppercase tracking-widest">{String(value || '').length} / {f.maxLength} characters</div>}
      </div>
    </div>
  );
}
