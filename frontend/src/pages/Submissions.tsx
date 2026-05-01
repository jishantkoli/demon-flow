import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { Eye, MessageSquare, Filter, Send, FileDown, Inbox, ExternalLink } from 'lucide-react';

export default function Submissions({ user }: { user: User }) {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [selectedFormObj, setSelectedFormObj] = useState<any>(null);
  const [selectedNomination, setSelectedNomination] = useState<any>(null);
  const [showNomProfile, setShowNomProfile] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [forms, setForms] = useState<any[]>([]);
  const [formFilter, setFormFilter] = useState('');

  const canSeeScore = user.role === 'admin' || user.role === 'reviewer';
  const norm = (v: any) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const emailLocal = (v: any) => norm(v).split('@')[0];
  const compact = (v: any) => norm(v).replace(/[^a-z0-9]/g, '');
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

  const parseResponses = (raw: any): Record<string, any> => {
    if (!raw) return {};
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        const out: Record<string, any> = {};
        parsed.forEach((r: any) => {
          if (r?.fieldId) out[r.fieldId] = r.value;
        });
        return out;
      }
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const getFormForSubmission = (row: any) => {
    const rawFormId = typeof row?.form_id === 'object' ? (row.form_id?._id || row.form_id?.id) : row?.form_id;
    const target = String(rawFormId || '');
    return forms.find((f: any) => String(f?.id || f?._id || '') === target) || null;
  };

  const isNominationSubmission = (row: any) => {
    const f = getFormForSubmission(row);
    const formType = f?.form_type || f?.formType || row?.form_type || row?.formType;
    return formType === 'nomination';
  };

  const isAnonymousDirectForm = (row: any) => {
    const f = getFormForSubmission(row);
    const settings = parseObject(f?.settings);
    return settings.auth_mode === 'anonymous' || settings.login_type === 'direct' || settings.teacher_login === 'direct';
  };

  const extractNameEmailFromSubmission = (row: any) => {
    const responses = parseResponses(row?.responses);
    const f = getFormForSubmission(row);
    const schemaSource = f?.form_schema || f?.schema;
    let schemaObj: any = null;
    if (schemaSource) {
      schemaObj = typeof schemaSource === 'string'
        ? (() => { try { return JSON.parse(schemaSource); } catch { return null; } })()
        : schemaSource;
    }

    const fieldList: any[] = [];
    const collectFields = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach((x: any) => {
        if (!x || typeof x !== 'object') return;
        fieldList.push(x);
        if (Array.isArray(x.children)) collectFields(x.children);
      });
    };
    if (Array.isArray(schemaObj?.sections)) schemaObj.sections.forEach((s: any) => collectFields(s?.fields || []));

    const findById = (matcher: (fld: any) => boolean) => fieldList.find(matcher)?.id;
    const nameFieldId = findById((fld: any) => /name/i.test(String(fld?.label || '')));
    const emailFieldId = findById((fld: any) => fld?.type === 'email' || /email/i.test(String(fld?.label || '')));

    let name = row?.user_name;
    let email = row?.user_email;

    if (!name || norm(name) === 'anonymous') {
      if (nameFieldId && responses[nameFieldId]) name = responses[nameFieldId];
      if ((!name || norm(name) === 'anonymous') && responses['name']) name = responses['name'];
      if ((!name || norm(name) === 'anonymous') && responses['full_name']) name = responses['full_name'];
    }

    if (!email) {
      if (emailFieldId && responses[emailFieldId]) email = responses[emailFieldId];
      if (!email && responses['email']) email = responses['email'];
      if (!email && responses['user_email']) email = responses['user_email'];
    }

    return { name, email };
  };

  const pickBestNomination = (nominations: any[], sub: any, nominationIdParam?: any) => {
    if (!Array.isArray(nominations) || nominations.length === 0) return null;

    const userEmail = norm(sub?.user_email);
    const userName = norm(sub?.user_name);
    const schoolCode = norm(sub?.school_code);
    const subNomId = norm(nominationIdParam);
    const userEmailLocal = emailLocal(userEmail);
    const userNameCompact = compact(userName);

    // 1) Strong exact matching first
    let matched = subNomId
      ? nominations.find((n: any) => norm(n?.id || n?._id) === subNomId)
      : undefined;
    if (!matched) matched = nominations.find((n: any) => norm(n.teacher_email) === userEmail);
    if (!matched && userEmail) matched = nominations.find((n: any) => emailLocal(n.teacher_email) === userEmailLocal);
    if (!matched && userName) matched = nominations.find((n: any) => norm(n.teacher_name) === userName);
    if (matched) return matched;

    // 2) Score-based best candidate fallback (for minor typos/case/format issues)
    const scored = nominations.map((n: any) => {
      const nEmail = norm(n.teacher_email);
      const nEmailLocal = emailLocal(n.teacher_email);
      const nName = norm(n.teacher_name);
      const nNameCompact = compact(n.teacher_name);
      const nSchool = norm(n.school_code);

      let score = 0;
      if (schoolCode && nSchool === schoolCode) score += 30;
      if (userEmailLocal && nEmailLocal === userEmailLocal) score += 40;
      if (userNameCompact && nNameCompact === userNameCompact) score += 35;
      if (userNameCompact && nNameCompact && (nNameCompact.includes(userNameCompact) || userNameCompact.includes(nNameCompact))) score += 20;
      if (userEmail && nEmail && (nEmail.includes(userEmail) || userEmail.includes(nEmail))) score += 15;

      return { n, score };
    }).sort((a, b) => b.score - a.score);

    if (scored[0]?.score > 0) return scored[0].n;
    return null;
  };

  const fetchData = async () => {
    try {
      let url = '/submissions?';
      if (user.role === 'teacher') url += `user_id=${user.id}&`;
      if (statusFilter) url += `status=${statusFilter}&`;
      if (formFilter) url += `form_id=${formFilter}&`;
      const [subs, f] = await Promise.all([
        api.get(url).catch(() => []),
        api.get('/forms').catch(() => [])
      ]);
      
      const mappedSubs = (Array.isArray(subs) ? subs : []).map((s: any) => ({
        ...s,
        id: s._id || s.id,
        form_id: s.formId || s.form_id,
        nomination_id: s.nominationId || s.nomination_id,
        // Ensure unique_token is mapped correctly for the frontend
        nomination_token: s.unique_token || s.nominationToken || s.nomination_token,
        unique_token: s.unique_token || s.nominationToken || s.nomination_token,
        user_email: s.userEmail || s.user_email,
        user_name: s.userName || s.user_name,
        school_code: s.schoolCode || s.school_code,
        form_title: s.formTitle || s.form_title,
        submitted_at: s.createdAt || s.submitted_at
      }));
      
      setSubmissions(mappedSubs);
      setForms(Array.isArray(f) ? f : []);
    } catch (err) { 
      console.error('Error fetching submissions:', err);
      setSubmissions([]);
      setForms([]);
    } finally { 
      setLoading(false); 
    }
  };
  useEffect(() => { fetchData(); }, [statusFilter, formFilter]);

  const openDetail = async (sub: any) => {
    setSelected(sub);
    setComments([]);
    setSelectedNomination(null);
    setSelectedFormObj(null);
    try {
      const formIdParam = sub.form_id || sub.formId;
      const nominationIdParamRaw = sub.nomination_id || sub.nominationId;
      const nominationIdParam = typeof nominationIdParamRaw === 'object'
        ? (nominationIdParamRaw?._id || nominationIdParamRaw?.id || '')
        : nominationIdParamRaw;
      const nominationTokenParam = sub.nomination_token || sub.nominationToken;

      const [comms, formRes, nomsRes, fallbackRes, tokenRes] = await Promise.allSettled([
        api.get(`/comments?submission_id=${sub.id}`).catch(() => []),
        formIdParam ? api.get(`/forms?id=${formIdParam}`) : Promise.resolve(null),
        nominationIdParam ? api.get(`/nominations?id=${nominationIdParam}`) : Promise.resolve([]),
        sub.user_email ? api.get(`/nominations?teacher_email=${encodeURIComponent(sub.user_email)}&form_id=${formIdParam}`) : Promise.resolve([]),
        nominationTokenParam ? api.get(`/nominations/token/${encodeURIComponent(nominationTokenParam)}`) : Promise.resolve(null)
      ]);

      if (comms.status === 'fulfilled') setComments(comms.value || []);
      if (formRes.status === 'fulfilled') setSelectedFormObj(formRes.value);

      // Robust matching logic for nomination
      const allPossibleNoms: any[] = [];
      [nomsRes, fallbackRes, tokenRes].forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
          const payload: any = res.value;
          const data = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : payload?.data
                ? [payload.data]
                : [payload];
          allPossibleNoms.push(...data.filter(Boolean));
        }
      });

      if (allPossibleNoms.length > 0) {
        const nomMap = new Map<string, any>();
        allPossibleNoms.forEach((n: any) => {
          const key = String(n?.id || n?._id || `${n?.teacher_email || ''}-${n?.createdAt || ''}`);
          if (key) nomMap.set(key, n);
        });
        const uniqueNoms = Array.from(nomMap.values());
        
        const matched = pickBestNomination(uniqueNoms, sub, nominationIdParam);
        
        if (matched) setSelectedNomination(matched);
      }
    } catch (err: any) {
      // Don't log if it's a known 404 or comments-related error from old code
      const msg = String(err?.message || err || "").toLowerCase();
      if (!msg.includes('404') && !msg.includes('comments') && !msg.includes('not found')) {
        console.error("Error loading submission details:", err);
      }
      setComments([]);
    }
  };

  const openNominationOnly = async (sub: any) => {
    // Similar to openDetail but specifically for the nomination modal
    setSelected(sub);
    setSelectedNomination(null);
    try {
      const nominationIdParamRaw = sub.nomination_id || sub.nominationId;
      const nominationIdParam = typeof nominationIdParamRaw === 'object'
        ? (nominationIdParamRaw?._id || nominationIdParamRaw?.id || '')
        : nominationIdParamRaw;
      const nominationTokenParam = sub.nomination_token || sub.nominationToken;

      const [byEmailRaw, byIdRaw, byTokenRaw] = await Promise.all([
        sub.user_email ? api.get(`/nominations?form_id=${sub.form_id}&teacher_email=${encodeURIComponent(sub.user_email)}`).catch(() => []) : Promise.resolve([]),
        nominationIdParam ? api.get(`/nominations?id=${nominationIdParam}`).catch(() => []) : Promise.resolve([]),
        nominationTokenParam ? api.get(`/nominations/token/${encodeURIComponent(nominationTokenParam)}`).catch(() => null) : Promise.resolve(null)
      ]);
      const byEmailNoms = Array.isArray(byEmailRaw) ? byEmailRaw : [];
      const byIdNoms = Array.isArray(byIdRaw) ? byIdRaw : [];
      const byTokenNoms = (byTokenRaw as any)?.data
        ? [ (byTokenRaw as any).data ]
        : Array.isArray((byTokenRaw as any)) ? (byTokenRaw as any) : [];
        
      const nomMap = new Map<string, any>();
      [...byTokenNoms, ...byIdNoms, ...byEmailNoms].forEach((n: any) => {
        const key = String(n?.id || n?._id || `${n?.teacher_email || ''}-${n?.createdAt || ''}`);
        if (key) nomMap.set(key, n);
      });
      const allNoms = Array.from(nomMap.values());
      if (allNoms.length > 0) {
        const matched = pickBestNomination(allNoms, sub, nominationIdParam);
        if (matched) setSelectedNomination(matched);
      }
      // Also fetch form to get labels for custom fields
      const formRes = await api.get(`/forms?id=${sub.form_id}`);
      if (formRes) setSelectedFormObj(formRes);
      
      setShowNomProfile(true);
    } catch (err) {
      console.error("Error loading nomination:", err);
    }
  };

  const addComment = async () => {
    // Comments endpoint does not exist on backend; avoid triggering 404.
    if (!newComment.trim() || !selected) return;
    console.warn('Comments API is not configured. Skipping comment submit.');
    setNewComment('');
  };

  const exportCSV = () => {
    const headers = ['ID', 'Form', 'User', 'Email', 'Status', 'Score', 'Date'];
    const rows = submissions.map(s => [s.id, s.form_title || '', s.user_name || '', s.user_email || '', s.status, typeof s.score === 'object' ? s.score?.percentage ?? '' : (s.score ?? ''), s.submitted_at || '']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `submissions-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  let responses: Record<string, any> = {};
  if (selected?.responses) { 
    try { 
      const respSource = selected.responses;
      const parsed = typeof respSource === 'string' ? JSON.parse(respSource) : respSource;
      if (Array.isArray(parsed)) {
        parsed.forEach((r: any) => {
          if (r.fieldId) responses[r.fieldId] = r.value;
        });
      } else {
        responses = parsed || {};
      }
    } catch { 
      responses = {}; 
    } 
  }

  const nominationAdditionalData = parseObject(selectedNomination?.additional_data);
  const nominationSettings = parseObject(selectedFormObj?.settings);

  const getFieldMap = () => {
    const out: Record<string, any> = {};
    const walk = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach((f: any) => {
        if (!f || typeof f !== 'object') return;
        if (f.id) out[f.id] = f;
        if (Array.isArray(f.children)) walk(f.children);
      });
    };

    const schemaSource = selectedFormObj?.form_schema || selectedFormObj?.schema;
    let schemaObj: any = null;
    if (schemaSource) {
      schemaObj = typeof schemaSource === 'string' ? (() => { try { return JSON.parse(schemaSource); } catch { return null; } })() : schemaSource;
    }

    if (Array.isArray(schemaObj)) {
      walk(schemaObj);
    } else if (schemaObj?.sections && Array.isArray(schemaObj.sections)) {
      schemaObj.sections.forEach((s: any) => walk(s?.fields || []));
    } else if (schemaObj?.fields && Array.isArray(schemaObj.fields)) {
      walk(schemaObj.fields);
    }

    if (Object.keys(out).length === 0) {
      const formFields = typeof selectedFormObj?.fields === 'string'
        ? (() => { try { return JSON.parse(selectedFormObj.fields); } catch { return []; } })()
        : (selectedFormObj?.fields || []);
      walk(formFields);
    }

    return out;
  };
  const fieldMap = getFieldMap();

  const columns = [
    {
      key: 'id',
      label: 'Reference ID',
      sortable: true,
      render: (_v: string, row: any) => {
        const isNom = isNominationSubmission(row);
        const refId = isNom ? (row.unique_token || row.nomination_token || row.id) : row.id;
        return <span className="text-xs font-mono text-muted">{refId || '—'}</span>;
      }
    },
    { key: 'form_title', label: 'Form', sortable: true, render: (v: string) => <span className="font-medium text-sm">{v || 'Untitled'}</span> },
    { 
      key: 'user_name', 
      label: 'Submitted By', 
      sortable: true, 
      render: (v: string, row: any) => (
        <div
          className={`p-1 -m-1 rounded-lg transition-colors group ${isNominationSubmission(row) ? 'cursor-pointer hover:bg-primary/5' : ''}`}
          onClick={(e) => {
            if (!isNominationSubmission(row)) return;
            e.stopPropagation();
            openNominationOnly(row);
          }}
          title={isNominationSubmission(row) ? 'Click to view nomination details' : ''}
        >
          <p className="text-sm font-medium group-hover:text-primary">
            {(() => {
              const { name } = extractNameEmailFromSubmission(row);
              if (isAnonymousDirectForm(row)) return name || 'Anonymous';
              return v || name || 'Anonymous';
            })()}
          </p>
          <p className="text-[10px] text-muted">
            {(() => {
              const { email } = extractNameEmailFromSubmission(row);
              return row.user_email || email || '';
            })()}
          </p>
        </div>
      ) 
    },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    // Score column: hidden for teacher/functionary — they should NEVER see quiz scores
    { key: 'score', label: 'Score', sortable: true, hidden: !canSeeScore, render: (v: any) => v != null ? <span className="font-bold text-sm text-primary">{Number(typeof v === 'object' ? v?.percentage : v).toFixed(2)}%</span> : <span className="text-muted">—</span> },
    { key: 'submitted_at', label: 'Date', sortable: true, render: (v: string) => v ? <span className="text-xs text-muted">{new Date(v).toLocaleDateString()}</span> : '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold font-heading">Submissions</h1><p className="text-sm text-muted">{user.role === 'admin' ? 'All form submissions with review data' : 'Your submissions'}</p></div>
        {user.role === 'admin' && <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 bg-surface-card border border-border rounded-xl text-sm font-medium hover:bg-surface shadow-sm"><FileDown size={16} /> Export CSV</button>}
      </div>

      <DataTable columns={columns} data={submissions} loading={loading} searchPlaceholder="Search by form, user, email..."
        onRowClick={openDetail} emptyMessage="No submissions found" emptyIcon={<Inbox size={40} />}
        filters={<div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-muted" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs bg-surface border border-border rounded-xl px-3 py-1.5 outline-none" aria-label="Filter by status">
            <option value="">All Status</option><option value="submitted">Submitted</option><option value="under_review">Under Review</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
          <select value={formFilter} onChange={e => setFormFilter(e.target.value)} className="text-xs bg-surface border border-border rounded-xl px-3 py-1.5 outline-none" aria-label="Filter by form">
            <option value="">All Forms</option>{forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}</select>
        </div>}
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={isNominationSubmission(selected) ? `Token: ${selected?.unique_token || selected?.nomination_token || selected?.id || ''}` : `Submission #${selected?.id || ''}`} size="xl">
        {selected && (
          <div className="space-y-5">
            {/* Meta cards — score only shown to admin/reviewer */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-surface rounded-xl p-3">
                <p className="text-[10px] text-muted uppercase font-semibold">{isNominationSubmission(selected) ? 'Token' : 'Submission ID'}</p>
                <p className="text-sm font-bold mt-0.5 text-primary">
                  {isNominationSubmission(selected)
                    ? (selected.unique_token || selected.nomination_token || selected.id || 'N/A')
                    : (selected.id || 'N/A')}
                </p>
              </div>
              <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Form</p><p className="text-sm font-bold mt-0.5">{selected.form_title || `#${selected.form_id}`}</p></div>
              <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Submitted By</p><p className="text-sm font-bold mt-0.5">{selected.user_name || 'Anonymous'}</p></div>
              <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Status</p><div className="mt-0.5"><StatusBadge status={selected.status} /></div></div>
              {canSeeScore && (
                <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Score</p><p className="text-sm font-bold mt-0.5">{selected.score != null ? `${Number(typeof selected.score === 'object' ? selected.score?.percentage : selected.score).toFixed(2)}%` : 'N/A'}</p></div>
              )}
            </div>

            {/* View full response button - Hidden for functionaries */}
            {canSeeScore && (
              <button onClick={() => { setSelected(null); navigate(`/forms/view?submission=${selected.id}`); }}
                className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20 flex items-center gap-1.5 w-fit">
                <ExternalLink size={13} /> View Full Response (with form layout + scoring)
              </button>
            )}

            {/* Nomination Data (Filled by Head/Functionary) */}
            {selectedNomination && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Side: School Functionary Details */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold flex items-center gap-2 text-primary border-b border-primary/10 pb-2">
                    <Inbox size={14} /> 1. School Functionary Form Details
                  </h4>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted uppercase font-bold">Nominated Name</p>
                        <p className="text-sm font-semibold">{selectedNomination.teacher_name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted uppercase font-bold">Nominated Email</p>
                        <p className="text-sm font-semibold">{selectedNomination.teacher_email}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted uppercase font-bold">School Code</p>
                        <p className="text-sm font-semibold font-mono">{selectedNomination.school_code}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted uppercase font-bold">Nominated By</p>
                        <p className="text-sm font-semibold text-primary">{selectedNomination.functionary_name || 'School Head'}</p>
                      </div>
                    </div>

                    {/* Custom fields from nomination */}
                    {Object.keys(nominationAdditionalData).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-primary/10 space-y-3">
                        <p className="text-[10px] text-muted uppercase font-bold">Additional Nomination Info</p>
                        {Object.entries(nominationAdditionalData).map(([key, val]) => {
                          const isFile = typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val);
                          const fileUrl = isFile ? (typeof val === 'string' && val.startsWith('http') ? val as string : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(val as string)}`) : '';
                          
                          let label = key;
                          const customField = nominationSettings.nomination_custom_fields?.find((cf: any) => cf.id === key);
                          if (customField) label = customField.label;

                          return (
                            <div key={key} className="space-y-1">
                              <p className="text-[10px] text-muted font-bold">{label}</p>
                              {isFile ? (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" 
                                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                                  <ExternalLink size={10} /> View File
                                </a>
                              ) : (
                                <p className="text-sm font-semibold">{String(val)}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Teacher Form Responses - ONLY for Admin/Reviewers */}
                {canSeeScore && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold flex items-center gap-2 text-slate-700 border-b border-slate-200 pb-2">
                      <Send size={14} /> 2. Teacher Form Responses
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 max-h-[400px] overflow-y-auto">
                      {Object.keys(responses).length === 0 ? (
                        <p className="text-sm text-muted">No response data from teacher yet.</p>
                      ) : (
                        Object.entries(responses).map(([key, val]) => {
                          const isFile = typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val);
                          const fileUrl = isFile ? (typeof val === 'string' && val.startsWith('http') ? val : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(val)}`) : '';
                          const fieldMeta = fieldMap[key];
                          const label = fieldMeta?.label || key;

                          const getDisplayValue = () => {
                            if (Array.isArray(val)) return (val as any[]).join(', ');
                            const options = Array.isArray(fieldMeta?.options) ? fieldMeta.options : [];
                            if (options.length > 0) {
                              const idx = Number(String(val));
                              if (!Number.isNaN(idx) && options[idx] !== undefined) return String(options[idx]);
                            }
                            return String(val);
                          };

                          return (
                            <div key={key} className="space-y-1 pb-2 border-b border-slate-200 last:border-0">
                              <p className="text-[10px] text-muted font-bold uppercase">{label}</p>
                              <div className="text-sm font-semibold break-words">
                                {isFile ? (
                                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" 
                                    className="inline-flex items-center gap-1 text-primary hover:underline">
                                    <ExternalLink size={10} /> View Uploaded File
                                  </a>
                                ) : getDisplayValue()}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedNomination && (
              <div className="bg-surface rounded-xl p-4 space-y-2">
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  School functionary nomination is not linked to this submission.
                </div>
                {/* Fallback to show teacher responses anyway - Only for Admin/Reviewers */}
                {canSeeScore && (
                  <div className="space-y-4 mt-4">
                    <h4 className="text-sm font-bold">Teacher Form Responses</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      {Object.entries(responses).map(([key, val]) => (
                        <div key={key} className="space-y-1 pb-2 border-b border-slate-200 last:border-0">
                          <p className="text-[10px] text-muted font-bold uppercase">{fieldMap[key]?.label || key}</p>
                          <p className="text-sm font-semibold">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Comments - Only for Admin/Reviewers */}
            {canSeeScore && (
              <div><h4 className="text-sm font-bold mb-2 flex items-center gap-2"><MessageSquare size={14} /> Comments ({comments.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {comments.map(c => (<div key={c.id} className="bg-surface rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold">{c.user_name}</span><span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-card border border-border capitalize">{c.user_role}</span><span className="text-[10px] text-muted ml-auto">{new Date(c.created_at).toLocaleString()}</span></div>
                    <p className="text-sm">{c.content}</p></div>))}
                </div>
                <div className="flex gap-2 mt-3">
                  <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." onKeyDown={e => e.key === 'Enter' && addComment()}
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-surface text-sm outline-none focus:border-primary" />
                  <button onClick={addComment} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover min-h-[44px]"><Send size={14} /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showNomProfile} onClose={() => setShowNomProfile(false)} title="Teacher Nomination Profile" size="lg">
        {selectedNomination && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-primary text-2xl font-bold">
                {selectedNomination.teacher_name?.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold">{selectedNomination.teacher_name}</h3>
                <p className="text-sm text-muted">{selectedNomination.teacher_email}</p>
                <div className="mt-1 flex gap-2">
                  <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold uppercase tracking-wider">{selectedNomination.school_code}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold uppercase tracking-wider">{selectedNomination.status}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase text-muted tracking-widest border-b pb-1">Basic Info</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-muted uppercase font-bold">Phone Number</p>
                    <p className="text-sm font-medium">{selectedNomination.teacher_phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted uppercase font-bold">Nominated By</p>
                    <p className="text-sm font-medium">{selectedNomination.functionary_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted uppercase font-bold">Nomination Date</p>
                    <p className="text-sm font-medium">{new Date(selectedNomination.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase text-muted tracking-widest border-b pb-1">Functionary Input</h4>
                <div className="space-y-3">
                  {Object.keys(nominationAdditionalData).length === 0 ? (
                    <p className="text-sm text-muted italic">No additional data provided by school head.</p>
                  ) : (
                    Object.entries(nominationAdditionalData).map(([key, val]) => {
                      const field = nominationSettings.nomination_custom_fields?.find((f: any) => f.id === key);
                      return (
                        <div key={key}>
                          <p className="text-[10px] text-muted uppercase font-bold">{field?.label || key}</p>
                          <p className="text-sm font-medium">{String(val)}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t flex justify-end">
              <button onClick={() => setShowNomProfile(false)} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-bold transition-colors">Close Profile</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
