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
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [forms, setForms] = useState<any[]>([]);
  const [formFilter, setFormFilter] = useState('');

  const canSeeScore = user.role === 'admin' || user.role === 'reviewer';

  const fetchData = async () => {
    try {
      let url = '/submissions?';
      if (user.role === 'teacher' || user.role === 'functionary') url += `user_id=${user.id}&`;
      if (statusFilter) url += `status=${statusFilter}&`;
      if (formFilter) url += `form_id=${formFilter}&`;
      const [subs, f] = await Promise.all([
        api.get(url).catch(() => []),
        api.get('/forms').catch(() => [])
      ]);
      setSubmissions(Array.isArray(subs) ? subs : []);
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
    setSelectedNomination(null);
    setSelectedFormObj(null);
    try { 
      // 1. Fetch form object to get schema/settings
      const formRes = await api.get(`/forms?id=${sub.form_id}`);
      if (formRes) setSelectedFormObj(formRes);

      // 2. Fetch comments
      const comms = await api.get(`/comments?submission_id=${sub.id}`);
      setComments(comms);

      // 3. Fetch nomination data by form_id AND teacher_email (form_id links to the form, teacher_email links to the specific nomination for this submission)
      const nomsRes = await api.get(`/nominations?form_id=${sub.form_id}&teacher_email=${encodeURIComponent(sub.user_email)}`).catch(() => []);
      const noms = Array.isArray(nomsRes) ? nomsRes : [];

      if (noms.length > 0) {
        setSelectedNomination(noms[0]);
      }
    } catch (err) { 
      console.error("Error loading submission details:", err);
      setComments([]); 
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selected) return;
    await api.post('/comments', { submission_id: selected.id, user_id: user.id, user_name: user.name, user_role: user.role, content: newComment });
    setNewComment(''); setComments(await api.get(`/comments?submission_id=${selected.id}`));
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
    { key: 'id', label: '#', sortable: true, render: (v: number) => <span className="text-xs font-mono text-muted">#{v}</span> },
    { key: 'form_title', label: 'Form', sortable: true, render: (v: string) => <span className="font-medium text-sm">{v || 'Untitled'}</span> },
    { key: 'user_name', label: 'Submitted By', sortable: true, render: (v: string, row: any) => (<div><p className="text-sm">{v || 'Anonymous'}</p><p className="text-[10px] text-muted">{row.user_email}</p></div>) },
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
                {!selectedNomination && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      No nomination found for this form, so functionary-filled data cannot be shown here.
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
    </div>
  );
}
