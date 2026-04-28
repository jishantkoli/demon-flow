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
        nomination_token: s.nominationToken || s.nomination_token,
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

      const [comms, formRes, nomsRes, fallbackRes, allFormNomsRes, tokenRes] = await Promise.allSettled([
        api.get(`/comments?submission_id=${sub.id}`).catch(() => []),
        formIdParam ? api.get(`/forms?id=${formIdParam}`) : Promise.resolve(null),
        nominationIdParam ? api.get(`/nominations?id=${nominationIdParam}`) : Promise.resolve([]),
        sub.user_email ? api.get(`/nominations?teacher_email=${encodeURIComponent(sub.user_email)}&form_id=${formIdParam}`) : Promise.resolve([]),
        formIdParam ? api.get(`/nominations?form_id=${formIdParam}`) : Promise.resolve([]),
        nominationTokenParam ? api.get(`/nominations/token/${encodeURIComponent(nominationTokenParam)}`) : Promise.resolve(null)
      ]);

      if (comms.status === 'fulfilled') setComments(comms.value || []);
      if (formRes.status === 'fulfilled') setSelectedFormObj(formRes.value);

      // Robust matching logic for nomination
      const allPossibleNoms: any[] = [];
      [nomsRes, fallbackRes, allFormNomsRes, tokenRes].forEach(res => {
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
        
        const norm = (v: any) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const userEmail = norm(sub.user_email);
        const userName = norm(sub.user_name);
        const schoolCode = norm(sub.school_code);
        const subNomId = norm(nominationIdParam);

        let matched = subNomId
          ? uniqueNoms.find((n: any) => norm(n?.id || n?._id) === subNomId)
          : undefined;
        if (!matched) matched = uniqueNoms.find((n: any) => norm(n.teacher_email) === userEmail);
        if (!matched && userName) matched = uniqueNoms.find((n: any) => norm(n.teacher_name) === userName);
        if (!matched && schoolCode) {
          const schoolMatches = uniqueNoms.filter((n: any) => norm(n.school_code) === schoolCode);
          if (schoolMatches.length === 1) matched = schoolMatches[0];
          if (!matched && userName && schoolMatches.length > 1) {
            matched = schoolMatches.find((n: any) => norm(n.teacher_name) === userName);
          }
        }
        if (!matched && uniqueNoms.length === 1) matched = uniqueNoms[0];
        
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

      const [formNomsRaw, byEmailRaw, byIdRaw, byTokenRaw] = await Promise.all([
        api.get(`/nominations?form_id=${sub.form_id}`).catch(() => []),
        sub.user_email ? api.get(`/nominations?form_id=${sub.form_id}&teacher_email=${encodeURIComponent(sub.user_email)}`).catch(() => []) : Promise.resolve([]),
        nominationIdParam ? api.get(`/nominations?id=${nominationIdParam}`).catch(() => []) : Promise.resolve([]),
        nominationTokenParam ? api.get(`/nominations/token/${encodeURIComponent(nominationTokenParam)}`).catch(() => null) : Promise.resolve(null)
      ]);
      const formNoms = Array.isArray(formNomsRaw) ? formNomsRaw : [];
      const byEmailNoms = Array.isArray(byEmailRaw) ? byEmailRaw : [];
      const byIdNoms = Array.isArray(byIdRaw) ? byIdRaw : [];
      const byTokenNoms = Array.isArray((byTokenRaw as any)?.data)
        ? (byTokenRaw as any).data
        : (byTokenRaw as any)?.data
          ? [(byTokenRaw as any).data]
          : [];
      const nomMap = new Map<string, any>();
      [...byTokenNoms, ...byIdNoms, ...formNoms, ...byEmailNoms].forEach((n: any) => {
        const key = String(n?.id || n?._id || `${n?.teacher_email || ''}-${n?.createdAt || ''}`);
        if (key) nomMap.set(key, n);
      });
      const allNoms = Array.from(nomMap.values());
      if (allNoms.length > 0) {
        const norm = (v: any) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const userEmail = norm(sub.user_email);
        const userName = norm(sub.user_name);
        const schoolCode = norm(sub.school_code);
        const subNomId = norm(nominationIdParam);
        let matched = subNomId
          ? allNoms.find((n: any) => norm(n?.id || n?._id) === subNomId)
          : undefined;
        if (!matched) matched = allNoms.find((n: any) => norm(n.teacher_email) === userEmail);
        if (!matched && userName) matched = allNoms.find((n: any) => norm(n.teacher_name) === userName);
        if (!matched && schoolCode) {
          const schoolMatches = allNoms.filter((n: any) => norm(n.school_code) === schoolCode);
          if (schoolMatches.length === 1) matched = schoolMatches[0];
          if (!matched && userName && schoolMatches.length > 1) {
            matched = schoolMatches.find((n: any) => norm(n.teacher_name) === userName);
          }
        }
        if (!matched && allNoms.length === 1) matched = allNoms[0];
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
    { key: 'id', label: '#', sortable: true, render: (v: string) => <span className="text-xs font-mono text-muted">#{v?.toString().slice(-6).toUpperCase() || '—'}</span> },
    { key: 'form_title', label: 'Form', sortable: true, render: (v: string) => <span className="font-medium text-sm">{v || 'Untitled'}</span> },
    { 
      key: 'user_name', 
      label: 'Submitted By', 
      sortable: true, 
      render: (v: string, row: any) => (
        <div 
          className="cursor-pointer hover:bg-primary/5 p-1 -m-1 rounded-lg transition-colors group"
          onClick={(e) => { e.stopPropagation(); openNominationOnly(row); }}
          title="Click to view nomination details"
        >
          <p className="text-sm font-medium group-hover:text-primary">{v || 'Anonymous'}</p>
          <p className="text-[10px] text-muted">{row.user_email}</p>
        </div>
      ) 
    },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    // Score column: hidden for teacher/functionary — they should NEVER see quiz scores
    { key: 'score', label: 'Score', sortable: true, hidden: !canSeeScore, render: (v: any) => v != null ? <span className="font-bold text-sm text-primary">{typeof v === 'object' ? v?.percentage : v}%</span> : <span className="text-muted">—</span> },
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

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Submission #${selected?.id || ''}`} size="xl">
        {selected && (
          <div className="space-y-5">
            {/* Meta cards — score only shown to admin/reviewer */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Form</p><p className="text-sm font-bold mt-0.5">{selected.form_title || `#${selected.form_id}`}</p></div>
              <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Submitted By</p><p className="text-sm font-bold mt-0.5">{selected.user_name || 'Anonymous'}</p></div>
              <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Status</p><div className="mt-0.5"><StatusBadge status={selected.status} /></div></div>
              {canSeeScore && (
                <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Score</p><p className="text-sm font-bold mt-0.5">{selected.score != null ? `${typeof selected.score === 'object' ? selected.score?.percentage : selected.score}%` : 'N/A'}</p></div>
              )}
            </div>

            {/* View full response button */}
            <button onClick={() => { setSelected(null); navigate(`/forms/view?submission=${selected.id}`); }}
              className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20 flex items-center gap-1.5 w-fit">
              <ExternalLink size={13} /> View Full Response (with form layout{canSeeScore ? ' + scoring' : ''})
            </button>

            {/* Nomination Data (Filled by Head/Functionary) */}
            {selectedNomination && (
              <div>
                <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                  <Inbox size={14} className="text-primary" /> Nomination Details (Filled by {selectedNomination.functionary_name || 'Head'})
                </h4>
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted uppercase font-bold">Nominated Name</p>
                      <p className="text-sm font-semibold">{selectedNomination.teacher_name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted uppercase font-bold">Nominated Email</p>
                      <p className="text-sm font-semibold">{selectedNomination.teacher_email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted uppercase font-bold">Nominated By</p>
                      <p className="text-sm font-semibold text-primary">{selectedNomination.functionary_name || 'School Head'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted uppercase font-bold">School Code</p>
                      <p className="text-sm font-semibold font-mono">{selectedNomination.school_code}</p>
                    </div>
                    {selectedNomination.teacher_phone ? (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted uppercase font-bold">Nominated Phone</p>
                        <p className="text-sm font-semibold">{selectedNomination.teacher_phone}</p>
                      </div>
                    ) : null}
                  </div>

                  {/* Custom fields from nomination */}
                  {Object.keys(nominationAdditionalData).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-primary/10 space-y-2">
                      <p className="text-[10px] text-muted uppercase font-bold mb-2">Form Data Filled by Functionary</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(nominationAdditionalData).map(([key, val]) => {
                          const isFile = typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val);
                          // Cloudinary returns full https:// URLs; fallback for legacy local filenames
                          const fileUrl = isFile ? (typeof val === 'string' && val.startsWith('http') ? val as string : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(val as string)}`) : '';

                          // Find label from form settings
                          let label = key;
                          const customField = nominationSettings.nomination_custom_fields?.find((cf: any) => cf.id === key);
                          if (customField) label = customField.label;

                          return (
                            <div key={key} className="space-y-1">
                              <p className="text-[10px] text-muted font-bold">{label}</p>
                              {isFile ? (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" 
                                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                                  <ExternalLink size={10} /> View File ({val as string})
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
                </div>
              </div>
            )}

            {/* Raw responses */}
            <div><h4 className="text-sm font-bold mb-2">Response Data</h4>
              <div className="bg-surface rounded-xl p-4 space-y-2">
                {!selectedNomination ? (
                    <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      School functionary nomination is not linked to this submission, so functionary-filled data cannot be shown here.
                    </div>
                  ) : (
                    <div className="mb-4 p-3 bg-primary/5 border border-primary/10 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-[10px] text-muted uppercase font-bold">School Code</p>
                        <p className="text-xs font-semibold">{selectedNomination.school_code}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted uppercase font-bold">Teacher Phone</p>
                        <p className="text-xs font-semibold">{selectedNomination.teacher_phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted uppercase font-bold">Nominated By</p>
                        <p className="text-xs font-semibold text-primary">{selectedNomination.functionary_name || 'School Head'}</p>
                      </div>
                    </div>
                  )}
                {selectedNomination && Object.keys(nominationAdditionalData).length === 0 && (
                  <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    Nomination is linked, but no extra custom fields were saved by school functionary for this teacher.
                  </div>
                )}
                {Object.keys(nominationAdditionalData).length > 0 && (
                  <>
                    <div className="text-[10px] font-bold text-primary uppercase tracking-wide pb-1 border-b border-primary/20">
                      Filled By School Functionary
                    </div>
                    {Object.entries(nominationAdditionalData).map(([key, val]) => {
                      const isFile = typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val);
                      const fileUrl = isFile
                        ? (typeof val === 'string' && val.startsWith('http')
                          ? val
                          : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(val as string)}`)
                        : '';

                      let label = key;
                      const customField = nominationSettings.nomination_custom_fields?.find((cf: any) => cf.id === key);
                      if (customField) label = customField.label;

                      return (
                        <div key={`nom-${key}`} className="flex flex-col sm:flex-row sm:items-start gap-1 py-1.5 border-b border-border/30">
                          <span className="text-xs font-semibold text-muted min-w-[160px] shrink-0">{label}:</span>
                          <span className="text-sm break-words flex flex-wrap items-center gap-2">
                            {isFile ? (
                              <>
                                <span className="font-medium text-primary">{val as string}</span>
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-colors">
                                  <ExternalLink size={10} /> View File
                                </a>
                              </>
                            ) : (
                              Array.isArray(val) ? (val as any[]).join(', ') : typeof val === 'object' ? JSON.stringify(val) : String(val)
                            )}
                          </span>
                        </div>
                      );
                    })}
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide pt-1">
                      Filled By Teacher
                    </div>
                  </>
                )}
                {Object.keys(responses).length === 0 ? <p className="text-sm text-muted">No response data</p> :
                  Object.entries(responses).map(([key, val]) => {
                    const isFile = typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val);
                    // Cloudinary returns full https:// URLs; fallback for legacy local filenames
                    const fileUrl = isFile ? (typeof val === 'string' && val.startsWith('http') ? val : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(val)}`) : '';

                    // Find label from form schema
                    const fieldMeta = fieldMap[key];
                    const label = fieldMeta?.label || key;

                    const getDisplayValue = () => {
                      if (Array.isArray(val)) return (val as any[]).join(', ');
                      if (typeof val === 'object') return JSON.stringify(val);

                      // MCQ/choice fields may store index (e.g. "0", "1"); show option text instead.
                      const options = Array.isArray(fieldMeta?.options) ? fieldMeta.options : [];
                      if (options.length > 0) {
                        const idx = Number(String(val));
                        if (!Number.isNaN(idx) && options[idx] !== undefined) {
                          return String(options[idx]);
                        }
                      }

                      return String(val);
                    };

                    return (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 py-1.5 border-b border-border/30 last:border-0">
                        <span className="text-xs font-semibold text-muted min-w-[160px] shrink-0">{label}:</span>
                        <span className="text-sm break-words flex flex-wrap items-center gap-2">
                          {isFile ? (
                            <>
                              <span className="font-medium text-primary">{val as string}</span>
                              <a href={fileUrl} target="_blank" rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-colors">
                                <ExternalLink size={10} /> View File
                              </a>
                            </>
                          ) : (
                            getDisplayValue()
                          )}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Comments */}
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
          </div>
        )}
      </Modal>

      {/* Nomination Profile Modal */}
      <Modal open={showNomProfile} onClose={() => { setShowNomProfile(false); setSelected(null); }} title="Nomination Profile" size="lg">
        {selectedNomination ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-lg">
                {selectedNomination.teacher_name?.charAt(0) || 'T'}
              </div>
              <div>
                <h3 className="text-lg font-bold">{selectedNomination.teacher_name}</h3>
                <p className="text-sm text-muted">{selectedNomination.teacher_email}</p>
              </div>
              <div className="ml-auto text-right">
                <span className="text-[10px] uppercase font-bold text-muted block mb-1">Status</span>
                <StatusBadge status={selectedNomination.status || 'completed'} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-surface rounded-xl border border-border">
                <p className="text-[10px] text-muted uppercase font-bold mb-2">Basic Information</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted">School Code</p>
                    <p className="text-sm font-semibold font-mono">{selectedNomination.school_code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Phone Number</p>
                    <p className="text-sm font-semibold">{selectedNomination.teacher_phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Nominated By</p>
                    <p className="text-sm font-semibold text-primary">{selectedNomination.functionary_name || 'School Head'}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface rounded-xl border border-border">
                <p className="text-[10px] text-muted uppercase font-bold mb-2">Submission Context</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted">Form Applied</p>
                    <p className="text-sm font-semibold">{selected?.form_title || 'Untitled Form'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Submission Date</p>
                    <p className="text-sm font-semibold">{selected?.submitted_at ? new Date(selected.submitted_at).toLocaleString() : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Current Status</p>
                    <p className="text-sm font-semibold capitalize">{selected?.status?.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom fields from nomination */}
            {Object.keys(nominationAdditionalData).length > 0 && (
              <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-2xl">
                <h4 className="text-sm font-bold text-amber-900 mb-4 flex items-center gap-2">
                  <Eye size={16} /> Details Filled by Functionary
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                  {Object.entries(nominationAdditionalData).map(([key, val]) => {
                    const isFile = typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val);
                    const fileUrl = isFile ? (typeof val === 'string' && val.startsWith('http') ? val as string : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(val as string)}`) : '';

                    let label = key;
                    const customField = nominationSettings.nomination_custom_fields?.find((cf: any) => cf.id === key);
                    if (customField) label = customField.label;

                    return (
                      <div key={key} className="space-y-1">
                        <p className="text-[11px] text-amber-700/70 font-bold uppercase tracking-tight">{label}</p>
                        {isFile ? (
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-white px-2 py-1 rounded-lg border border-primary/10">
                            <ExternalLink size={12} /> View Document
                          </a>
                        ) : (
                          <p className="text-sm font-semibold text-slate-800">{String(val)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="flex justify-end pt-2">
              <button onClick={() => { setShowNomProfile(false); openDetail(selected); }} 
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover shadow-sm flex items-center gap-2">
                <ExternalLink size={16} /> View Full Submission
              </button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Inbox size={32} />
            </div>
            <p className="text-slate-500 font-medium">No nomination details found for this user.</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">This submission might have been made directly without a functionary nomination, or the data is not linked correctly.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
