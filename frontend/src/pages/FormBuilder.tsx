import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Save, Plus, Trash2, GripVertical, ArrowLeft, Eye, Settings2,
  Type, AlignLeft, Hash, Mail, Phone, CalendarDays, ListChecks, CheckSquare, Radio, Upload, HelpCircle,
  Link2, QrCode, Copy, ChevronDown, ChevronRight,
  LayoutDashboard, Pencil, Settings, History, Download, Trash, AlertCircle, PlusCircle, Check
} from 'lucide-react';
import { api } from '../lib/api';
import { copyToClipboard } from '../lib/utils';

// ─── Types (matching App 1 exactly) ───────────────────────────────────────────
type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'dropdown' | 'radio' | 'checkbox' | 'file' | 'mcq';

type Field = {
  id: string; type: FieldType; label: string; required?: boolean; placeholder?: string;
  options?: string[]; maxLength?: number; fileTypes?: string; maxSizeMB?: number;
  correct?: number | string; marks?: number; negative?: number;
  reviewer_max_marks?: number;
  visibleIf?: { fieldId: string; op: 'eq' | 'neq'; value: string };
};

type Section = {
  id: string; title: string; description?: string; fields: Field[];
  visibleIf?: { fieldId: string; op: 'eq' | 'neq'; value: string };
};

type FormCategory = 'normal' | 'nomination' | 'branching' | 'quiz' | 'multi';

type FormState = {
  id: string; title: string; description: string;
  form_type: FormCategory; slug: string;
  schema: { sections: Section[] };
  settings: Record<string, unknown>;
  status: 'active' | 'expired' | 'draft';
  expires_at: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const fieldIcons: Record<FieldType, React.ComponentType<{ size?: number }>> = {
  text: Type, textarea: AlignLeft, number: Hash, email: Mail, phone: Phone, date: CalendarDays,
  dropdown: ListChecks, radio: Radio, checkbox: CheckSquare, file: Upload, mcq: HelpCircle,
};

const newId = () => Math.random().toString(36).slice(2, 9);
const newField = (type: FieldType): Field => ({
  id: newId(), type, label: `${type[0].toUpperCase() + type.slice(1)} question`, required: false,
  ...(type === 'dropdown' || type === 'radio' || type === 'checkbox' || type === 'mcq' ? { options: ['Option 1', 'Option 2'] } : {}),
  ...(type === 'mcq' ? { marks: 1, correct: 0 } : {}),
});

// ─── Reusable UI (App 1 style) ────────────────────────────────────────────────
function Badge({ tone = 'blue', children }: { tone?: 'blue' | 'green' | 'amber' | 'rose' | 'slate'; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
function Card({ children, className = '', padded = true }: { children: React.ReactNode; className?: string; padded?: boolean }) {
  return <div className={`card ${!padded ? '!p-0' : ''} ${className}`}>{children}</div>;
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span onClick={() => onChange(!checked)} className={`w-10 h-6 rounded-full transition-colors relative ${checked ? 'bg-mint' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}
function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  const nav = useNavigate();
  return (
    <nav className="text-sm text-muted flex items-center gap-1.5 flex-wrap">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-slate-300">/</span>}
          {it.to ? <button onClick={() => nav(it.to!)} className="hover:text-navy">{it.label}</button> : <span className="font-medium text-ink">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FormBuilder() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const isNew = !id;

  const [form, setForm] = useState<FormState>({
    id: '', title: 'Untitled form', description: '',
    form_type: (sp.get('type') as FormCategory) || 'normal',
    slug: '',
    schema: { sections: [{ id: newId(), title: 'Section 1', fields: [newField('text')] }] },
    settings: { time_limit_min: 30, shuffle: true },
    status: 'draft', expires_at: null,
  });

  const [activeSection, setActiveSection] = useState(0);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      api.get(`/forms?id=${id}`).then((res: any) => {
        // Normalize: adapt form_schema → schema
        if (res.form_schema) res.schema = res.form_schema;
        if (!res.schema && res.fields) {
          res.schema = { sections: [{ id: newId(), title: 'Section 1', fields: typeof res.fields === 'string' ? JSON.parse(res.fields) : res.fields }] };
        }
        if (!res.schema) res.schema = { sections: [{ id: newId(), title: 'Section 1', fields: [newField('text')] }] };
        res.form_type = res.form_type || res.formType || 'normal';
        res.settings = typeof res.settings === 'string' ? JSON.parse(res.settings) : (res.settings || {});
        setForm(res);
      }).catch(console.error);
    }
  }, [id]);

  const section = form.schema.sections[activeSection];

  const patch = (p: Partial<FormState>) => setForm(f => ({ ...f, ...p }));
  const patchSettings = (p: Record<string, unknown>) => setForm(f => ({ ...f, settings: { ...f.settings, ...p } }));
  const patchSchema = (updater: (s: { sections: Section[] }) => { sections: Section[] }) =>
    setForm(f => ({ ...f, schema: updater(f.schema) }));
  const updateSection = (i: number, p: Partial<Section>) =>
    patchSchema(s => ({ sections: s.sections.map((x, idx) => idx === i ? { ...x, ...p } : x) }));
  const updateField = (sIdx: number, fid: string, p: Partial<Field>) =>
    patchSchema(s => ({ sections: s.sections.map((x, i) => i === sIdx ? { ...x, fields: x.fields.map(f => f.id === fid ? { ...f, ...p } : f) } : x) }));
  const addField = (type: FieldType) => {
    const nf = newField(type);
    patchSchema(s => ({ sections: s.sections.map((x, i) => i === activeSection ? { ...x, fields: [...x.fields, nf] } : x) }));
    setActiveField(nf.id);
  };
  const removeField = (fid: string) =>
    patchSchema(s => ({ sections: s.sections.map((x, i) => i === activeSection ? { ...x, fields: x.fields.filter(f => f.id !== fid) } : x) }));
  const moveField = (fid: string, dir: -1 | 1) =>
    patchSchema(s => ({
      sections: s.sections.map((x, i) => {
        if (i !== activeSection) return x;
        const idx = x.fields.findIndex(f => f.id === fid);
        const j = idx + dir;
        if (j < 0 || j >= x.fields.length) return x;
        const a = [...x.fields]; [a[idx], a[j]] = [a[j], a[idx]];
        return { ...x, fields: a };
      })
    }));
  const addSection = () => {
    const n: Section = { id: newId(), title: `Section ${form.schema.sections.length + 1}`, fields: [] };
    patchSchema(s => ({ sections: [...s.sections, n] }));
    setActiveSection(form.schema.sections.length);
  };
  const removeSection = (i: number) => {
    if (form.schema.sections.length <= 1) return;
    patchSchema(s => ({ sections: s.sections.filter((_, idx) => idx !== i) }));
    setActiveSection(0);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        form_schema: form.schema,  // backend uses form_schema
        settings: JSON.stringify(form.settings),
      };
      if (isNew) {
        await api.post('/forms', payload);
      } else {
        const { id: _formId, ...formWithoutId } = form;
        await api.put('/forms', { id, ...formWithoutId, form_schema: form.schema, settings: JSON.stringify(form.settings) });
      }
      alert('Changes saved successfully.');
      nav('/forms');
    } catch (err: any) {
      alert(err.message);
    } finally { setSaving(false); }
  };

  const fieldButtons: { type: FieldType; label: string }[] = [
    { type: 'text', label: 'Short text' },
    { type: 'textarea', label: 'Paragraph' },
    { type: 'number', label: 'Number' },
    { type: 'email', label: 'Email' },
    { type: 'phone', label: 'Phone' },
    { type: 'date', label: 'Date' },
    { type: 'dropdown', label: 'Dropdown' },
    { type: 'radio', label: 'Radio' },
    { type: 'checkbox', label: 'Checkbox' },
    { type: 'file', label: 'File upload' },
    ...(form.form_type === 'quiz' || form.form_type === 'multi' ? [{ type: 'mcq' as FieldType, label: 'MCQ (auto-score)' }] : []),
  ];

  const publicUrl = `${location.origin}/fill/${id || 'unsaved'}`;
  const handleCopyLink = async () => {
    const success = await copyToClipboard(publicUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Forms', to: '/forms' }, { label: isNew ? 'New form' : 'Edit form' }]} />
          <div className="flex items-center gap-2 mt-1">
            <input
              className="font-display text-2xl font-bold text-ink bg-transparent outline-none border-b-2 border-transparent focus:border-blue transition-colors"
              value={form.title}
              onChange={e => patch({ title: e.target.value })}
            />
            <Badge tone="blue">{form.form_type}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => nav('/forms')} className="btn btn-ghost"><ArrowLeft size={16}/> Back</button>
          <button onClick={() => setShowPreview(p => !p)} className="btn btn-ghost"><Eye size={16}/> {showPreview ? 'Hide preview' : 'Preview'}</button>
          <button onClick={save} disabled={saving} className="btn btn-primary"><Save size={16}/> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr_340px] gap-5">
        {/* ── Section nav ── */}
        <div className="space-y-3">
          <Card padded={false}>
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold">Sections</div>
              <button onClick={addSection} className="text-blue hover:text-navy" title="Add section"><Plus size={16}/></button>
            </div>
            <div className="p-2 space-y-1">
              {form.schema.sections.map((s, i) => (
                <button key={s.id} onClick={() => { setActiveSection(i); setActiveField(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${i === activeSection ? 'bg-blue-soft text-navy font-semibold' : 'hover:bg-canvas'}`}>
                  <span className="text-muted text-xs">{i + 1}.</span>
                  <span className="truncate flex-1">{s.title}</span>
                  {form.schema.sections.length > 1 && (
                    <Trash2 size={12} className="text-muted hover:text-rose-500"
                      onClick={e => { e.stopPropagation(); removeSection(i); }} />
                  )}
                </button>
              ))}
            </div>
          </Card>

          <Card padded={false}>
            <div className="p-3 border-b border-border text-sm font-semibold">Add field</div>
            <div className="p-2 space-y-1">
              {fieldButtons.map(fb => {
                const Icon = fieldIcons[fb.type];
                return (
                  <button key={fb.type} onClick={() => addField(fb.type)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-blue-soft text-ink-soft">
                    <Icon size={15} /> {fb.label}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ── Builder canvas ── */}
        <div className="space-y-4">
          {section && (
            <Card>
              <input className="input !border-0 !bg-transparent !p-0 font-display text-xl font-bold" value={section.title}
                onChange={e => updateSection(activeSection, { title: e.target.value })} placeholder="Section Title" />
              <textarea className="textarea mt-2 !border-dashed" rows={2} placeholder="Section description (optional)"
                value={section.description || ''} onChange={e => updateSection(activeSection, { description: e.target.value })} />
              {activeSection > 0 && (
                <div className="mt-3">
                  <BranchingEditor allFields={form.schema.sections.slice(0, activeSection).flatMap(s => s.fields)}
                    value={section.visibleIf} onChange={v => updateSection(activeSection, { visibleIf: v })} />
                </div>
              )}
            </Card>
          )}

          {section?.fields.map((f, i) => {
            const Icon = fieldIcons[f.type];
            const open = activeField === f.id;
            return (
              <Card key={f.id} className={open ? '!border-blue' : ''}>
                <div className="flex items-start gap-3">
                  <div className="cursor-grab text-muted mt-1"><GripVertical size={16}/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon size={15} />
                      <input className="input !py-1.5 flex-1" value={f.label}
                        onChange={e => updateField(activeSection, f.id, { label: e.target.value })} placeholder="Question label" />
                      {f.required && <Badge tone="rose">required</Badge>}
                    </div>
                    {!open && (
                      <button onClick={() => setActiveField(f.id)} className="text-xs text-blue hover:underline mt-2">Configure →</button>
                    )}
                    {open && (
                      <div className="mt-3 space-y-3 animate-in">
                        {(f.type === 'text' || f.type === 'textarea' || f.type === 'email' || f.type === 'phone') && (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs"><span className="text-muted">Placeholder</span>
                              <input className="input !py-1.5 mt-1" value={f.placeholder || ''} onChange={e => updateField(activeSection, f.id, { placeholder: e.target.value })} /></label>
                            <label className="text-xs"><span className="text-muted">Max length</span>
                              <input type="number" className="input !py-1.5 mt-1" value={f.maxLength || ''} onChange={e => updateField(activeSection, f.id, { maxLength: +e.target.value || undefined })} /></label>
                          </div>
                        )}
                        {(f.type === 'dropdown' || f.type === 'radio' || f.type === 'checkbox' || f.type === 'mcq') && (
                          <div>
                            <div className="text-xs text-muted mb-1">Options</div>
                            <div className="space-y-1">
                              {f.options?.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  {f.type === 'mcq' && (
                                    <input type="radio" checked={f.correct === oi} onChange={() => updateField(activeSection, f.id, { correct: oi })} className="w-4 h-4" />
                                  )}
                                  <input className="input !py-1.5" value={opt}
                                    onChange={e => updateField(activeSection, f.id, { options: f.options!.map((x, j) => j === oi ? e.target.value : x) })} />
                                  <button onClick={() => updateField(activeSection, f.id, { options: f.options!.filter((_, j) => j !== oi) })} className="btn btn-danger !py-1 !px-2"><Trash2 size={14}/></button>
                                </div>
                              ))}
                              <button onClick={() => updateField(activeSection, f.id, { options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] })} className="text-xs text-blue hover:underline">+ add option</button>
                            </div>
                          </div>
                        )}
                        {f.type === 'mcq' && (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs"><span className="text-muted">Marks</span>
                              <input type="number" className="input !py-1.5 mt-1" value={f.marks || 1} onChange={e => updateField(activeSection, f.id, { marks: +e.target.value })} /></label>
                            <label className="text-xs"><span className="text-muted">Negative</span>
                              <input type="number" step="0.25" className="input !py-1.5 mt-1" value={f.negative || 0} onChange={e => updateField(activeSection, f.id, { negative: +e.target.value })} /></label>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30 mt-2">
                          <label className="text-xs"><span className="text-muted font-bold text-primary">Reviewer Max Marks</span>
                            <input type="number" className="input !py-1.5 mt-1 border-primary/30 focus:border-primary" 
                              placeholder="Max score reviewer can give"
                              value={f.reviewer_max_marks || ''} 
                              onChange={e => updateField(activeSection, f.id, { reviewer_max_marks: +e.target.value || 0 })} /></label>
                        </div>
                        {f.type === 'file' && (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs"><span className="text-muted">Allowed types</span>
                              <input className="input !py-1.5 mt-1" placeholder="pdf,jpg,png" value={f.fileTypes || ''} onChange={e => updateField(activeSection, f.id, { fileTypes: e.target.value })} /></label>
                            <label className="text-xs"><span className="text-muted">Max size MB</span>
                              <input type="number" className="input !py-1.5 mt-1" value={f.maxSizeMB || 5} onChange={e => updateField(activeSection, f.id, { maxSizeMB: +e.target.value })} /></label>
                          </div>
                        )}
                        {(form.form_type === 'branching' || form.form_type === 'multi') && (
                          <BranchingEditor allFields={section.fields.filter(x => x.id !== f.id)} value={f.visibleIf}
                            onChange={v => updateField(activeSection, f.id, { visibleIf: v })} />
                        )}
                        <div className="flex items-center justify-between">
                          <Toggle checked={!!f.required} onChange={v => updateField(activeSection, f.id, { required: v })} label="Required" />
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveField(f.id, -1)} disabled={i === 0} className="btn btn-ghost !py-1 !px-2 disabled:opacity-40">↑</button>
                            <button onClick={() => moveField(f.id, 1)} disabled={i === section.fields.length - 1} className="btn btn-ghost !py-1 !px-2 disabled:opacity-40">↓</button>
                            <button onClick={() => { removeField(f.id); setActiveField(null); }} className="btn btn-danger !py-1 !px-2"><Trash2 size={14}/></button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {section?.fields.length === 0 && (
            <Card className="text-center text-muted">No fields yet. Add one from the left panel.</Card>
          )}
        </div>

        {/* ── Settings panel ── */}
        <div className="space-y-4">
          {showPreview && (
            <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm p-4 md:p-10 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="bg-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                  >
                    <ArrowLeft size={24} />
                  </button>
                </div>
                <PreviewPane form={form} />
              </div>
            </div>
          )}
          <Card>
            <div className="flex items-center gap-2 mb-3"><Settings2 size={16}/><div className="font-semibold">Settings</div></div>
            <label className="block text-xs"><span className="text-muted">Description</span>
              <textarea rows={2} className="textarea mt-1" value={form.description} onChange={e => patch({ description: e.target.value })} placeholder="Form description…" /></label>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <label className="text-xs"><span className="text-muted">Expires</span>
                <input type="datetime-local" className="input !py-1.5 mt-1" value={form.expires_at?.slice(0,16) || ''} onChange={e => patch({ expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
              <label className="text-xs block mt-3"><span className="text-muted">Status</span>
                <select className="select mt-1" value={form.status} onChange={e => patch({ status: e.target.value as FormState['status'] })}>
                  <option value="draft">Draft</option><option value="active">Active</option><option value="expired">Expired</option>
                </select></label>
            </div>

            <div className="mt-3">
              <label className="text-xs block"><span className="text-muted">Access Mode</span>
                <select className="select mt-1" value={(form.settings.auth_mode as string) || 'otp'} onChange={e => patchSettings({ auth_mode: e.target.value })}>
                  <option value="otp">OTP based (Email)</option>
                  <option value="anonymous">No Login (Anonymous)</option>
                </select></label>
            </div>

            {(form.form_type === 'quiz' || form.form_type === 'multi') && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <div className="text-xs font-semibold text-ink">Quiz Settings</div>
                <label className="text-xs"><span className="text-muted">Time limit (minutes)</span>
                  <input type="number" className="input !py-1.5 mt-1" value={(form.settings.time_limit_min as number) || 30} onChange={e => patchSettings({ time_limit_min: +e.target.value })} /></label>
                <div className="flex items-center justify-between"><span className="text-sm">Negative marking</span><Toggle checked={!!form.settings.negative_marking} onChange={v => patchSettings({ negative_marking: v })} /></div>
                <div className="flex items-center justify-between"><span className="text-sm">Shuffle options</span><Toggle checked={!!form.settings.shuffle} onChange={v => patchSettings({ shuffle: v })} /></div>
              </div>
            )}

            {form.form_type === 'nomination' && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <div className="text-xs font-semibold text-ink">Nomination Settings</div>
                <label className="text-xs"><span className="text-muted">Nomination limit (per school)</span>
                  <input type="number" className="input !py-1.5 mt-1" value={(form.settings.nomination_limit as number) || 5} onChange={e => patchSettings({ nomination_limit: +e.target.value })} /></label>
                <label className="text-xs block"><span className="text-muted">Teacher Login Type</span>
                  <select className="select mt-1" value={(form.settings.teacher_login as string) || 'otp'} onChange={e => patchSettings({ teacher_login: e.target.value })}>
                    <option value="otp">OTP via Link</option>
                    <option value="direct">Direct Access (Link only)</option>
                  </select></label>
                
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between opacity-60"><span className="text-sm">Require Teacher Name</span><div className="w-8 h-4 rounded-full bg-mint relative"><div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-white shadow" /></div></div>
                  <div className="flex items-center justify-between"><span className="text-sm">Require Teacher Email</span><Toggle checked={form.settings.require_email !== false} onChange={v => patchSettings({ require_email: v })} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">Require Teacher Phone</span><Toggle checked={!!form.settings.require_phone} onChange={v => patchSettings({ require_phone: v })} /></div>
                </div>

                <div className="pt-2 border-t border-border mt-2">
                  <div className="text-[10px] font-bold uppercase text-muted mb-2">Custom Nomination Fields</div>
                  <div className="space-y-2">
                    {((form.settings.nomination_custom_fields as any[]) || []).map((cf, cfi) => (
                      <div key={cfi} className="flex flex-col gap-1.5 p-2 bg-canvas rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <input className="input !py-1 flex-1" placeholder="Field Label (e.g. Employee ID)" value={cf.label} 
                            onChange={e => {
                              const newFields = [...(form.settings.nomination_custom_fields as any[])];
                              newFields[cfi] = { ...cf, label: e.target.value };
                              patchSettings({ nomination_custom_fields: newFields });
                            }} />
                          <button onClick={() => {
                            const newFields = (form.settings.nomination_custom_fields as any[]).filter((_, i) => i !== cfi);
                            patchSettings({ nomination_custom_fields: newFields });
                          }} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={12} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <select className="select !py-1 flex-1" value={cf.type} 
                            onChange={e => {
                              const newFields = [...(form.settings.nomination_custom_fields as any[])];
                              newFields[cfi] = { ...cf, type: e.target.value };
                              patchSettings({ nomination_custom_fields: newFields });
                            }}>
                            <option value="text">Short Text</option>
                            <option value="textarea">Paragraph (Long Text)</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="dropdown">Dropdown</option>
                            <option value="radio">Radio Buttons</option>
                            <option value="checkbox">Checkboxes</option>
                            <option value="file">File Upload (PDF, JPG, PNG)</option>
                          </select>
                          <Toggle checked={!!cf.required} onChange={v => {
                            const newFields = [...(form.settings.nomination_custom_fields as any[])];
                            newFields[cfi] = { ...cf, required: v };
                            patchSettings({ nomination_custom_fields: newFields });
                          }} label="Req" />
                        </div>
                        {['dropdown', 'radio', 'checkbox'].includes(cf.type) && (
                          <input className="input !py-1" placeholder="Options (comma separated)" value={cf.options?.join(', ') || ''} 
                            onChange={e => {
                              const newFields = [...(form.settings.nomination_custom_fields as any[])];
                              newFields[cfi] = { ...cf, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                              patchSettings({ nomination_custom_fields: newFields });
                            }} />
                        )}
                      </div>
                    ))}
                    <button onClick={() => {
                      const newFields = [...((form.settings.nomination_custom_fields as any[]) || []), { id: `cf_${Date.now()}`, label: '', type: 'text', required: false }];
                      patchSettings({ nomination_custom_fields: newFields });
                    }} className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline">
                      <Plus size={10} /> Add Custom Field
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <div className="font-semibold mb-2 flex items-center gap-2"><Link2 size={15}/> Share</div>
            <div className="text-xs text-muted mb-2">Public link</div>
            <div className="flex items-center gap-1 text-xs font-mono bg-canvas rounded-lg px-2 py-2 break-all">
              <Link2 size={12}/><span className="flex-1 break-all">{publicUrl}</span>
              <button onClick={handleCopyLink} className="p-1 rounded hover:bg-white inline-flex items-center gap-1.5">
                <Copy size={12}/>
                {copied && <span className="text-[10px] font-semibold text-primary">Copied</span>}
              </button>
            </div>
            <div className="mt-3 text-xs text-muted mb-2 flex items-center gap-1"><QrCode size={12}/> QR code</div>
            <div className="flex items-center justify-center bg-white rounded-xl border border-border p-3">
              <img alt="QR" className="w-36 h-36" src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(publicUrl)}`} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Branching Editor ─────────────────────────────────────────────────────────
function BranchingEditor({ allFields, value, onChange }: {
  allFields: Field[];
  value?: { fieldId: string; op: 'eq' | 'neq'; value: string };
  onChange: (v: { fieldId: string; op: 'eq' | 'neq'; value: string } | undefined) => void;
}) {
  const [open, setOpen] = useState(!!value);
  const eligible = allFields.filter(f => ['dropdown', 'radio', 'checkbox', 'text'].includes(f.type));
  return (
    <div className="border border-dashed border-border rounded-xl p-3 bg-canvas">
      <button onClick={() => { setOpen(v => !v); if (!open && !value && eligible[0]) onChange({ fieldId: eligible[0].id, op: 'eq', value: '' }); if (open) onChange(undefined); }}
        className="flex items-center gap-2 text-sm font-semibold text-ink-soft w-full">
        {open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} Conditional visibility (IF … THEN show)
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-sm">
          <select className="select !py-1.5" value={value?.fieldId || ''} onChange={e => onChange({ ...(value || { op: 'eq' as const, value: '' }), fieldId: e.target.value })}>
            <option value="">Select field…</option>
            {eligible.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <select className="select !py-1.5" value={value?.op || 'eq'} onChange={e => onChange({ ...(value || { fieldId: '', value: '' }), op: e.target.value as 'eq' | 'neq' })}>
            <option value="eq">equals</option><option value="neq">not equals</option>
          </select>
          <input className="input !py-1.5" placeholder="value (e.g. Maths)" value={(value?.value as string) || ''} onChange={e => onChange({ ...(value || { fieldId: '', op: 'eq' as const }), value: e.target.value })} />
        </div>
      )}
    </div>
  );
}

// ─── Preview Pane ─────────────────────────────────────────────────────────────
function PreviewPane({ form }: { form: FormState }) {
  return (
    <div className="card !p-0 overflow-hidden shadow-2xl">
      <div className="bg-navy p-6 text-white">
        <div className="text-xs uppercase tracking-widest opacity-70 mb-1">Live Preview</div>
        <div className="font-display text-3xl font-bold">{form.title}</div>
        {form.description && <div className="text-slate-300 mt-2">{form.description}</div>}
      </div>
      <div className="p-6 md:p-8 bg-canvas space-y-8">
        {form.schema.sections.map((s, si) => (
          <div key={s.id} className="space-y-4">
            <div className="pb-2 border-b border-border">
              <div className="text-[10px] font-bold text-blue uppercase mb-1">Section {si + 1}</div>
              <div className="font-display text-xl font-bold text-ink">{s.title}</div>
              {s.description && <div className="text-sm text-muted mt-1">{s.description}</div>}
            </div>
            <div className="space-y-5">
              {s.fields.map(f => (
                <div key={f.id} className="bg-white p-5 rounded-2xl border border-border shadow-sm">
                  <label className="block text-sm font-semibold text-ink mb-3">
                    {f.label}{f.required && <span className="text-rose-500 ml-1">*</span>}
                  </label>
                  <PreviewField f={f}/>
                </div>
              ))}
            </div>
          </div>
        ))}
        {form.schema.sections.length === 0 && (
          <div className="text-center py-20 text-muted">
            No sections to preview. Add a section to see how it looks.
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewField({ f }: { f: Field }) {
  const common = "input mt-1 w-full";
  if (f.type === 'textarea') return <textarea className="textarea mt-1 w-full" rows={3} placeholder={f.placeholder}/>;
  if (f.type === 'dropdown') return (
    <select className="select mt-1 w-full">
      <option value="">— Select —</option>
      {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  if (f.type === 'radio' || f.type === 'mcq') return (
    <div className="mt-1 space-y-2">
      {f.options?.map((o, i) => (
        <label key={o} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-slate-50 cursor-pointer transition-colors">
          <input type="radio" name={f.id} className="w-4 h-4 accent-blue"/> 
          <span className="text-sm text-ink-soft">{o}</span>
          {f.type === 'mcq' && <span className="ml-auto text-[10px] font-bold text-muted uppercase">Option {String.fromCharCode(65 + i)}</span>}
        </label>
      ))}
    </div>
  );
  if (f.type === 'checkbox') return (
    <div className="mt-1 space-y-2">
      {f.options?.map(o => (
        <label key={o} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-slate-50 cursor-pointer transition-colors">
          <input type="checkbox" className="w-4 h-4 accent-blue rounded"/> 
          <span className="text-sm text-ink-soft">{o}</span>
        </label>
      ))}
    </div>
  );
  if (f.type === 'file') return (
    <div className="mt-1 p-6 border-2 border-dashed border-border rounded-2xl text-center bg-slate-50">
      <Upload size={24} className="mx-auto text-muted mb-2" />
      <div className="text-sm font-medium">Click to upload or drag and drop</div>
      <div className="text-xs text-muted mt-1">
        {f.fileTypes ? `Allowed: ${f.fileTypes}` : 'Any file type'} {f.maxSizeMB ? `(Max ${f.maxSizeMB}MB)` : ''}
      </div>
    </div>
  );
  if (f.type === 'date') return <input type="date" className={common} />;
  if (f.type === 'number') return <input type="number" className={common} placeholder={f.placeholder} />;
  if (f.type === 'email') return <input type="email" className={common} placeholder={f.placeholder || 'name@example.com'} />;
  if (f.type === 'phone') return <input type="tel" className={common} placeholder={f.placeholder || '+91 ...'} />;
  
  return <input type="text" className={common} placeholder={f.placeholder} maxLength={f.maxLength}/>;
}
