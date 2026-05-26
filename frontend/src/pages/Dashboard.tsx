import React, { useState, useEffect } from 'react';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, FileText, Inbox, SquareCheck, Clock, TrendingUp, 
  Activity, Award, UserPlus, Calendar, Target, AlertTriangle, Shield,
  ChevronRight, ArrowUpRight, School, CircleCheck, Settings, Terminal
} from 'lucide-react';

export default function Dashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState<any>(null);
  const [allStats, setAllStats] = useState<any>(null);
  const [forms, setForms] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formInsights, setFormInsights] = useState<{ uniqueRespondents: number; lastSubmittedAt: string | null; firstSubmittedAt: string | null } | null>(null);
  const [questionAnalytics, setQuestionAnalytics] = useState<any>(null);
  const [selectedFormSubmissions, setSelectedFormSubmissions] = useState<any[]>([]);
  const [questionDetailsOpen, setQuestionDetailsOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalType, setStatusModalType] = useState<'submitted' | 'under_review' | 'approved' | 'rejected' | null>(null);
  const [questionDetails, setQuestionDetails] = useState<any>(null);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);
  const [allRecentSubs, setAllRecentSubs] = useState<any[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'submissions' | 'logs'>('submissions');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [s, subs, formsList] = await Promise.all([
        api.get('/stats').catch(() => ({})),
        api.get('/submissions').catch(() => []),
        api.get('/forms').catch(() => [])
      ]);
      setAllStats(s || {});
      setStats(s || {});
      const subsArr = Array.isArray(subs) ? subs : [];
      setAllSubmissions(subsArr);
      setAllRecentSubs(subsArr.slice(0, 10));
      setRecentSubs(subsArr.slice(0, 10));
      setForms(Array.isArray(formsList) ? formsList : []);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setAllStats({});
      setStats({});
      setForms([]);
      setAllRecentSubs([]);
      setRecentSubs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSelect = async (formId: string | null, opts?: { skipUrl?: boolean }) => {
    setSelectedFormId(formId);
    try {
      setLoading(true);
      
      if (!opts?.skipUrl) {
        const next = new URLSearchParams(searchParams);
        if (formId) next.set('form_id', String(formId));
        else next.delete('form_id');
        setSearchParams(next, { replace: true });
      }

      if (!formId) {
        setStats(allStats);
        setRecentSubs(allRecentSubs);
        setFormInsights(null);
        setQuestionAnalytics(null);
        setSelectedFormSubmissions([]);
        return;
      }

      // Fetch filtered stats for the selected form
      const [formStats, subs, analytics] = await Promise.all([
        api.get(`/stats?form_id=${formId}`).catch(() => ({})),
        api.get(`/submissions?form_id=${formId}`).catch(() => []),
        api.get(`/stats/form-analytics?form_id=${formId}`).catch(() => null)
      ]);
      
      setStats(formStats || {});
      setQuestionAnalytics(analytics);
      
      const all = Array.isArray(subs) ? subs : [];
      setSelectedFormSubmissions(all);
      setRecentSubs(all.slice(0, 10));
      const emails = new Set<string>();
      all.forEach((sub: any) => {
        const e = sub?.user_email || sub?.userEmail;
        if (typeof e === 'string' && e.trim()) emails.add(e.trim().toLowerCase());
      });
      const lastSubmittedAt = all[0]?.submitted_at || all[0]?.createdAt || all[0]?.created_at || null;
      const firstSubmittedAt = all.length ? (all[all.length - 1]?.submitted_at || all[all.length - 1]?.createdAt || all[all.length - 1]?.created_at || null) : null;
      setFormInsights({ uniqueRespondents: emails.size, lastSubmittedAt, firstSubmittedAt });
    } catch (err) {
      console.error('Error fetching form-specific stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchLogs = async () => {
      if (user?.role !== 'admin') return;
      try {
        const logs = await api.get('/audit-logs?limit=10').catch(() => []);
        setRecentLogs(Array.isArray(logs) ? logs.slice(0, 10) : []);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setRecentLogs([]);
      }
    };

    fetchData();
    fetchLogs();
  }, [user?.role]);

  useEffect(() => {
    const formId = searchParams.get('form_id');
    if (!formId) return;
    if (!forms.length) return;
    if (!allStats) return;
    if (String(selectedFormId || '') === String(formId)) return;
    const exists = forms.some((f: any) => String(f?._id || f?.id) === String(formId));
    if (!exists) return;
    handleFormSelect(String(formId), { skipUrl: true });
  }, [searchParams, forms, allStats, selectedFormId]);

  if (loading && !stats) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>;
  
  const s = stats || {};
  const anim = (i: number) => ({ initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05, duration: 0.4 } });
  const selectedForm = selectedFormId ? forms.find((f: any) => String(f?._id || f?.id) === String(selectedFormId)) : null;
  const safeDate = (d: any): Date | null => {
    if (!d) return null;
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };
  const firstDt = safeDate(formInsights?.firstSubmittedAt);
  const lastDt = safeDate(formInsights?.lastSubmittedAt);
  const durationDays = firstDt && lastDt ? Math.max(1, Math.ceil((lastDt.getTime() - firstDt.getTime()) / (1000 * 60 * 60 * 24)) + 1) : 0;
  const approvalRate = s.totalSubmissions > 0 ? Math.round(((s.submissionsByStatus?.approved || 0) / s.totalSubmissions) * 100) : 0;
  const parseFormSettings = (settings: any) => {
    if (!settings) return {};
    if (typeof settings === 'string') {
      try { return JSON.parse(settings); } catch { return {}; }
    }
    return settings;
  };
  const isFunctionaryAccessibleForm = (formRow: any) => {
    const settings = parseFormSettings(formRow?.settings);
    return formRow?.form_type === 'nomination' || !!settings?.functionary_only;
  };
  
  const subId = (sub: any) => sub?.id || sub?._id;
  const canOpenSubmission = (sub: any) => Boolean(subId(sub));
  
  const parseResponses = (raw: any): Record<string, any> => {
    if (!raw) return {};
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        const out: Record<string, any> = {};
        parsed.forEach((r: any) => { if (r?.fieldId) out[String(r.fieldId)] = r.value; });
        return out;
      }
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const isSensitiveQuestion = (_q: any) => false;

  const isNameLikeQuestion = (q: any) => {
    const label = String(q?.label || '').trim().toLowerCase();
    const fieldId = String(q?.fieldId || '').trim().toLowerCase();
    const hasName = label.includes('name') || fieldId.includes('name');
    const isSchoolName = label.includes('school') && label.includes('name');
    return hasName && !isSchoolName;
  };

  const isFileLikeQuestion = (q: any, rows?: Array<{ value: any }>) => {
    const label = String(q?.label || '').trim().toLowerCase();
    const type = String(q?.type || '').trim().toLowerCase();
    const fieldId = String(q?.fieldId || '').trim().toLowerCase();
    const hinted =
      type.includes('file') ||
      type.includes('upload') ||
      type.includes('image') ||
      type.includes('photo') ||
      label.includes('file') ||
      label.includes('upload') ||
      label.includes('image') ||
      label.includes('photo') ||
      fieldId.includes('file') ||
      fieldId.includes('upload') ||
      fieldId.includes('image') ||
      fieldId.includes('photo');

    if (hinted) return true;
    if (!rows?.length) return false;
    const parts = rows.flatMap(r => normalizeAnswerParts(r.value));
    if (!parts.length) return false;
    const urlCount = parts.filter(p => isProbablyUrl(p)).length;
    return urlCount / parts.length >= 0.7;
  };

  const displaySubmissionName = (sub: any) => {
    // 1. Try explicit userName/user_name from DB (if not 'Anonymous')
    const rawName = sub?.userName || sub?.user_name;
    if (rawName && String(rawName).trim() && String(rawName).trim().toLowerCase() !== 'anonymous') {
      return String(rawName).trim();
    }

    // 2. Try nomination data (teacher_name) - VERY IMPORTANT for nominated forms
    const nomName = sub?.nominationId?.teacher_name || sub?.nomination_id?.teacher_name;
    if (nomName && String(nomName).trim()) {
      return String(nomName).trim();
    }

    // 3. Try using the form schema to find a "name" field (e.g. field id is f1 but label is "Full Name")
    const responses = parseResponses(sub?.responses);
    const rawFormId =
      (typeof sub?.form_id === 'object' ? (sub?.form_id?._id || sub?.form_id?.id) : sub?.form_id) ||
      (typeof sub?.formId === 'object' ? (sub?.formId?._id || sub?.formId?.id) : sub?.formId) ||
      sub?.formID;
    const formId = String(rawFormId || '');
    const formObj = formId ? (forms || []).find((f: any) => String(f?._id || f?.id || '') === formId) : null;
    const schemaSource = formObj?.form_schema || formObj?.schema;
    let schemaObj: any = null;
    if (schemaSource) {
      schemaObj = typeof schemaSource === 'string'
        ? (() => { try { return JSON.parse(schemaSource); } catch { return null; } })()
        : schemaSource;
    }
    const fieldList: any[] = [];
    const walk = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach((x: any) => {
        if (!x || typeof x !== 'object') return;
        fieldList.push(x);
        if (Array.isArray(x.children)) walk(x.children);
      });
    };
    if (Array.isArray(schemaObj?.sections)) schemaObj.sections.forEach((s: any) => walk(s?.fields || []));
    else if (Array.isArray(schemaObj?.fields)) walk(schemaObj.fields);
    else if (Array.isArray(schemaObj)) walk(schemaObj);

    if (fieldList.length) {
      const pick = fieldList
        .filter((f: any) => f?.id && f?.label)
        .map((f: any) => {
          const label = String(f.label || '').trim();
          const lower = label.toLowerCase();
          let score = 0;
          if (/full\s*name/i.test(label)) score += 100;
          if (lower === 'name') score += 90;
          if (lower.startsWith('name')) score += 70;
          if (lower.includes('name')) score += 30;
          if (lower.includes('school') && lower.includes('name')) score -= 40;
          return { id: String(f.id), score };
        })
        .sort((a, b) => b.score - a.score)[0];
      if (pick?.id) {
        const v = responses[pick.id];
        if (v != null && String(v).trim()) return String(v).trim();
      }
    }

    // 4. Try parsing responses for common name keys (legacy)
    const fromResponses = responses.full_name || responses.name || responses.teacher_name || responses.teacherName || responses.Name;
    if (fromResponses && String(fromResponses).trim()) return String(fromResponses).trim();
    
    // 5. Fallback to email or finally Anonymous
    return String(sub?.userEmail || sub?.user_email || 'Anonymous').trim();
  };

  const displaySubmissionNameFirstChar = (sub: any) => displaySubmissionName(sub).charAt(0).toUpperCase();

  const isProbablyUrl = (s: string) => /^https?:\/\//i.test(String(s || ''));
  const normalizeAnswerParts = (value: any): string[] => {
    if (value == null) return [];
    if (Array.isArray(value)) return value.flatMap(v => normalizeAnswerParts(v));
    if (typeof value === 'object') {
      const url = (value as any)?.url || (value as any)?.secure_url || (value as any)?.href;
      if (typeof url === 'string' && url.trim()) return [url.trim()];
      const name = (value as any)?.name || (value as any)?.filename;
      if (typeof name === 'string' && name.trim()) return [name.trim()];
      return [JSON.stringify(value)];
    }
    const s = String(value).trim();
    if (!s) return [];
    return [s];
  };

  const questionDetailRows = (() => {
    const fieldId = questionDetails?.fieldId ? String(questionDetails.fieldId) : '';
    if (!questionDetailsOpen || !fieldId) return [] as Array<{ id: number; name: string; value: any; submittedAt?: any }>;
    const out: Array<{ id: number; name: string; value: any; submittedAt?: any }> = [];
    (selectedFormSubmissions || []).forEach((sub: any, i: number) => {
      const responses = parseResponses(sub?.responses);
      const value = responses[fieldId];
      const has = normalizeAnswerParts(value).length > 0;
      if (!has) return;
      out.push({ id: out.length + 1, name: displaySubmissionName(sub), value, submittedAt: sub?.submitted_at || sub?.createdAt || sub?.created_at });
    });
    return out;
  })();

  const questionDetailTop = (() => {
    if (!questionDetailsOpen || !questionDetailRows.length) return [] as Array<{ label: string; count: number }>;
    if (isNameLikeQuestion(questionDetails)) return [] as Array<{ label: string; count: number }>;
    if (isFileLikeQuestion(questionDetails, questionDetailRows)) return [] as Array<{ label: string; count: number }>;
    const freq = new Map<string, number>();
    questionDetailRows.forEach(r => {
      normalizeAnswerParts(r.value).forEach(p => {
        const key = String(p).trim();
        if (!key) return;
        freq.set(key, (freq.get(key) || 0) + 1);
      });
    });
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));
  })();

  const wordCloud = (() => {
    const t = String(questionDetails?.type || '');
    if (!questionDetailsOpen) return [] as Array<{ word: string; count: number }>;
    if (isNameLikeQuestion(questionDetails)) return [] as Array<{ word: string; count: number }>;
    if (!['text', 'textarea'].includes(t)) return [] as Array<{ word: string; count: number }>;
    if (!questionDetailRows.length) return [] as Array<{ word: string; count: number }>;

    const stop = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'as', 'is', 'are', 'was', 'were',
      'i', 'we', 'you', 'they', 'he', 'she', 'it', 'my', 'our', 'your', 'their', 'this', 'that', 'these', 'those', 'be', 'been', 'being',
      'me', 'us', 'him', 'her', 'them', 'so', 'if', 'then', 'than', 'very', 'not', 'no', 'yes', 'ok', 'okay'
    ]);

    const freq = new Map<string, number>();
    questionDetailRows.forEach(r => {
      const parts = normalizeAnswerParts(r.value);
      parts.forEach(txt => {
        String(txt)
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .map(w => w.trim())
          .filter(Boolean)
          .filter(w => w.length >= 3)
          .filter(w => !stop.has(w))
          .forEach(w => freq.set(w, (freq.get(w) || 0) + 1));
      });
    });

    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word, count]) => ({ word, count }));
  })();

  const renderAnswer = (value: any) => {
    if (value == null) return <span className="text-slate-400">—</span>;
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-slate-400">—</span>;
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((v, i) => (
            <span key={i} className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
              {typeof v === 'string' && isProbablyUrl(v) ? (
                'File uploaded'
              ) : (
                String(v)
              )}
            </span>
          ))}
        </div>
      );
    }
    if (typeof value === 'object') {
      const url = (value as any)?.url || (value as any)?.secure_url || (value as any)?.href;
      if (typeof url === 'string' && isProbablyUrl(url)) {
        return <span className="text-xs font-semibold text-slate-700">File uploaded</span>;
      }
      return <span className="text-xs font-semibold text-slate-700 break-words">{JSON.stringify(value)}</span>;
    }
    const s = String(value).trim();
    if (!s) return <span className="text-slate-400">—</span>;
    if (isProbablyUrl(s)) return <span className="text-xs font-semibold text-slate-700">File uploaded</span>;
    return <span className="text-xs font-semibold text-slate-700 break-words">{s}</span>;
  };

  const donutColors = [
    '#4F46E5',
    '#06B6D4',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#14B8A6',
    '#F97316'
  ];

  const DonutChart = ({ segments, total }: { segments: Array<{ label: string; count: number; color: string }>; total: number }) => {
    const safeTotal = Math.max(1, Number(total || 0));
    const r = 15.91549430918954;
    let cumulative = 0;
    return (
      <svg viewBox="0 0 42 42" className="w-24 h-24 shrink-0">
        <circle cx="21" cy="21" r={r} fill="transparent" stroke="#E2E8F0" strokeWidth="8" />
        {segments.map((s, i) => {
          const pct = (s.count / safeTotal) * 100;
          const dash = Math.max(0, Math.min(100, pct));
          const off = -cumulative;
          cumulative += dash;
          return (
            <circle
              key={`${s.label}-${i}`}
              cx="21"
              cy="21"
              r={r}
              fill="transparent"
              stroke={s.color}
              strokeWidth="8"
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={off}
              strokeLinecap="butt"
              transform="rotate(-90 21 21)"
            />
          );
        })}
        <circle cx="21" cy="21" r="9" fill="white" />
        <text x="21" y="20.5" textAnchor="middle" className="fill-slate-900" style={{ fontSize: '6px', fontWeight: 800 }}>
          {Number(total || 0)}
        </text>
        <text x="21" y="26.5" textAnchor="middle" className="fill-slate-500" style={{ fontSize: '4px', fontWeight: 700 }}>
          responses
        </text>
      </svg>
    );
  };

  const functionaryVisibleActiveForms = forms.filter((form: any) => {
    if (!isFunctionaryAccessibleForm(form)) return false;
    const isExpired = form?.expires_at && new Date(form.expires_at) < new Date();
    const effectiveStatus = isExpired ? 'expired' : form?.status;
    return effectiveStatus === 'active';
  }).length;

  const timeline = Object.entries(s.submissionTimeline || {}).sort(([a], [b]) => a.localeCompare(b)).slice(-10);
  const maxTimeline = Math.max(...timeline.map(([, v]) => v as number), 1);

  // ─── Admin Premium Dashboard ──────────────────────────────────────────────
  if (user.role === 'admin') {
    return (
      <div className="max-w-[1400px] mx-auto space-y-8 pb-12 px-4 sm:px-6">
        
        {/* Clean Enterprise Corporate Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Hello, {user.name}. Centralized platform status, nominations audit trail, and user analytics.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {forms.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Filter by Form:</label>
                <select
                  value={selectedFormId || ''}
                  onChange={(e) => handleFormSelect(e.target.value || null)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary cursor-pointer"
                >
                  <option value="">All Forms</option>
                  {forms
                    .filter((form: any) => user.role !== 'functionary' || isFunctionaryAccessibleForm(form))
                    .map((form: any) => (
                      <option key={form._id || form.id} value={form._id || form.id}>
                        {form.title}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All Services Operational
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold">
              <Activity size={13} className="text-slate-500" />
              Sync Latency: 12ms
            </div>
          </div>
        </div>

        {/* Crisp Enterprise Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {(() => {
            const defaultCards = [
              { 
                label: "Total Users", 
                value: s.totalUsers || 0, 
                subtext: `${s.usersByRole?.teacher || 0} Teachers • ${s.usersByRole?.reviewer || 0} Reviewers`,
                icon: Users, 
                color: "text-blue-600 bg-blue-50 border-blue-100/50",
                cta: "Manage Users", 
                path: "/users" 
              },
              { 
                label: "Active Forms", 
                value: s.activeForms || 0, 
                subtext: `${s.draftForms || 0} Drafts • ${s.expiredForms || 0} Expired`,
                icon: FileText, 
                color: "text-emerald-600 bg-emerald-50 border-emerald-100/50",
                cta: "Configure Forms", 
                path: "/forms" 
              },
              { 
                label: "Submissions Received", 
                value: s.totalSubmissions || 0, 
                subtext: `Success Index: ${s.totalSubmissions > 0 ? Math.round(((s.submissionsByStatus?.approved || 0) / s.totalSubmissions) * 100) : 0}%`,
                icon: Inbox, 
                color: "text-indigo-600 bg-indigo-50 border-indigo-100/50",
                cta: "Browse Records", 
                path: "/submissions" 
              },
              { 
                label: "Pending Reviews", 
                value: s.pendingReviews || 0, 
                subtext: `${s.completedReviews || 0} Gradings Completed`,
                icon: SquareCheck, 
                color: "text-amber-600 bg-amber-50 border-amber-100/50",
                cta: "Process Reviews", 
                path: "/reviews" 
              }
            ];

            if (selectedFormId) {
              return [
                { 
                  label: "Submissions Received", 
                  value: s.totalSubmissions || 0, 
                  subtext: `Success Index: ${s.totalSubmissions > 0 ? Math.round(((s.submissionsByStatus?.approved || 0) / s.totalSubmissions) * 100) : 0}%`,
                  icon: Inbox, 
                  color: "text-indigo-600 bg-indigo-50 border-indigo-100/50",
                  cta: "Browse Records", 
                  path: "/submissions" 
                },
                { 
                  label: "Approved Records", 
                  value: s.submissionsByStatus?.approved || 0, 
                  subtext: `${s.submissionsByStatus?.under_review || 0} Under Review`,
                  icon: CircleCheck, 
                  color: "text-emerald-600 bg-emerald-50 border-emerald-100/50",
                  cta: "View Approved", 
                  path: "/submissions" 
                },
                { 
                  label: "Declined Submissions", 
                  value: s.submissionsByStatus?.rejected || 0, 
                  subtext: `${s.submissionsByStatus?.pending || 0} Pending`,
                  icon: AlertTriangle, 
                  color: "text-rose-600 bg-rose-50 border-rose-100/50",
                  cta: "View Declined", 
                  path: "/submissions" 
                },
                { 
                  label: "Pending Reviews", 
                  value: s.pendingReviews || 0, 
                  subtext: `${s.completedReviews || 0} Gradings Completed`,
                  icon: SquareCheck, 
                  color: "text-amber-600 bg-amber-50 border-amber-100/50",
                  cta: "Process Reviews", 
                  path: "/reviews" 
                }
              ];
            }

            return defaultCards;
          })().map((card, i) => (
            <div 
              key={card.label} 
              onClick={() => {
                if (card.label === "Declined Submissions") {
                  setStatusModalType('rejected');
                  setStatusModalOpen(true);
                } else if (card.label === "Approved Records") {
                  setStatusModalType('approved');
                  setStatusModalOpen(true);
                } else if (card.label === "Submissions Received") {
                  setStatusModalType('submitted');
                  setStatusModalOpen(true);
                } else {
                  navigate(card.path);
                }
              }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div className="flex justify-between items-center mb-5">
                <div className={`w-12 h-12 rounded-xl ${card.color} border flex items-center justify-center`}>
                  <card.icon size={22} />
                </div>
                <div className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 group-hover:bg-slate-200/80 px-3 py-1.5 rounded-lg transition-colors">
                  {card.cta}
                  <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{card.label}</div>
                <div className="text-3xl font-bold text-slate-900 mt-2">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 mt-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  {card.subtext}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Dashboard Panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Visual Analytics & Tabbed Ledger (col-span-8) */}
          <div className="lg:col-span-8 space-y-8">
            
            {timeline.length === 0 ? null : (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Analytics</div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-1">
                      <TrendingUp size={16} className="text-slate-500" />
                      Submission Trend
                    </h3>
                    {selectedFormId && (
                      <div className="text-[11px] font-semibold text-slate-500 mt-1">
                        {selectedForm?.title || 'Selected Form'} · {s.totalSubmissions || 0} responses
                      </div>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <Calendar size={12} className="text-slate-400" />
                    Last 10 Days
                  </div>
                </div>

                <div className="flex items-end gap-3 h-48 px-2 relative">
                  <div className="absolute inset-x-0 top-0 border-t border-slate-100 pointer-events-none" />
                  <div className="absolute inset-x-0 top-1/3 border-t border-slate-100 pointer-events-none" />
                  <div className="absolute inset-x-0 top-2/3 border-t border-slate-100 pointer-events-none" />
                  
                  {timeline.map(([date, count]) => (
                    <div key={date} className="flex-1 group relative flex flex-col items-center gap-2 h-full justify-end z-10">
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded-lg pointer-events-none z-20 shadow-md flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        <span className="font-semibold">{count as number} Submissions</span>
                      </div>
                      
                      <div 
                        style={{ height: `${((count as number) / maxTimeline) * 85}%` }}
                        className="w-full bg-indigo-600 rounded-md min-h-[6px] group-hover:bg-indigo-500 transition-colors duration-150"
                      />
                      
                      <span className="text-[9px] font-bold text-slate-400 group-hover:text-slate-700 transition-colors mt-1">
                        {date.split('-').slice(1).join('/')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedFormId && questionAnalytics?.questions?.length ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Responses Overview</div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-1">
                      <FileText size={16} className="text-slate-500" />
                      Question Analytics
                    </h3>
                  </div>
                  <button
                    onClick={() => navigate(`/submissions?form_id=${encodeURIComponent(String(selectedFormId))}`)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 uppercase tracking-wider transition-all"
                  >
                    Open Responses
                  </button>
                </div>

                <div className="space-y-5">
                  {(questionAnalytics.questions as any[]).map((q, idx) => {
                    const answered = Number(q.answered || 0);
                    const total = Number(q.totalResponses || 0);
                    const pctAnswered = total ? Math.round((answered / total) * 100) : 0;
                    const options = Array.isArray(q.options) ? q.options : null;
                    const dates = Array.isArray(q.dates) ? q.dates : null;
                    const samples = Array.isArray(q.samples) ? q.samples : null;
                    const numeric = q.numeric || null;
                    const files = q.files || null;
                    const qType = String(q.type || '');

                    return (
                      <div key={q.fieldId || idx} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                        <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Question {idx + 1}</div>
                            <div className="text-sm font-bold text-slate-900 mt-1 truncate">{q.label || 'Untitled question'}</div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              onClick={() => { setQuestionDetails({ ...q, idx }); setQuestionDetailsOpen(true); }}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                            >
                              More details
                            </button>
                            <div className="text-right">
                              <div className="text-xs font-black text-slate-900">{answered}/{total}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{pctAnswered}% answered</div>
                            </div>
                            <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                              <div className="h-full bg-indigo-600" style={{ width: `${pctAnswered}%` }} />
                            </div>
                          </div>
                        </div>

                        <div className="p-4">
                          {options ? (
                            (() => {
                              const isSingle = ['radio', 'select', 'dropdown', 'mcq'].includes(qType);
                              const useDonut = isSingle && options.length > 0 && options.length <= 7;
                              const answeredTotal = answered || 0;
                              const sum = options.reduce((acc: number, o: any) => acc + Number(o?.count || 0), 0);
                              const remaining = Math.max(0, answeredTotal - sum);
                              const segmentsAll = [
                                ...options.map((o: any, i: number) => ({
                                  label: String(o.label || '—'),
                                  count: Number(o.count || 0),
                                  color: donutColors[i % donutColors.length]
                                })),
                                ...(remaining > 0 ? [{ label: 'Other', count: remaining, color: '#94A3B8' }] : [])
                              ];
                              const segmentsDraw = segmentsAll.filter(s => s.count > 0);

                              if (useDonut) {
                                return (
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                                    <DonutChart segments={segmentsDraw} total={answeredTotal} />
                                    <div className="space-y-2 min-w-0 flex-1">
                                      {segmentsAll.map((s, i) => (
                                        <div key={`${s.label}-${i}`} className="flex items-center justify-between gap-3">
                                          <div className="min-w-0 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                            <span className="text-xs font-semibold text-slate-700 truncate">{s.label}</span>
                                          </div>
                                          <div className="text-[10px] font-bold text-slate-500 shrink-0">
                                            {s.count} • {Math.round((s.count / Math.max(answeredTotal, 1)) * 100)}%
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-2">
                                  {segmentsAll.map((o: any, oi: number) => {
                                    const pct = answeredTotal ? Math.round((Number(o.count || 0) / answeredTotal) * 100) : 0;
                                    return (
                                      <div key={`${o.label}-${oi}`} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                        <div className="min-w-0">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-xs font-semibold text-slate-700 truncate">{o.label}</div>
                                            <div className="text-[10px] font-bold text-slate-500 shrink-0">{o.count}</div>
                                          </div>
                                          <div className="mt-1 h-2 bg-white rounded-full overflow-hidden border border-slate-200">
                                            <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                                          </div>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-500 w-10 text-right">{pct}%</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()
                          ) : dates ? (
                            <div className="space-y-2">
                              {dates.map((d: any, di: number) => (
                                <div key={`${d.label}-${di}`} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                  <div className="min-w-0">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-xs font-semibold text-slate-700 truncate">{d.label}</div>
                                      <div className="text-[10px] font-bold text-slate-500 shrink-0">{d.count}</div>
                                    </div>
                                    <div className="mt-1 h-2 bg-white rounded-full overflow-hidden border border-slate-200">
                                      <div className="h-full bg-indigo-500" style={{ width: `${d.pct || 0}%` }} />
                                    </div>
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-500 w-10 text-right">{d.pct || 0}%</div>
                                </div>
                              ))}
                            </div>
                          ) : numeric ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average</div>
                                <div className="text-2xl font-black text-slate-900 mt-1">{numeric.avg}</div>
                                <div className="text-[10px] font-semibold text-slate-500 mt-1">{answered} responses</div>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Min</div>
                                <div className="text-lg font-black text-slate-900 mt-1">{numeric.min ?? '—'}</div>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max</div>
                                <div className="text-lg font-black text-slate-900 mt-1">{numeric.max ?? '—'}</div>
                              </div>
                            </div>
                          ) : files ? (
                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Files Uploaded</div>
                              <div className="text-lg font-black text-slate-900 mt-1">{files.count || 0}</div>
                            </div>
                          ) : samples ? (
                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Responses</div>
                              {isSensitiveQuestion(q) ? (
                                <div className="mt-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                  Hidden for privacy
                                </div>
                              ) : (
                                <div className="mt-2 space-y-2">
                                  {samples.slice(0, 3).map((smp: any, si: number) => (
                                    <div key={si} className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 break-words">
                                      {String(smp)}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button
                                onClick={() => { setQuestionDetails({ ...q, idx }); setQuestionDetailsOpen(true); }}
                                className="mt-3 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                              >
                                More details
                              </button>
                            </div>
                          ) : (
                            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs font-semibold uppercase tracking-widest">
                              No analytics available
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <Modal
              open={questionDetailsOpen}
              onClose={() => { setQuestionDetailsOpen(false); setQuestionDetails(null); }}
              title={questionDetails ? `Q${Number(questionDetails.idx || 0) + 1}. ${questionDetails.label || 'Question'}` : 'Question Details'}
              size="xl"
            >
              {!questionDetails ? (
                <div className="text-sm text-slate-500">No question selected</div>
              ) : (
                <div className="space-y-5">
                  {isSensitiveQuestion(questionDetails) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-semibold text-amber-800">
                      This field contains sensitive data. Detailed analytics are hidden.
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Responses</div>
                      <div className="text-xl font-black text-slate-900 mt-1">{questionDetailRows.length}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Submissions</div>
                      <div className="text-xl font-black text-slate-900 mt-1">{(selectedFormSubmissions || []).length}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Answered %</div>
                      <div className="text-xl font-black text-slate-900 mt-1">
                        {(() => {
                          const total = Number(questionDetails.totalResponses || 0);
                          const answered = Number(questionDetails.answered || questionDetailRows.length || 0);
                          return total ? `${Math.round((answered / total) * 100)}%` : '—';
                        })()}
                      </div>
                    </div>
                  </div>

                  {!isSensitiveQuestion(questionDetails) && questionDetailTop.length > 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Top Answers</div>
                      <div className="space-y-2">
                        {(() => {
                          const max = Math.max(...questionDetailTop.map(x => x.count), 1);
                          return questionDetailTop.map((x) => (
                            <div key={x.label} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                              <div className="min-w-0">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs font-semibold text-slate-700 truncate">{x.label}</div>
                                  <div className="text-[10px] font-bold text-slate-500 shrink-0">{x.count}</div>
                                </div>
                                <div className="mt-1 h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-200">
                                  <div className="h-full bg-indigo-500" style={{ width: `${Math.round((x.count / max) * 100)}%` }} />
                                </div>
                              </div>
                              <div className="text-[10px] font-bold text-slate-500 w-10 text-right">
                                {Math.round((x.count / Math.max(questionDetailRows.length, 1)) * 100)}%
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  ) : !isSensitiveQuestion(questionDetails) ? (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs font-semibold uppercase tracking-widest">
                      No chart available
                    </div>
                  ) : null}

                  {!isSensitiveQuestion(questionDetails) && wordCloud.length >= 8 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Word Cloud</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-2">
                        {(() => {
                          const max = Math.max(...wordCloud.map(w => w.count), 1);
                          const min = Math.min(...wordCloud.map(w => w.count), max);
                          return wordCloud.map((w) => {
                            const t = (w.count - min) / Math.max(1, max - min);
                            const fontSize = Math.round(12 + t * 16);
                            const opacity = 0.6 + t * 0.4;
                            return (
                              <span
                                key={w.word}
                                className="font-black text-slate-700"
                                style={{ fontSize: `${fontSize}px`, opacity }}
                                title={`${w.count}`}
                              >
                                {w.word}
                              </span>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ) : null}

                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responses</div>
                      <div className="text-[10px] font-bold text-slate-500">{questionDetailRows.length}</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left">
                        <thead className="bg-slate-50">
                          <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Response</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {questionDetailRows.length === 0 ? (
                            <tr>
                              <td className="px-4 py-6 text-sm text-slate-500" colSpan={3}>No responses</td>
                            </tr>
                          ) : questionDetailRows.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-xs font-bold text-slate-500">{r.id}</td>
                              <td className="px-4 py-3 text-xs font-semibold text-slate-700">{r.name || 'Anonymous'}</td>
                              <td className="px-4 py-3">
                                {isSensitiveQuestion(questionDetails)
                                  ? <span className="text-xs font-semibold text-slate-500">Hidden</span>
                                  : renderAnswer(r.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </Modal>

            <Modal
              open={statusModalOpen}
              onClose={() => { setStatusModalOpen(false); setStatusModalType(null); }}
              title={
                statusModalType === 'rejected' ? 'Declined Submissions' :
                statusModalType === 'approved' ? 'Approved Records' :
                statusModalType === 'under_review' ? 'Under Review' :
                'Pending Assessment'
              }
              size="xl"
            >
              {(() => {
                const targetList = selectedFormId ? selectedFormSubmissions : allSubmissions;
                const filtered = targetList.filter((s: any) => {
                  const status = String(s.status || '').toLowerCase();
                  const isApproved = status === 'approved' || status === 'next_level';
                  const isRejected = status === 'rejected';
                  const isSubmitted = status === 'submitted' || status === 'pending';
                  const isUnderReview = status === 'under_review';

                  if (statusModalType === 'approved') return isApproved;
                  if (statusModalType === 'rejected') return isRejected;
                  if (statusModalType === 'submitted') return isSubmitted;
                  if (statusModalType === 'under_review') return isUnderReview;
                  return status === statusModalType;
                });

                return (
                  <div className="space-y-5">
                    <div className={`border rounded-2xl p-4 flex items-center justify-between ${
                      statusModalType === 'rejected' ? 'bg-rose-50 border-rose-100' :
                      statusModalType === 'approved' ? 'bg-emerald-50 border-emerald-100' :
                      statusModalType === 'under_review' ? 'bg-indigo-50 border-indigo-100' :
                      'bg-blue-50 border-blue-100'
                    }`}>
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-widest ${
                          statusModalType === 'rejected' ? 'text-rose-600' :
                          statusModalType === 'approved' ? 'text-emerald-600' :
                          statusModalType === 'under_review' ? 'text-indigo-600' :
                          'text-blue-600'
                        }`}>
                          {statusModalType === 'rejected' ? 'Declined Records' :
                           statusModalType === 'approved' ? 'Approved Records' :
                           statusModalType === 'under_review' ? 'Under Review' :
                           'Pending Records'}
                        </div>
                        <div className={`text-xl font-black mt-1 ${
                          statusModalType === 'rejected' ? 'text-rose-900' :
                          statusModalType === 'approved' ? 'text-emerald-900' :
                          statusModalType === 'under_review' ? 'text-indigo-900' :
                          'text-blue-900'
                        }`}>
                          {filtered.length}
                        </div>
                      </div>
                      {statusModalType === 'rejected' ? <AlertTriangle className="text-rose-500" size={24} /> :
                       statusModalType === 'approved' ? <SquareCheck className="text-emerald-500" size={24} /> :
                       statusModalType === 'under_review' ? <Clock className="text-indigo-500" size={24} /> :
                       <Inbox className="text-blue-500" size={24} />}
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responses</div>
                        <div className="text-[10px] font-bold text-slate-500">
                          {filtered.length}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                          <thead className="bg-slate-50">
                            <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              <th className="px-4 py-3">ID</th>
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 ? (
                              <tr>
                                <td className="px-4 py-6 text-sm text-slate-500 text-center" colSpan={4}>
                                  No {statusModalType?.replace('_', ' ')} submissions found
                                </td>
                              </tr>
                            ) : (
                              filtered.map((sub: any, i: number) => (
                                <tr key={subId(sub)} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 text-xs font-bold text-slate-500">{i + 1}</td>
                                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{displaySubmissionName(sub)}</td>
                                  <td className="px-4 py-3 text-xs text-slate-500">
                                    {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => navigate(`/forms/view?submission=${subId(sub)}`)}
                                      className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold"
                                    >
                                      View Details
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Modal>

            {/* Clean Tabbed Stream Center: Submissions vs System Audit Logs */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              
              {/* Tab Selector Header */}
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                  <button 
                    onClick={() => setActiveTab('submissions')}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'submissions' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Recent Submissions
                  </button>
                  <button 
                    onClick={() => setActiveTab('logs')}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'logs' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    System Audit Logs
                  </button>
                </div>
                
                {activeTab === 'submissions' ? (
                  <button 
                    onClick={() => navigate('/submissions')} 
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider bg-slate-100 hover:bg-slate-200/80 border border-slate-200 px-3 py-1.5 rounded-lg transition-all"
                  >
                    View All Submissions <ChevronRight size={10} />
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    <Shield size={11} className="text-slate-400" />
                    Security Ledger (Last 10 Actions)
                  </div>
                )}
              </div>
              
              {/* Tab Content Panels */}
              <div className="divide-y divide-slate-100">
                {activeTab === 'submissions' ? (
                  recentSubs.length === 0 ? (
                    <div className="p-16 text-center text-slate-400">
                      <Inbox size={40} className="mx-auto opacity-20 mb-3" />
                      <p className="text-xs font-semibold uppercase tracking-wider">No submissions in queue</p>
                    </div>
                  ) : recentSubs.map((sub, i) => (
                    <div 
                      key={subId(sub)} 
                      onClick={() => { if (canOpenSubmission(sub)) navigate(`/forms/view?submission=${subId(sub)}`); }} 
                      className="w-full text-left px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-slate-50/50 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 flex items-center justify-center text-xs font-bold transition-all border border-slate-200/80 shrink-0">
                          {displaySubmissionNameFirstChar(sub)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                            {sub.form_title || 'Untitled Form submission'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400">Nominee:</span>
                            <span className="text-[10px] text-slate-600 font-semibold truncate">
                              {displaySubmissionName(sub)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 self-stretch sm:self-center">
                        <div className="text-left sm:text-right">
                          <StatusBadge 
                            status={
                              ['submitted', 'under_review', 'approved', 'rejected', 'next_level', 'completed'].includes(sub.status) 
                              ? 'submitted' 
                              : 'pending'
                            } 
                            size="xs" 
                          />
                          <p className="text-[9px] text-slate-400 font-semibold mt-1 uppercase tracking-tighter">
                            {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Today'}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  ))
                ) : (
                  recentLogs.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 bg-slate-50/50 font-mono">
                      <Terminal size={32} className="mx-auto opacity-10 mb-2 text-slate-500" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Security audit trail is empty</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            <th className="px-6 py-3.5">User</th>
                            <th className="px-6 py-3.5">Action</th>
                            <th className="px-6 py-3.5">Timestamp</th>
                            <th className="px-6 py-3.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recentLogs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-6 py-3.5">
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-slate-800">{log.user_name || 'System Operator'}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{log.user_email}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">{log.action}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-xs font-medium text-slate-500">
                                {log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-6 py-3.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  PASS
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Quick Actions Shortcuts Board */}
            {!selectedFormId && <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Administrative Utilities</div>
              <h3 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Settings size={16} className="text-slate-500" />
                System Operational Controls
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: "Form Generator", desc: "Design new custom forms", icon: FileText, bg: "bg-blue-50 text-blue-600 border-blue-100/50", path: "/forms" },
                  { title: "Review Pipeline", desc: "Configure stages & groups", icon: Target, bg: "bg-purple-50 text-purple-600 border-purple-100/50", path: "/reviews" },
                  { title: "Security Matrix", desc: "Manage system operators", icon: Shield, bg: "bg-amber-50 text-amber-600 border-amber-100/50", path: "/users" }
                ].map((act) => (
                  <div 
                    key={act.title}
                    onClick={() => navigate(act.path)}
                    className="p-5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer transition-all duration-150 group flex flex-col justify-between min-h-[110px]"
                  >
                    <div className={`w-8 h-8 rounded-lg ${act.bg} border flex items-center justify-center`}>
                      <act.icon size={15} />
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-0.5">
                        {act.title}
                        <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 translate-x-[-2px] group-hover:translate-x-0 transition-all text-slate-400" />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{act.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>}

          </div>

          {/* Right Column: Platform Diagnostics & Fulfillment (col-span-4) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Highly Useful Platform Progress Widget */}
            {(() => {
              const totalNominations = (s.nominationsByStatus?.invited || 0) + (s.nominationsByStatus?.in_progress || 0) + (s.nominationsByStatus?.completed || 0);
              return totalNominations > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden group">
                  <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Fulfillment Monitor</div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm mb-6">
                    <Award size={16} className="text-slate-500" />
                    Nomination Response Rate
                  </h3>
                  
                  {/* Circular SVG Progress Indicator */}
                  <div className="flex flex-col items-center justify-center py-4 border-b border-slate-100">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      {/* Circle SVG */}
                      <svg className="w-28 h-28 transform -rotate-90">
                        <circle cx="56" cy="56" r="44" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                        <motion.circle 
                          cx="56" 
                          cy="56" 
                          r="44" 
                          stroke="#4f46e5" 
                          strokeWidth="6" 
                          fill="transparent" 
                          strokeDasharray="276"
                          initial={{ strokeDashoffset: 276 }}
                          animate={{ strokeDashoffset: 276 - (276 * (s.completionRate || 0)) / 100 }}
                          transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-bold text-slate-900">{s.completionRate || 0}%</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Finished</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 w-full text-center mt-6">
                      <div>
                        <div className="text-xs font-bold text-slate-700">{s.nominationsByStatus?.invited || 0}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Invited</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-700">{s.nominationsByStatus?.in_progress || 0}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Pending</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-700">{s.nominationsByStatus?.completed || 0}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Completed</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Avg Graded Score</span>
                    <span className="text-indigo-600 font-bold">{s.avgScore || 0}% Average</span>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Platform Funnel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between mb-6 relative">
                <div>
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Platform Status</div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm mt-1">
                    <Target size={16} className="text-slate-500" />
                    Conversion Funnel
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600">
                  {s.totalSubmissions || 0}
                </div>
              </div>

              <div className="space-y-4 relative">
                {[
                  { label: 'Pending Assessment', value: s.submissionsByStatus?.submitted || 0, color: 'bg-blue-600', icon: Inbox, bg: 'bg-blue-50 text-blue-600 border-blue-100/50' },
                  { label: 'Under Review', value: s.submissionsByStatus?.under_review || 0, color: 'bg-indigo-600', icon: Clock, bg: 'bg-indigo-50 text-indigo-600 border-indigo-100/50' },
                  { label: 'Approved Records', value: s.submissionsByStatus?.approved || 0, color: 'bg-emerald-500', icon: SquareCheck, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100/50' },
                  { label: 'Declined Submissions', value: s.submissionsByStatus?.rejected || 0, color: 'bg-rose-500', icon: AlertTriangle, bg: 'bg-rose-50 text-rose-600 border-rose-100/50' }
                ].map((st, i) => { 
                  const total = Math.max(s.totalSubmissions || 1, 1); 
                  const pct = (st.value / total) * 100;
                  return (
                    <div 
                      key={st.label}
                      onClick={() => {
                        if (st.label === 'Declined Submissions') setStatusModalType('rejected');
                        else if (st.label === 'Approved Records') setStatusModalType('approved');
                        else if (st.label === 'Under Review') setStatusModalType('under_review');
                        else if (st.label === 'Pending Assessment') setStatusModalType('submitted');
                        setStatusModalOpen(true);
                      }}
                      className="cursor-pointer group/funnel"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-md ${st.bg} border flex items-center justify-center`}><st.icon size={11} /></div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover/funnel:text-indigo-600 transition-colors">{st.label}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-900">{st.value}</span>
                      </div>
                      
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${pct}%` }} 
                          transition={{ delay: 0.3 + (i * 0.05), duration: 0.8, ease: "circOut" }} 
                          className={`h-full rounded-full ${st.color}`} 
                        />
                      </div>
                    </div>
                  ); 
                })}
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Success Index</span>
                <span className="text-emerald-600 font-bold">
                  {s.totalSubmissions > 0 ? Math.round(((s.submissionsByStatus?.approved || 0) / s.totalSubmissions) * 100) : 0}% Approved
                </span>
              </div>
            </div>

            {/* Premium System Information Widget */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Shield size={13} className="text-slate-400" />
                </div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Security Notice</h3>
              </div>
              <p className="text-[11.5px] text-slate-500 leading-relaxed font-medium mb-4">
                Your connection to the enterprise console is fully encrypted. All actions in this console are recorded in the central audit ledger for security compliance.
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[9.5px] font-bold text-indigo-600 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Secure Connection Active
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  }

  // ─── Modern Role-Based View (For Teachers, Reviewers, etc.) ───────────────
  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Welcome back, {user.name?.split(' ')[0]}</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 rounded-lg border border-primary/10">
              <School size={12} className="text-primary" />
              <span className="text-[11px] font-black text-primary uppercase tracking-wider">{user.school_code || 'KV001'}</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              {user.role === 'functionary' ? 'Managing your school nominations' : 
               user.role === 'reviewer' ? 'Evaluating submissions' : 'Your portal dashboard'}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {forms.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Filter by Form:</label>
              <select
                value={selectedFormId || ''}
                onChange={(e) => handleFormSelect(e.target.value || null)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary cursor-pointer"
              >
                <option value="">All Forms</option>
                {forms
                  .filter((form: any) => user.role !== 'functionary' || isFunctionaryAccessibleForm(form))
                  .map((form: any) => (
                    <option key={form._id || form.id} value={form._id || form.id}>
                      {form.title}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div className="hidden md:flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em]">
            <Clock size={12} /> {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      <motion.div {...anim(0)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {user.role === 'reviewer' && <>
          <StatCard label="Pending Reviews" value={s.pendingReviews || 0} icon={SquareCheck} color="amber" onClick={() => navigate('/reviews')} ctaText="Start Now" />
          <StatCard label="Completed" value={s.completedReviews || 0} icon={CircleCheck} color="green" />
          <StatCard label="Average Score" value={s.avgScore || 0} icon={TrendingUp} color="blue" />
          <StatCard label="Assigned Total" value={s.totalSubmissions || 0} icon={Inbox} color="purple" />
        </>}
        {user.role === 'functionary' && <>
          <StatCard label="Active Forms" value={functionaryVisibleActiveForms} icon={FileText} color="blue" onClick={() => navigate('/forms')} />
          <StatCard label="Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="purple" onClick={() => navigate('/submissions')} />
          <StatCard label="Nominations" value={s.totalNominations || 0} icon={UserPlus} color="green" subtitle={`${s.nominationsByStatus?.completed || 0} done`} onClick={() => navigate('/nominations')} />
          <StatCard label="School Reach" value={`${s.completionRate || 0}%`} icon={TrendingUp} color="purple" />
        </>}
        {user.role === 'teacher' && <>
          <StatCard label="Open Forms" value={s.activeForms || 0} icon={FileText} color="blue" onClick={() => navigate('/forms')} />
          <StatCard label="My Entries" value={s.totalSubmissions || 0} icon={Inbox} color="green" onClick={() => navigate('/submissions')} />
        </>}
      </motion.div>

      <div className={`grid grid-cols-1 ${(user.role as string) === 'admin' || user.role === 'reviewer' || user.role === 'functionary' ? 'lg:grid-cols-12' : ''} gap-8`}>
        <div className={(user.role as string) === 'admin' || user.role === 'reviewer' || user.role === 'functionary' ? 'lg:col-span-8 space-y-8' : 'space-y-8'}>
          {/* Enhanced Progress for Reviewers */}
          {user.role === 'reviewer' && (
            <motion.div {...anim(1)} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl" />
              <h3 className="font-black text-slate-800 text-sm mb-6 flex items-center gap-3 relative">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Target size={18} /></div>
                Overall Progress
              </h3>
              <div className="space-y-6 relative">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Completion</p>
                    <p className="text-3xl font-black text-slate-900">
                      {s.pendingReviews + s.completedReviews > 0 ? Math.round((s.completedReviews / (s.pendingReviews + s.completedReviews)) * 100) : 0}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                    <p className="text-sm font-bold text-emerald-500">On Track</p>
                  </div>
                </div>
                <div className="h-3 bg-slate-50 rounded-full overflow-hidden p-0.5 border border-slate-100 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${(s.completedReviews / Math.max(s.pendingReviews + s.completedReviews, 1)) * 100}%` }} 
                    className="h-full bg-gradient-to-r from-primary to-accent-blue rounded-full shadow-sm"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Modern Activity List */}
          <motion.div {...anim(2)} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-800 flex items-center gap-3 text-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Activity size={18} /></div>
                {user.role === 'teacher' ? 'My Recent Entries' : 'Recent Updates'}
              </h3>
              <button onClick={() => navigate('/submissions')} className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors">View All</button>
            </div>
            <div className="divide-y divide-slate-50">
              {recentSubs.length === 0 ? (
                <div className="p-16 text-center text-slate-300">
                  <Inbox size={40} className="mx-auto opacity-10 mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">No activity found</p>
                </div>
              ) : recentSubs.map((sub, i) => {
                const canOpenRecentSubmission = user.role !== 'functionary' && canOpenSubmission(sub);
                return (
                <div
                  key={subId(sub)}
                  onClick={() => { if (canOpenRecentSubmission) navigate(`/forms/view?submission=${subId(sub)}`); }}
                  className={`w-full text-left px-8 py-5 flex items-center gap-5 transition-all group ${canOpenRecentSubmission ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                >
                  <div className={`w-11 h-11 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center text-sm font-black transition-all border border-slate-100 ${canOpenRecentSubmission ? 'group-hover:bg-primary/10 group-hover:text-primary' : ''}`}>
                    {displaySubmissionNameFirstChar(sub)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold text-slate-900 truncate transition-colors ${canOpenRecentSubmission ? 'group-hover:text-primary' : ''}`}>{sub.form_title || 'Entry Detail'}</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-wider">{displaySubmissionName(sub)}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1.5">
                    <StatusBadge 
                      status={
                        (['teacher', 'functionary'].includes(user.role) && 
                         ['submitted', 'under_review', 'approved', 'rejected', 'next_level', 'completed'].includes(sub.status)) 
                        ? 'submitted' 
                        : (user.role === 'admin' ? sub.status : (['submitted', 'under_review', 'approved', 'rejected', 'next_level', 'completed'].includes(sub.status) ? 'submitted' : 'pending'))
                      } 
                      size="xs" 
                    />
                    <p className="text-[9px] text-slate-300 font-black uppercase tracking-tighter">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Active'}</p>
                  </div>
                  {canOpenRecentSubmission && (
                    <ChevronRight size={16} className="text-slate-200 group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-1" />
                  )}
                </div>
              )})}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Platform Updates & CTA */}
        {((user.role as string) === 'admin' || user.role === 'reviewer' || user.role === 'functionary') && (
          <div className="lg:col-span-4 space-y-8">
            <motion.div {...anim(3)} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-all" />
              <div className="relative z-10">
                <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                  <Award size={22} className="text-primary" />
                </div>
                <h3 className="text-xl font-black mb-3 leading-tight">Ready to start?</h3>
                <p className="text-white/60 text-xs font-medium leading-relaxed mb-8">
                  {user.role === 'reviewer' ? `You have ${s.pendingReviews || 0} submissions to evaluate. Your feedback helps teachers grow.` : 
                   user.role === 'functionary' ? 'Manage your school nominations and ensure all teachers complete their forms on time.' :
                   'Complete your pending forms to submit your profile for review.'}
                </p>
                <button 
                  onClick={() => navigate(user.role === 'reviewer' ? '/reviews' : user.role === 'functionary' ? '/nominations' : '/forms')}
                  className="w-full bg-white text-slate-900 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-primary hover:text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  Launch Dashboard <ArrowUpRight size={14} />
                </button>
              </div>
            </motion.div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Shield size={16} className="text-slate-400" />
                </div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Portal Notice</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium mb-4">
                Your session is secured with end-to-end encryption. For any technical support, please contact the district coordinator.
              </p>
              <div className="pt-4 border-t border-slate-50 flex items-center gap-3 text-[10px] font-black text-primary uppercase tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> System Online
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
