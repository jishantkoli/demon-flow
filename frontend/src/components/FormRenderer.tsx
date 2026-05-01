import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Save, Send, ChevronRight, CheckCircle, AlertCircle, Upload, X, FileText, ExternalLink } from 'lucide-react';

/* ─── Field schema ─── */
export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'select' | 'dropdown' | 'radio' | 'checkbox' | 'file' | 'mcq' | 'rating' | 'section';
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  min?: number; max?: number; maxLength?: number;
  allowedFormats?: string[];
  maxSizeMB?: number;
  is_trigger?: boolean;
  visibleIf?: { fieldId: string; op: 'eq' | 'neq' | 'in'; value: string | string[] };
  show_when?: { field: string; equals: string }; // Legacy support
  children?: FormField[];
  correct?: string;
  points?: number;
  marks?: number;
  section_type?: 'normal' | 'branching' | 'quiz';
}

interface Props {
  fields: FormField[];
  formType: 'normal' | 'branching' | 'quiz' | 'nomination' | 'multi';
  settings?: any;
  initialValues?: Record<string, any>;
  onSubmit: (responses: Record<string, any>, score?: number) => void;
  onSaveDraft?: (responses: Record<string, any>) => void;
  readOnly?: boolean;
  viewMode?: 'user' | 'reviewer' | 'admin';
}

export default function FormRenderer({ fields, formType, settings, initialValues, onSubmit, onSaveDraft, readOnly, viewMode = 'user' }: Props) {
  const [values, setValues] = useState<Record<string, any>>(initialValues || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [quizTimeLeft, setQuizTimeLeft] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [shuffledOpts, setShuffledOpts] = useState<Record<string, string[]>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    if ((formType === 'quiz' || formType === 'multi') && settings?.time_limit && !readOnly)
      setQuizTimeLeft(settings.time_limit * 60);
  }, [formType, settings, readOnly]);

  useEffect(() => {
    if (settings?.shuffle_options) {
      const m: Record<string, string[]> = {};
      const walk = (list: FormField[]) => list.forEach(f => {
        if (f.type === 'mcq' && f.options) m[f.id] = [...f.options].sort(() => Math.random() - 0.5);
        if (f.children) walk(f.children);
      });
      walk(fields);
      setShuffledOpts(m);
    }
  }, [fields, settings]);

  useEffect(() => {
    if (readOnly || !onSaveDraft) return;
    autoRef.current = setInterval(() => { onSaveDraft(valuesRef.current); setLastSaved(new Date().toLocaleTimeString()); }, 30000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [readOnly, onSaveDraft]);

  const set = useCallback((id: string, v: any) => {
    setValues(p => ({ ...p, [id]: v }));
    setErrors(p => { const n = { ...p }; delete n[id]; return n; });
  }, []);

  const toOptionText = useCallback((raw: any, options: string[] = []) => {
    if (raw === undefined || raw === null) return raw;
    if (typeof raw === 'number' && options[raw] !== undefined) return options[raw];
    const n = Number(String(raw));
    if (!Number.isNaN(n) && String(raw).trim() !== '' && options[n] !== undefined) return options[n];
    return raw;
  }, []);

  const isMcqCorrect = useCallback((f: FormField, answer: any) => {
    const options = Array.isArray(f.options) ? f.options : [];
    const ansText = toOptionText(answer, options);
    const corrText = toOptionText(f.correct, options);
    return String(ansText) === String(corrText);
  }, [toOptionText]);

  /* ═══ BRANCHING ═══ */
  const resolveConditionValue = useCallback((ref: string) => {
    if (Object.prototype.hasOwnProperty.call(valuesRef.current, ref)) return valuesRef.current[ref];
    const target = String(ref || '').trim().toLowerCase();
    const flat: FormField[] = [];
    const walk = (list: FormField[]) => list.forEach(x => {
      flat.push(x);
      if (x.children) walk(x.children);
    });
    walk(fields);
    const matched = flat.find(x => String(x.id || '').trim().toLowerCase() === target || String(x.label || '').trim().toLowerCase() === target);
    return matched ? valuesRef.current[matched.id] : undefined;
  }, [fields]);

  const checkVisible = useCallback((actual: any, expected: string | string[], op: 'eq' | 'neq' | 'in') => {
    const expectedList = (Array.isArray(expected) ? expected : [expected]).map(x => String(x ?? '').trim().toLowerCase());
    const actualList = (Array.isArray(actual) ? actual : [actual]).map(x => String(x ?? '').trim().toLowerCase());
    const hasAny = expectedList.some(x => actualList.includes(x));
    if (op === 'in') return hasAny;
    if (Array.isArray(actual)) return op === 'eq' ? hasAny : !hasAny;
    const firstExpected = expectedList[0] ?? '';
    return op === 'eq' ? actualList[0] === firstExpected : actualList[0] !== firstExpected;
  }, []);

  const isVis = useCallback((f: FormField): boolean => {
    // New format (visibleIf)
    if (f.visibleIf) {
      const v = resolveConditionValue(f.visibleIf.fieldId);
      return checkVisible(v, f.visibleIf.value, f.visibleIf.op);
    }
    // Legacy format (show_when)
    if (f.show_when) {
      const v = resolveConditionValue(f.show_when.field);
      return checkVisible(v, String(f.show_when.equals), 'eq');
    }
    return true;
  }, [checkVisible, resolveConditionValue]);

  const getVisible = useCallback((): FormField[] => {
    return fields.filter(f => f.type !== 'section' || isVis(f));
  }, [fields, isVis, values]);

  const visIds = useCallback((): Set<string> => {
    const ids = new Set<string>();
    fields.forEach(f => {
      if (f.type === 'section') {
        if (isVis(f)) { ids.add(f.id); (f.children || []).forEach(c => ids.add(c.id)); }
      } else { ids.add(f.id); }
    });
    return ids;
  }, [fields, isVis, values]);

  /* ═══ QUIZ SCORING ═══ */
  const calcScore = useCallback((): number => {
    let score = 0, total = 0;
    const walk = (list: FormField[]) => list.forEach(f => {
      const qPoints = Number(f.points ?? f.marks ?? 0);
      if (f.type === 'mcq' && f.correct != null && qPoints > 0) {
        total += qPoints;
        const ans = valuesRef.current[f.id];
        if (isMcqCorrect(f, ans)) score += qPoints;
        else if (settings?.negative_marking && ans) score -= Math.round(qPoints * 0.25);
      }
      if (f.children) walk(f.children);
    });
    walk(fields);
    return total > 0 ? Math.max(0, Math.round((score / total) * 100)) : 0;
  }, [fields, settings, values, isMcqCorrect]);

  /* ═══ VALIDATION ═══ */
  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    const vis = visIds();
    const check = (f: FormField) => {
      if (!vis.has(f.id)) return;
      const v = valuesRef.current[f.id];
      if (f.required && (v === undefined || v === '' || v === null || (Array.isArray(v) && v.length === 0)))
        errs[f.id] = `${f.label} is required`;
      if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        errs[f.id] = 'Invalid email';
      if (f.type === 'number' && v !== undefined && v !== '') {
        const n = Number(v);
        if (f.min != null && n < f.min) errs[f.id] = `Minimum is ${f.min}`;
        if (f.max != null && n > f.max) errs[f.id] = `Maximum is ${f.max}`;
      }
    };
    fields.forEach(f => { check(f); (f.children || []).forEach(check); });
    setErrors(errs);
    if (Object.keys(errs).length > 0)
      document.getElementById(Object.keys(errs)[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return Object.keys(errs).length === 0;
  }, [fields, visIds]);

  /* ═══ SUBMIT ═══ */
  const doSubmit = useCallback(async (auto = false) => {
    if (!auto && !validate()) return;
    setSubmitting(true);
    const vis = visIds();
    const resp: Record<string, any> = {};
    for (const [k, v] of Object.entries(valuesRef.current)) { if (vis.has(k)) resp[k] = v; }
    const score = (formType === 'quiz' || formType === 'multi') ? calcScore() : undefined;
    try { await onSubmit(resp, score); } finally { setSubmitting(false); }
  }, [validate, visIds, formType, calcScore, onSubmit]);

  const doSubmitRef = useRef(doSubmit);
  doSubmitRef.current = doSubmit;
  useEffect(() => {
    if (quizTimeLeft === null || !quizStarted || readOnly) return;
    if (quizTimeLeft <= 0) { doSubmitRef.current(true); return; }
    timerRef.current = setInterval(() => setQuizTimeLeft(t => {
      if (t === null) return null;
      if (t <= 1) { setTimeout(() => doSubmitRef.current(true), 0); return 0; }
      return t - 1;
    }), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quizStarted, readOnly]);

  /* ═══ RENDER FIELD ═══ */
  const renderField = (f: FormField, depth = 0): React.ReactNode => {
    const err = errors[f.id];
    const val = values[f.id];
    const dis = readOnly;

    // High-contrast input styling
    const ic = [
      "w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-colors",
      "text-slate-900 placeholder-slate-400",
      err
        ? "border-red-500 bg-red-50"
        : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
      dis ? "opacity-60 pointer-events-none bg-slate-100" : ""
    ].join(" ");

    // High-contrast label
    const labelEl = (
      <label className="text-[13px] font-bold text-slate-800 mb-2 block" htmlFor={f.id}>
        {f.label}
        {f.required && <span className="text-red-500 ml-1">*</span>}
        {f.type === 'mcq' && Number(f.points ?? f.marks ?? 0) > 0 && viewMode === 'admin' && (
          <span className="ml-2 text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full">{Number(f.points ?? f.marks)} marks</span>
        )}
      </label>
    );

    const errEl = err && (
      <p className="text-[12px] text-red-600 mt-1.5 flex items-center gap-1 font-semibold">
        <AlertCircle size={12} />{err}
      </p>
    );

    const wrap = (child: React.ReactNode) => (
      <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} layout>
        {labelEl}
        {child}
        {errEl}
        {f.maxLength && val && <p className="text-[11px] text-slate-500 mt-1 text-right font-medium">{String(val).length}/{f.maxLength}</p>}
      </motion.div>
    );

    // Radio/checkbox option styling
    const optCls = (selected: boolean) => [
      "flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all min-h-[48px]",
      selected
        ? "border-blue-500 bg-blue-50 shadow-sm"
        : "border-slate-200 hover:border-slate-400 bg-white",
      dis ? "pointer-events-none opacity-70" : ""
    ].join(" ");

    switch (f.type) {
      case 'text': case 'email': case 'phone':
        return wrap(<input id={f.id} type={f.type === 'phone' ? 'tel' : f.type} value={val || ''} onChange={e => set(f.id, e.target.value)} placeholder={f.placeholder} className={ic} disabled={dis} maxLength={f.maxLength} />);
      case 'number':
        return wrap(<input id={f.id} type="number" value={val ?? ''} onChange={e => set(f.id, e.target.value === '' ? '' : Number(e.target.value))} min={f.min} max={f.max} className={ic} disabled={dis} />);
      case 'textarea':
        return wrap(<textarea id={f.id} value={val || ''} onChange={e => set(f.id, e.target.value)} placeholder={f.placeholder} className={`${ic} h-28 resize-none`} disabled={dis} maxLength={f.maxLength} />);
      case 'date':
        return wrap(<input id={f.id} type="date" value={val || ''} onChange={e => set(f.id, e.target.value)} className={ic} disabled={dis} />);
      case 'select':
      case 'dropdown':
        return wrap(
          <select id={f.id} value={val || ''} onChange={e => set(f.id, e.target.value)} className={ic} disabled={dis}>
            <option value="">— Select an option —</option>
            {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case 'radio':
        return wrap(
          <div className="space-y-2 mt-1">
            {(f.options || []).map(o => (
              <label key={o} className={optCls(val === o)}>
                <input type="radio" name={f.id} value={o} checked={val === o} onChange={() => set(f.id, o)} className="accent-blue-600 w-4 h-4" disabled={dis} />
                <span className="text-sm font-medium text-slate-800">{o}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return wrap(
          <div className="space-y-2 mt-1">
            {(f.options || []).map(o => {
              const ck = Array.isArray(val) ? val.includes(o) : false;
              return (
                <label key={o} className={optCls(ck)}>
                  <input type="checkbox" checked={ck} onChange={() => { const a = Array.isArray(val) ? [...val] : []; ck ? set(f.id, a.filter(v => v !== o)) : set(f.id, [...a, o]); }} className="accent-blue-600 rounded w-4 h-4" disabled={dis} />
                  <span className="text-sm font-medium text-slate-800">{o}</span>
                </label>
              );
            })}
          </div>
        );
      case 'file': {
        // Cloudinary returns full https:// URLs; fallback for legacy local filenames
        const fileUrl = val
          ? (val.startsWith('http') ? val : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(val)}`)
          : '';
        return wrap(
          <div className="mt-1">
            {val ? (
              <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border-2 border-slate-200">
                <FileText size={18} className="text-blue-600 flex-shrink-0" />
                <span className="text-sm flex-1 truncate font-medium text-slate-800">{val}</span>
                <div className="flex items-center gap-2">
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" 
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View File">
                    <ExternalLink size={16} />
                  </a>
                  {!dis && <button onClick={() => set(f.id, null)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><X size={16} /></button>}
                </div>
              </div>
            ) : (
              <div className={`border-2 border-dashed rounded-xl p-8 text-center ${dis ? 'border-slate-300 opacity-60' : 'border-slate-300 hover:border-blue-500 cursor-pointer bg-white'}`}
                onClick={() => {
                  if (dis) return;
                  const input = document.createElement('input');
                  input.type = 'file';
                  if (f.allowedFormats) input.accept = f.allowedFormats.map(fmt => `.${fmt.toLowerCase()}`).join(',');
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    try {
                      setSubmitting(true);
                      const uploadUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1') + '/uploads';
                      const res = await fetch(uploadUrl, {
                        method: 'POST',
                        body: formData,
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                        }
                      });
                      
                      if (!res.ok) throw new Error('Upload failed');
                      const data = await res.json();
                      // Store the full Cloudinary URL so it can be used directly
                      set(f.id, data.url || data.filename);
                    } catch (err) {
                      console.error('File upload error:', err);
                      setErrors(p => ({ ...p, [f.id]: 'File upload failed' }));
                    } finally {
                      setSubmitting(false);
                    }
                  };
                  input.click();
                }}>
                <Upload size={28} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 font-semibold">Click to upload</p>
                {f.allowedFormats && <p className="text-[11px] text-slate-500 mt-1">Allowed: <span className="font-semibold">{f.allowedFormats.join(', ').toUpperCase()}</span></p>}
                {f.maxSizeMB && <p className="text-[11px] text-slate-500">Max size: <span className="font-semibold">{f.maxSizeMB} MB</span></p>}
              </div>
            )}
          </div>
        );
      }
      case 'rating':
        return wrap(
          <div className="flex gap-2 mt-1">
            {Array.from({ length: f.max || 5 }, (_, i) => i + 1).map(n => (
              <button key={n} type="button" onClick={() => !dis && set(f.id, n)}
                className={`w-11 h-11 rounded-xl border-2 text-sm font-bold transition-all ${val === n ? 'border-blue-500 bg-blue-600 text-white scale-110 shadow-md' : 'border-slate-300 hover:border-blue-400 text-slate-700 bg-white'} ${dis ? 'pointer-events-none' : ''}`}>
                {n}
              </button>
            ))}
          </div>
        );

      case 'mcq': {
        const opts = shuffledOpts[f.id] || f.options || [];
        const showCorrect = viewMode === 'admin'; // ONLY admin sees correct answers
        const selectedText = toOptionText(val, Array.isArray(f.options) ? f.options : []);
        const correctText = toOptionText(f.correct, Array.isArray(f.options) ? f.options : []);
        return wrap(
          <div className="space-y-2 mt-1">
            {opts.map(o => {
              const sel = String(selectedText) === String(o);
              const isCorr = String(correctText) === String(o);
              let cls = optCls(false);
              if (sel && !readOnly) cls = optCls(true);
              if (readOnly && showCorrect && isCorr)
                cls = "flex items-center gap-3 p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50 shadow-sm min-h-[48px] pointer-events-none";
              if (readOnly && showCorrect && sel && !isCorr)
                cls = "flex items-center gap-3 p-3.5 rounded-xl border-2 border-red-500 bg-red-50 shadow-sm min-h-[48px] pointer-events-none";
              if (readOnly && !showCorrect && sel)
                cls = "flex items-center gap-3 p-3.5 rounded-xl border-2 border-blue-500 bg-blue-50 min-h-[48px] pointer-events-none";
              if (readOnly && !showCorrect && !sel)
                cls = "flex items-center gap-3 p-3.5 rounded-xl border-2 border-slate-200 bg-white min-h-[48px] pointer-events-none";

              return (
                <label key={o} className={cls}>
                  <input type="radio" name={f.id} value={o} checked={sel} onChange={() => set(f.id, o)} className="accent-blue-600 w-4 h-4" disabled={dis} />
                  <span className="text-sm flex-1 font-medium text-slate-800">{o}</span>
                  {readOnly && showCorrect && isCorr && <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />}
                  {readOnly && showCorrect && sel && !isCorr && <AlertCircle size={18} className="text-red-600 flex-shrink-0" />}
                </label>
              );
            })}
            {readOnly && showCorrect && Number(f.points ?? f.marks ?? 0) > 0 && (
              (() => {
                const qPoints = Number(f.points ?? f.marks ?? 0);
                return (
              <p className={`text-[12px] font-bold mt-1 ${isMcqCorrect(f, val) ? 'text-emerald-600' : (val ? 'text-red-600' : 'text-slate-400')}`}>
                {isMcqCorrect(f, val) ? `✓ +${qPoints} marks` : val ? `✗ 0 marks${settings?.negative_marking ? ` (−${Math.round(qPoints * 0.25)} penalty)` : ''}` : 'Not answered'}
              </p>
                );
              })()
            )}
          </div>
        );
      }

      case 'section':
        return (
          <motion.div key={f.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} layout
            className="border-l-4 border-blue-500 pl-5 py-4 my-4 bg-blue-50/60 rounded-r-xl">
            <h3 className="text-[15px] font-bold font-heading text-blue-800 mb-5 flex items-center gap-2">
              <ChevronRight size={18} className="text-blue-600" />{f.label}
              {f.section_type && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  f.section_type === 'quiz' ? 'bg-amber-500 text-white' :
                  f.section_type === 'branching' ? 'bg-blue-600 text-white' :
                  'bg-slate-500 text-white'
                }`}>{f.section_type}</span>
              )}
            </h3>
            <div className="space-y-5">{(f.children || []).map(c => renderField(c, depth + 1))}</div>
          </motion.div>
        );

      default:
        return wrap(<p className="text-sm text-slate-500">Unsupported field type: {f.type}</p>);
    }
  };

  const visible = getVisible();

  const countReq = (): [number, number] => {
    let tot = 0, done = 0;
    const vis = visIds();
    const c = (f: FormField) => { if (!vis.has(f.id)) return; if (f.required) { tot++; if (values[f.id] != null && values[f.id] !== '') done++; } };
    fields.forEach(f => { c(f); (f.children || []).forEach(c); });
    return [tot, done];
  };
  const [totalReq, filledReq] = countReq();
  const pct = totalReq > 0 ? Math.round((filledReq / totalReq) * 100) : 0;

  const hasQuiz = fields.some(f => f.type === 'mcq') || fields.some(f => (f.children || []).some(c => c.type === 'mcq'));
  const quizQCount = (() => { let n = 0; const w = (l: FormField[]) => l.forEach(f => { if (f.type === 'mcq') n++; if (f.children) w(f.children); }); w(fields); return n; })();
  const quizTotal = (() => { let n = 0; const w = (l: FormField[]) => l.forEach(f => { const qPoints = Number(f.points ?? f.marks ?? 0); if (f.type === 'mcq' && qPoints > 0) n += qPoints; if (f.children) w(f.children); }); w(fields); return n; })();

  // Quiz start screen
  if (hasQuiz && !quizStarted && !readOnly && settings?.time_limit) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4"><Clock size={36} /></div>
        <h2 className="text-xl font-bold font-heading text-slate-900 mb-2">{formType === 'quiz' ? 'Quiz Ready' : 'Form Ready'}</h2>
        <p className="text-sm text-slate-600 mb-1"><span className="font-bold text-slate-900">{quizQCount}</span> quiz questions · <span className="font-bold text-slate-900">{quizTotal}</span> total marks</p>
        <p className="text-sm text-slate-600 mb-1">Time limit: <span className="font-bold text-slate-900">{settings.time_limit} min</span></p>
        {settings.passing_score && <p className="text-sm text-slate-600 mb-1">Passing score: <span className="font-bold text-slate-900">{settings.passing_score}%</span></p>}
        {settings.negative_marking && <p className="text-sm text-red-600 font-bold mb-1">⚠ Negative marking enabled (25% deduction for wrong answers)</p>}
        <p className="text-xs text-slate-500 mb-6">Timer starts when you click Begin. Auto-submits when time runs out.</p>
        <button onClick={() => setQuizStarted(true)} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg min-h-[48px]">
          Begin {formType === 'quiz' ? 'Quiz' : 'Form'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
        </div>
        <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{pct}% done</span>
      </div>

      {/* Timer */}
      {quizTimeLeft != null && quizStarted && (
        <div className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold ${quizTimeLeft <= 60 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
          <Clock size={16} />{Math.floor(quizTimeLeft / 60).toString().padStart(2, '0')}:{(quizTimeLeft % 60).toString().padStart(2, '0')} remaining
        </div>
      )}

      {/* Auto-save indicator */}
      {lastSaved && !readOnly && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold">
          <Save size={11} /> Auto-saved at {lastSaved}
        </div>
      )}

      {/* Fields */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-6">{visible.map(f => renderField(f))}</div>
      </AnimatePresence>

      {/* Score display for admin/reviewer in read-only */}
      {readOnly && hasQuiz && (viewMode === 'admin' || viewMode === 'reviewer') && (
        <div className="mt-6 p-5 bg-slate-100 rounded-xl border-2 border-slate-200">
          <h4 className="text-sm font-bold text-slate-900 mb-3">Quiz Score</h4>
          <div className="flex items-center gap-5">
            <div className="text-4xl font-black text-blue-600">{calcScore().toFixed(2)}%</div>
            <div className="text-sm">
              {viewMode === 'admin' && (
                <p className="text-slate-700 font-medium">
                  {(() => { let c = 0; const w = (l: FormField[]) => l.forEach(f => { if (f.type === 'mcq' && isMcqCorrect(f, values[f.id])) c++; if (f.children) w(f.children); }); w(fields); return c; })()}/{quizQCount} correct answers
                </p>
              )}
              {viewMode === 'reviewer' && <p className="text-slate-600">Score calculated automatically by system</p>}
              {settings?.passing_score && (
                <p className={`font-bold text-sm mt-1 ${calcScore() >= settings.passing_score ? 'text-emerald-600' : 'text-red-600'}`}>
                  {calcScore() >= settings.passing_score ? '✓ PASSED' : '✗ FAILED'}
                </p>
              )}
            </div>
          </div>
          {viewMode === 'reviewer' && <p className="text-[11px] text-slate-500 mt-3">Note: Correct answers are hidden from reviewers. Only admin can see the answer key.</p>}
        </div>
      )}

      {/* Submit / Draft buttons */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t-2 border-slate-200">
          {onSaveDraft && (
            <button type="button" onClick={() => { onSaveDraft(valuesRef.current); setLastSaved(new Date().toLocaleTimeString()); }}
              className="px-5 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 min-h-[48px]">
              <Save size={16} /> Save Draft
            </button>
          )}
          <button type="button" onClick={() => doSubmit(false)} disabled={submitting}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px] shadow-md">
            {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send size={16} /> Submit</>}
          </button>
        </div>
      )}
    </div>
  );
}
