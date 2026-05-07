import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import FormFieldBuilder from '../components/FormFieldBuilder';
import FormRenderer from '../components/FormRenderer';
import type { FormField } from '../components/FormRenderer';
import {
  Plus, Edit2, Trash2, Copy, FileText, GitBranch, Award, HelpCircle,
  Layers, Eye, History, Play, Settings, Pencil, MoreHorizontal,
  Clock, Search, Filter, ChevronRight, Calendar, Hash
} from 'lucide-react';

const typeIcons: Record<string, any> = { normal: FileText, nomination: Award, branching: GitBranch, quiz: HelpCircle, multi: Layers };
const typeLabels: Record<string, string> = { normal: 'Normal Form', nomination: 'Nomination', branching: 'Branching', quiz: 'Quiz', multi: 'Multi-Form' };
const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  normal: { bg: 'bg-accent-blue/10', text: 'text-accent-blue', border: 'border-accent-blue/30' },
  nomination: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  branching: { bg: 'bg-accent-purple/10', text: 'text-accent-purple', border: 'border-accent-purple/30' },
  quiz: { bg: 'bg-accent-orange/10', text: 'text-accent-orange', border: 'border-accent-orange/30' },
  multi: { bg: 'bg-accent-red/10', text: 'text-accent-red', border: 'border-accent-red/30' },
};

export default function Forms({ user }: { user: User }) {
  const navigate = useNavigate();
  const [forms, setForms] = useState<any[]>([]);
  const [teacherNominationLinks, setTeacherNominationLinks] = useState<Record<string, { token?: string; schoolCode?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tab, setTab] = useState<'active' | 'draft' | 'expired'>('active');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showFieldBuilder, setShowFieldBuilder] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [activeForm, setActiveForm] = useState<any>(null);
  const [builderFields, setBuilderFields] = useState<FormField[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', form_type: 'normal', status: 'draft', expires_at: '',
    settings: {} as any
  });

  const fetchForms = async () => {
    try { setForms(await api.get('/forms')); } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  useEffect(() => { fetchForms(); }, []);

  useEffect(() => {
    const loadTeacherNominationLinks = async () => {
      if (user.role !== 'teacher' || !user.email) {
        setTeacherNominationLinks({});
        return;
      }
      try {
        const noms: any[] = await api.get(`/nominations?teacher_email=${encodeURIComponent(user.email)}`);
        const byForm: Record<string, { token?: string; schoolCode?: string }> = {};
        (Array.isArray(noms) ? noms : []).forEach((n: any) => {
          const formId = String(n.form_id || n.formId || '');
          if (!formId) return;
          const token = n.unique_token || n.nomination_token || n.nominationToken;
          byForm[formId] = { token, schoolCode: n.school_code || n.schoolCode };
        });
        setTeacherNominationLinks(byForm);
      } catch (err) {
        console.error('Failed to load teacher nomination links:', err);
        setTeacherNominationLinks({});
      }
    };
    loadTeacherNominationLinks();
  }, [user.role, user.email]);

  const isAdmin = user.role === 'admin';

  // Filter
  const filtered = forms.filter(f => {
    // Functionaries should only see nomination-enabled forms.
    if (user.role === 'functionary' && f.form_type !== 'nomination') return false;

    const isExpired = f.expires_at && new Date(f.expires_at) < new Date();
    let effectiveStatus = f.status;
    if (isExpired) effectiveStatus = 'expired';

    if (effectiveStatus !== tab) return false;
    if (typeFilter && f.form_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!f.title?.toLowerCase().includes(q) && !f.form_type?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Helpers
  const getFieldCount = (f: any) => {
    try {
      const schema = f.form_schema || f.schema;
      if (schema) {
        const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
        if (parsed.sections) {
          let count = 0;
          parsed.sections.forEach((s: any) => {
            count += (s.fields || []).length;
          });
          return count;
        }
      }
      const arr = typeof f.fields === 'string' ? JSON.parse(f.fields) : (f.fields || []);
      let count = 0;
      const walk = (list: any[]) => list.forEach((x: any) => { count++; if (x.children) walk(x.children); });
      walk(arr);
      return count;
    } catch { return 0; }
  };

  // CRUD
  const openCreateModal = (type?: string) => {
    navigate(`/forms/new?type=${type || 'normal'}`);
  };

  const openEditModal = (row: any) => {
    // Both edit and field builder now go to the same unified builder page
    navigate(`/forms/${row.id}/builder`);
  };

  const handleSave = async () => {
    // Legacy modal save fallback (should be unused now)
    if (!form.title.trim()) return alert('Form title is required');
    try {
      const payload = { ...form, settings: JSON.stringify(form.settings), created_by: user.id };
      if (editForm) await api.put('/forms', { id: editForm.id, ...payload, change_notes: 'Updated', updated_by: user.id });
      else await api.post('/forms', payload);
      setShowCreate(false); fetchForms();
    } catch (err: any) { alert(err.message); }
  };

  const openBuilder = (row: any) => {
    navigate(`/forms/${row.id}/builder`);
  };

  const saveFields = async () => {
    if (!activeForm) return;
    try {
      await api.put('/forms', { id: activeForm.id, fields: JSON.stringify(builderFields), change_notes: 'Fields updated', updated_by: user.id });
      setShowFieldBuilder(false); fetchForms();
    } catch (err: any) { alert(err.message); }
  };

  const openPreviewModal = (row: any) => {
    if (!row) return;
    setActiveForm(row);
    let f: FormField[] = [];
    try {
      const schema = row.form_schema || row.schema;
      if (schema) {
        const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
        if (parsed && parsed.sections) {
          // Map backend sections to FormRenderer sections
          f = parsed.sections.map((s: any) => ({
            id: s.id || Math.random().toString(36).substr(2, 9),
            type: 'section',
            label: s.title || s.label || 'Section',
            children: s.fields || [],
            section_type: row.form_type || row.formType || 'normal'
          }));
        }
      }
      
      if (f.length === 0 && row.fields) {
        const fields = typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields;
        f = Array.isArray(fields) ? fields : [];
      }
    } catch (err) {
      console.error('Error parsing form preview data:', err);
      f = [];
    }
    setBuilderFields(f);
    setShowPreview(true);
    setOpenMenu(null);
  };

  const handleClone = async (id: string) => { await api.post('/forms', { action: 'clone', form_id: id, created_by: user.id }); fetchForms(); setOpenMenu(null); };
  const handleDelete = async (id: string) => { 
    console.log('handleDelete called with id:', id);
    if (!confirm('Delete this form permanently?')) return; 
    try {
      console.log('Sending DELETE request for:', id);
      const res = await api.del(`/forms/${id}`); 
      console.log('DELETE response:', res);
      await fetchForms(); 
      setOpenMenu(null); 
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert('Failed to delete form: ' + err.message);
    }
  };
  const viewVersions = async (formId: string) => { setVersions(await api.get(`/form-versions?form_id=${formId}`)); setShowVersions(true); setOpenMenu(null); };

  // Click outside menu
  useEffect(() => {
    if (openMenu !== null) {
      const h = () => setOpenMenu(null);
      document.addEventListener('click', h);
      return () => document.removeEventListener('click', h);
    }
  }, [openMenu]);

  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-48 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading">{isAdmin ? 'Form Builder' : 'Available Forms'}</h1>
          <p className="text-sm text-slate-500">{isAdmin ? 'Create, configure fields, set branching & quiz logic' : 'Select a form to fill'}</p>
        </div>
        {isAdmin && (
          <button onClick={() => openCreateModal()} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover shadow-sm min-h-[44px]">
            <Plus size={16} /> Create Form
          </button>
        )}
      </div>

      {/* Tabs + Search + Filter */}
      {(forms.length > 0 || isAdmin) && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(['active', 'draft', 'expired'] as const)
              .filter(t => !((user.role === 'functionary' || user.role === 'teacher') && t === 'draft'))
              .map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}>
                {t} <span className="ml-1 opacity-60">({
                  forms.filter(f => {
                    // APPLY ROLE FILTERING TO COUNT TOO
                    if (user.role === 'functionary' && f.form_type !== 'nomination') return false;
                    
                    const isExpired = f.expires_at && new Date(f.expires_at) < new Date();
                    let finalStatus = f.status;
                    if (isExpired) finalStatus = 'expired';
                    return finalStatus === t;
                  }).length
                })</span>
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 min-w-[180px]">
              <Search size={14} className="text-slate-500 flex-shrink-0" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search forms..."
                className="bg-transparent text-sm outline-none w-full placeholder-muted text-slate-900" />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 outline-none">
              <option value="">All Types</option>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Form Cards Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="max-w-md mx-auto px-6">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={32} className="text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">
              {user.role === 'teacher' ? 'No Forms Assigned' : `No ${tab} forms found`}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {user.role === 'teacher' 
                ? "You don't have any forms assigned to you at the moment. Please contact your school functionary if you believe this is an error."
                : tab === 'active' 
                  ? "There are no active forms available right now."
                  : `There are no forms in the ${tab} category.`}
            </p>
            {isAdmin && tab === 'active' && (
              <button onClick={() => openCreateModal()} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover shadow-sm transition-all">
                <Plus size={16} /> Create Your First Form
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(row => {
            const Icon = typeIcons[row.form_type] || FileText;
            const c = typeColors[row.form_type] || typeColors.normal;
            const fieldCount = getFieldCount(row);
            const isExpired = row.expires_at && new Date(row.expires_at) < new Date();
            const canFill = row.status === 'active' && !isExpired;

            return (
              <div key={row.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col group relative">

                {/* Color bar top */}
                <div className={`h-1.5 rounded-t-2xl ${
                  row.form_type === 'normal' ? 'bg-accent-blue' :
                  row.form_type === 'nomination' ? 'bg-success' :
                  row.form_type === 'branching' ? 'bg-accent-purple' :
                  row.form_type === 'quiz' ? 'bg-accent-orange' :
                  'bg-accent-red'
                }`} />

                <div className="p-5 flex-1 flex flex-col">
                  {/* Type badge + menu */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${c.bg} ${c.text}`}>
                      <Icon size={13} /> {typeLabels[row.form_type]}
                    </div>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={isExpired ? 'expired' : row.status} size="xs" />
                      {isAdmin && (
                        <div className="relative">
                          <button onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === row.id ? null : row.id); }}
                            className={`p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all ${openMenu === row.id ? 'bg-slate-100 text-slate-900 opacity-100' : 'opacity-40 group-hover:opacity-100'}`}>
                            <MoreHorizontal size={16} />
                          </button>
                          {openMenu === row.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 z-[100] py-1" onClick={e => e.stopPropagation()}>
                              <button onClick={() => openEditModal(row)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2.5"><Settings size={13} className="text-slate-500" /> Settings</button>
                              <button onClick={() => openBuilder(row)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2.5"><Pencil size={13} className="text-slate-500" /> Edit Fields</button>
                              <button onClick={() => openPreviewModal(row)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2.5"><Eye size={13} className="text-slate-500" /> Preview</button>
                              <button onClick={() => viewVersions(row.id)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2.5"><History size={13} className="text-slate-500" /> Versions</button>
                              <button onClick={() => handleClone(row.id)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 flex items-center gap-2.5"><Copy size={13} className="text-slate-500" /> Clone</button>
                              <div className="border-t border-slate-200 my-1" />
                              <button onClick={() => handleDelete(row._id || row.id)} className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 flex items-center gap-2.5 text-danger"><Trash2 size={13} /> Delete</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold font-heading text-slate-900 leading-snug mb-1.5 line-clamp-2">
                    {row.title || '(Untitled)'}
                  </h3>

                  {/* Description */}
                  {row.description && (
                    <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">{row.description}</p>
                  )}

                  <div className="flex-1" />

                  {/* Meta */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-200">
                    <span className="flex items-center gap-1"><Hash size={11} /> {fieldCount} fields</span>
                    <span className="flex items-center gap-1"><Calendar size={11} /> {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</span>
                    {row.expires_at && (
                      <span className={`flex items-center gap-1 ${isExpired ? 'text-danger font-semibold' : ''}`}>
                        <Clock size={11} /> {isExpired ? 'Expired' : `Due ${new Date(row.expires_at).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {canFill && user.role !== 'functionary' && (
                      <button onClick={() => {
                        if (user.role === 'teacher') {
                          const linkMeta = teacherNominationLinks[String(row.id)] || {};
                          const params = new URLSearchParams();
                          if (linkMeta.token) params.set('token', linkMeta.token);
                          if (linkMeta.schoolCode) params.set('sc', linkMeta.schoolCode);
                          const qs = params.toString();
                          navigate(`/fill/${row.id}${qs ? `?${qs}` : ''}`);
                          return;
                        }
                        openPreviewModal(row);
                      }}
                        className="flex-1 min-w-[120px] py-2.5 bg-accent-green text-white rounded-xl text-sm font-bold hover:bg-accent-green-hover transition-colors flex items-center justify-center gap-2 min-h-[44px] shadow-sm">
                        {user.role === 'teacher' ? <Play size={14} /> : <Eye size={14} />}
                        {user.role === 'teacher' ? 'Fill Form' : 'Preview'}
                      </button>
                    )}
                    
                    {canFill && user.role === 'functionary' && (
                      <button onClick={() => navigate(`/nominations?form_id=${row.id}`)}
                        className="flex-1 min-w-[140px] py-2.5 bg-accent-green text-white rounded-xl text-sm font-bold hover:bg-accent-green-hover transition-colors flex items-center justify-center gap-2 min-h-[44px] shadow-sm">
                        {row.form_type === 'nomination' ? <Play size={14} /> : <Award size={14} />}
                        Nominate
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button onClick={() => openBuilder(row)}
                          className="flex-1 min-w-[100px] py-2.5 px-4 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 min-h-[44px]">
                          <Pencil size={14} /> Edit
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(row._id || row.id); }}
                          className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center min-h-[44px] border border-red-100"
                          title="Delete Form">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    
                    {!canFill && !isAdmin && (
                      <div className="flex-1 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-500 font-medium text-center min-h-[44px] flex items-center justify-center gap-2 border border-slate-200">
                        <Clock size={14} /> {row.status === 'draft' ? 'Not yet active' : 'Form closed'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Create / Edit Settings Modal ═══ */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={editForm ? 'Form Settings' : `Create ${typeLabels[form.form_type] || 'Form'}`} size="xl">
        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Form Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-slate-900"
              placeholder="e.g. Annual Teacher Performance Survey 2024" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none focus:border-primary h-20 resize-none text-slate-900"
              placeholder="Describe the purpose of this form..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Form Type</label>
              <select value={form.form_type} onChange={e => setForm(p => ({ ...p, form_type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none text-slate-900">
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none text-slate-900">
                <option value="draft">Draft</option><option value="active">Active</option><option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Expiry Date</label>
              <input type="datetime-local" value={form.expires_at ? form.expires_at.slice(0, 16) : ''}
                onChange={e => setForm(p => ({ ...p, expires_at: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none text-slate-900" />
            </div>
          </div>

          {/* Settings */}
          <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2"><Settings size={14} className="text-primary" /> Settings</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Login Type</label>
                <select value={form.settings.login_type || 'otp'} onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, login_type: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none text-slate-900">
                  <option value="otp">OTP Required</option><option value="direct">Direct Link (no login)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Review Type</label>
                <select value={form.settings.review_type || 'marks'} onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, review_type: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none text-slate-900">
                  <option value="marks">Marks (numeric)</option><option value="grade">Grade (A/B/C/D)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Type-specific settings */}
          {form.form_type === 'nomination' && (
            <div className="p-4 bg-teal-50 rounded-xl border border-teal-200 space-y-3">
              <h4 className="text-sm font-bold text-teal-800 flex items-center gap-2"><Award size={16} /> Nomination</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-teal-600 mb-1 block">Max Teachers per Functionary</label>
                  <input type="number" value={form.settings.max_nominations || ''} onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, max_nominations: parseInt(e.target.value) || 0 } }))}
                    className="w-full px-3 py-2 rounded-xl border border-teal-200 bg-white text-sm outline-none" placeholder="5" /></div>
                <div><label className="text-xs font-semibold text-teal-600 mb-1 block">Teacher Access</label>
                  <select value={form.settings.teacher_login || 'otp'} onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, teacher_login: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-xl border border-teal-200 bg-white text-sm outline-none">
                    <option value="otp">OTP</option><option value="direct">Direct Link</option></select></div>
              </div>
            </div>
          )}
          {form.form_type === 'quiz' && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
              <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2"><HelpCircle size={16} /> Quiz</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className="text-xs font-semibold text-amber-600 mb-1 block">Time (min)</label>
                  <input type="number" value={form.settings.time_limit || ''} onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, time_limit: parseInt(e.target.value) || 0 } }))}
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm outline-none" /></div>
                <div><label className="text-xs font-semibold text-amber-600 mb-1 block">Pass %</label>
                  <input type="number" value={form.settings.passing_score || ''} onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, passing_score: parseInt(e.target.value) || 0 } }))}
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm outline-none" /></div>
                <div><label className="text-xs font-semibold text-amber-600 mb-1 block">Negative</label>
                  <select value={form.settings.negative_marking ? 'yes' : 'no'} onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, negative_marking: e.target.value === 'yes' } }))}
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm outline-none">
                    <option value="no">No</option><option value="yes">Yes (−25%)</option></select></div>
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.settings.shuffle_options || false} onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, shuffle_options: e.target.checked } }))} className="rounded accent-primary" /> Shuffle</label></div>
              </div>
              <p className="text-[10px] text-amber-600">Correct answers hidden from users & reviewers.</p>
            </div>
          )}
          {form.form_type === 'branching' && (
            <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
              <p className="text-xs text-sky-700"><strong>Branching:</strong> After creating, click <strong>Fields</strong> to add a trigger dropdown + conditional sections with IF-THEN rules.</p>
            </div>
          )}
          {form.form_type === 'multi' && (
            <div className="p-4 bg-pink-50 rounded-xl border border-pink-200">
              <p className="text-xs text-pink-700"><strong>Multi-Form:</strong> Combine Normal + Branching + Quiz. Click <strong>Fields</strong> after creation to build.</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-100 font-medium">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2.5 bg-primary text-white text-sm rounded-xl font-semibold hover:bg-primary-hover shadow-sm">
            {editForm ? 'Save Settings' : 'Create Form'}
          </button>
        </div>
      </Modal>

      {/* ═══ Field Builder ═══ */}
      <Modal open={showFieldBuilder} onClose={() => setShowFieldBuilder(false)} title={`Edit Fields — ${activeForm?.title || ''}`} size="2xl">
        <div className="space-y-4">
          <div className={`p-3 rounded-xl border text-xs font-medium ${
            activeForm?.form_type === 'quiz' ? 'bg-amber-50 border-amber-200 text-amber-700' :
            activeForm?.form_type === 'branching' ? 'bg-sky-50 border-sky-200 text-sky-700' :
            activeForm?.form_type === 'multi' ? 'bg-pink-50 border-pink-200 text-pink-700' :
            'bg-slate-100 border-slate-200 text-slate-500'
          }`}>
            {activeForm?.form_type === 'quiz' ? '🎯 Add MCQ → set correct answer → set points. Hidden from users & reviewers.' :
             activeForm?.form_type === 'branching' ? '🔀 Add trigger dropdown → add Sections with IF-THEN rules → only visible sections submitted.' :
             activeForm?.form_type === 'multi' ? '📋 Mix Normal + Branching + Quiz fields. Use Sections to organize.' :
             '📝 Add fields. Set required, file upload limits, validation.'}
          </div>
          <FormFieldBuilder fields={builderFields} onChange={setBuilderFields} formType={activeForm?.form_type || 'normal'} />
        </div>
        <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-slate-200">
          <button onClick={() => setShowPreview(true)} className="px-4 py-2.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-100 font-medium flex items-center gap-2"><Eye size={14} /> Preview</button>
          <div className="flex gap-3">
            <button onClick={() => setShowFieldBuilder(false)} className="px-5 py-2.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-100 font-medium">Cancel</button>
            <button onClick={saveFields} className="px-6 py-2.5 bg-primary text-white text-sm rounded-xl font-semibold hover:bg-primary-hover shadow-sm">Save Fields</button>
          </div>
        </div>
      </Modal>

      {/* ═══ Preview ═══ */}
      <Modal open={showPreview} onClose={() => setShowPreview(false)} title={`Preview — ${activeForm?.title || ''}`} size="xl">
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 mb-4">
          <p className="text-xs text-amber-700 font-medium">👁 Preview — this is how users see the form.</p>
        </div>
        {builderFields.length > 0 ? (
          <FormRenderer fields={builderFields} formType={(activeForm?.form_type || 'normal') as any}
            settings={(() => { try { return typeof activeForm?.settings === 'string' ? JSON.parse(activeForm.settings) : (activeForm?.settings || {}); } catch { return {}; } })()}
            onSubmit={() => alert('Preview mode — submission disabled')} />
        ) : <p className="text-center text-sm text-slate-500 py-10">No fields. Add fields first.</p>}
      </Modal>

      {/* ═══ Versions ═══ */}
      <Modal open={showVersions} onClose={() => setShowVersions(false)} title="Version History" size="lg">
        {versions.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">No versions yet</p> : (
          <div className="space-y-3">{versions.map(v => (
            <div key={v.id} className="p-4 bg-slate-100 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1"><span className="text-sm font-bold">v{v.version}</span><span className="text-xs text-slate-500">{new Date(v.created_at).toLocaleString()}</span></div>
              <p className="text-xs text-slate-500">{v.change_notes || 'No notes'}</p>
            </div>
          ))}</div>
        )}
      </Modal>
    </div>
  );
}
