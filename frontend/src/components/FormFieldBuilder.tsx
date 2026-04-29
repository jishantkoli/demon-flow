import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Copy, GitBranch } from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import type { FormField } from './FormRenderer';

const TYPES = [
  { v:'text', l:'Text (Short)' }, { v:'textarea', l:'Text (Long)' }, { v:'number', l:'Number' },
  { v:'email', l:'Email' }, { v:'phone', l:'Phone' }, { v:'date', l:'Date' },
  { v:'select', l:'Dropdown' }, { v:'radio', l:'Radio' }, { v:'checkbox', l:'Checkbox' },
  { v:'file', l:'File Upload' }, { v:'mcq', l:'MCQ (Quiz)' }, { v:'rating', l:'Rating' },
  { v:'section', l:'Section (Branching)' },
];

interface Props { fields: FormField[]; onChange:(f:FormField[])=>void; formType:string; }

export default function FormFieldBuilder({ fields, onChange, formType }: Props) {
  const [exp, setExp] = useState<string|null>(null);

  const add = (type: string) => {
    const id = `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const nf: FormField = { id, type: type as any, label: `New ${TYPES.find(t=>t.v===type)?.l||'Field'}`, required: false };
    if (['select','radio','checkbox','mcq'].includes(type)) nf.options = ['Option 1','Option 2','Option 3'];
    if (type==='mcq') { nf.correct='Option 1'; nf.points=10; }
    if (type==='section') { nf.show_when={field:'',equals:''}; nf.children=[]; }
    if (type==='rating') nf.max=5;
    if (type==='file') { nf.allowedFormats=['pdf','jpg','png']; nf.maxSizeMB=5; }
    onChange([...fields, nf]); setExp(id);
  };

  const upd = (id:string, u:Partial<FormField>) => {
    onChange(fields.map(f => {
      if (f.id===id) return {...f,...u};
      if (f.children) return {...f, children: f.children.map(c=>c.id===id?{...c,...u}:c)};
      return f;
    }));
  };

  const rem = (id:string) => onChange(fields.filter(f=>f.id!==id).map(f=>({...f,children:f.children?.filter(c=>c.id!==id)})));

  const move = (i:number, d:-1|1) => {
    const a=[...fields]; const t=i+d;
    if(t<0||t>=a.length) return;
    [a[i],a[t]]=[a[t],a[i]]; onChange(a);
  };

  const dup = (f:FormField) => {
    const nid=`f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const cp={...f,id:nid,label:`${f.label} (Copy)`,children:f.children?.map(c=>({...c,id:`c_${Date.now()}_${Math.random().toString(36).slice(2,6)}`}))};
    onChange([...fields,cp]);
  };

  const addChild = (pid:string, type:string) => {
    const id=`c_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const nf:FormField = {id, type:type as any, label:`New ${TYPES.find(t=>t.v===type)?.l||'Field'}`, required:false};
    if(['select','radio','checkbox','mcq'].includes(type)) nf.options=['Option 1','Option 2'];
    if(type==='mcq'){nf.correct='Option 1';nf.points=10;}
    if(type==='file'){nf.allowedFormats=['pdf','jpg'];nf.maxSizeMB=5;}
    onChange(fields.map(f=>f.id===pid?{...f,children:[...(f.children||[]),nf]}:f));
  };

  const triggers = fields.filter(f=>f.is_trigger||f.type==='select'||f.type==='radio');

  const typeBadge = (type: string) => {
    const map: Record<string, string> = {
      section: 'bg-blue-600 text-white',
      mcq: 'bg-amber-500 text-white',
      file: 'bg-sky-600 text-white',
      select: 'bg-teal-600 text-white',
      radio: 'bg-indigo-600 text-white',
      checkbox: 'bg-pink-600 text-white',
      text: 'bg-slate-600 text-white',
      textarea: 'bg-slate-500 text-white',
      number: 'bg-cyan-600 text-white',
      email: 'bg-sky-600 text-white',
      phone: 'bg-green-600 text-white',
      date: 'bg-orange-600 text-white',
      rating: 'bg-yellow-600 text-white',
    };
    return map[type] || 'bg-slate-500 text-white';
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30";
  const labelCls = "text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1 block";

  function FieldItem({ f, i, isChild = false, onUpd, onRem, onDup, onMove, onAddChild, triggers, exp, setExp, fields }: { 
    f: FormField, i: number, isChild?: boolean, 
    onUpd: (id: string, u: Partial<FormField>) => void,
    onRem: (id: string) => void,
    onDup: (f: FormField) => void,
    onMove: (i: number, d: -1 | 1) => void,
    onAddChild: (pid: string, type: string) => void,
    triggers: FormField[],
    exp: string | null,
    setExp: (id: string | null) => void,
    fields: FormField[]
  }) {
    const controls = useDragControls();
    const open = exp === f.id;

    return (
      <Reorder.Item
        value={f}
        id={f.id}
        dragListener={false}
        dragControls={controls}
        className={`border-2 rounded-xl overflow-hidden transition-all ${open ? 'border-blue-500 shadow-md' : 'border-slate-200'} ${isChild ? 'bg-slate-50' : 'bg-white'}`}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 py-3 cursor-pointer hover:bg-slate-50" onClick={() => setExp(open ? null : f.id)}>
          <div 
            onPointerDown={(e) => controls.start(e)}
            className="p-1 -m-1 hover:bg-slate-100 rounded cursor-grab active:cursor-grabbing text-slate-400 flex-shrink-0"
          >
            <GripVertical size={14} />
          </div>
          <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase flex-shrink-0 ${typeBadge(f.type)}`}>{f.type}</span>
          <span className="text-sm font-semibold flex-1 truncate text-slate-800">{f.label}</span>
          {f.required && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold flex-shrink-0">REQ</span>}
          {f.type === 'mcq' && f.points != null && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold flex-shrink-0">{f.points}pt</span>}
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
            {!isChild && <button onClick={e => { e.stopPropagation(); onMove(i, -1); }} className="p-1 rounded hover:bg-slate-200 text-slate-500"><ChevronUp size={13} /></button>}
            {!isChild && <button onClick={e => { e.stopPropagation(); onMove(i, 1); }} className="p-1 rounded hover:bg-slate-200 text-slate-500"><ChevronDown size={13} /></button>}
            <button onClick={e => { e.stopPropagation(); onDup(f); }} className="p-1 rounded hover:bg-slate-200 text-slate-500"><Copy size={13} /></button>
            <button onClick={e => { e.stopPropagation(); onRem(f.id); }} className="p-1 rounded hover:bg-red-100 text-slate-500 hover:text-red-600"><Trash2 size={13} /></button>
          </div>
        </div>

        {/* Expanded editor */}
        {open && (
          <div className="px-4 pb-4 pt-3 border-t-2 border-blue-100 bg-blue-50/30 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className={labelCls}>Field Label</label>
                <input value={f.label} onChange={e => onUpd(f.id, { label: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Field Type</label>
                <select value={f.type} onChange={e => onUpd(f.id, { type: e.target.value as any })} className={inputCls}>
                  {TYPES.filter(t => isChild ? t.v !== 'section' : true).map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
                <input type="checkbox" checked={f.required || false} onChange={e => onUpd(f.id, { required: e.target.checked })} className="rounded accent-blue-600 w-4 h-4" /> Required</label>
              {!isChild && (f.type === 'select' || f.type === 'radio') && (
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
                  <input type="checkbox" checked={f.is_trigger || false} onChange={e => onUpd(f.id, { is_trigger: e.target.checked })} className="rounded accent-blue-600 w-4 h-4" /> Branch trigger</label>)}
            </div>

            {/* Options editor */}
            {['select', 'radio', 'checkbox', 'mcq'].includes(f.type) && (
              <div><label className={labelCls}>Options (one per line)</label>
                <textarea value={(f.options || []).join('\n')} onChange={e => onUpd(f.id, { options: e.target.value.split('\n').filter(o => o.trim()) })} className={`${inputCls} h-24 resize-none font-mono`} /></div>)}

            {/* MCQ correct + points */}
            {f.type === 'mcq' && (
              <div className="grid grid-cols-2 gap-3 p-4 bg-amber-50 rounded-xl border-2 border-amber-300">
                <div><label className="text-[11px] font-bold text-amber-800 uppercase mb-1 block">✓ Correct Answer</label>
                  <select value={f.correct || ''} onChange={e => onUpd(f.id, { correct: e.target.value })} className={inputCls}>
                    <option value="">— Select correct —</option>{(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                <div><label className="text-[11px] font-bold text-amber-800 uppercase mb-1 block">Points / Marks</label>
                  <input type="number" value={f.points || 0} onChange={e => onUpd(f.id, { points: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                <p className="col-span-2 text-[11px] text-amber-700 font-medium">⚠ Correct answer is hidden from users & reviewers. Only admin sees it.</p>
              </div>)}

            {/* File settings */}
            {f.type === 'file' && (
              <div className="grid grid-cols-2 gap-3 p-4 bg-sky-50 rounded-xl border-2 border-sky-300">
                <div><label className="text-[11px] font-bold text-sky-800 uppercase mb-1 block">Allowed Formats</label>
                  <input value={(f.allowedFormats || []).join(', ')} onChange={e => onUpd(f.id, { allowedFormats: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) })} className={inputCls} placeholder="pdf, jpg, png" /></div>
                <div><label className="text-[11px] font-bold text-sky-800 uppercase mb-1 block">Max Size (MB)</label>
                  <input type="number" value={f.maxSizeMB || 5} onChange={e => onUpd(f.id, { maxSizeMB: parseInt(e.target.value) || 5 })} className={inputCls} /></div>
              </div>)}

            {/* Number min/max */}
            {f.type === 'number' && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Min Value</label><input type="number" value={f.min ?? ''} onChange={e => onUpd(f.id, { min: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} /></div>
                <div><label className={labelCls}>Max Value</label><input type="number" value={f.max ?? ''} onChange={e => onUpd(f.id, { max: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} /></div>
              </div>)}

            {/* Rating max */}
            {f.type === 'rating' && (
              <div><label className={labelCls}>Max Rating</label>
                <input type="number" value={f.max || 5} min={2} max={10} onChange={e => onUpd(f.id, { max: parseInt(e.target.value) || 5 })} className={`${inputCls} w-24`} /></div>)}

            {/* Section: branching + children */}
            {f.type === 'section' && f.visibleIf && (
              <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-300 space-y-3">
                <h5 className="text-xs font-bold text-blue-800 flex items-center gap-1.5"><GitBranch size={14} /> Branch Rule: Show this section when…</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] font-bold text-blue-700 mb-1 block">IF field equals</label>
                    <select value={f.visibleIf.fieldId} onChange={e => onUpd(f.id, { visibleIf: { ...f.visibleIf!, fieldId: e.target.value, op: 'eq' } })} className={inputCls}>
                      <option value="">— Select trigger —</option>{triggers.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                  <div><label className="text-[11px] font-bold text-blue-700 mb-1 block">EQUALS value</label>
                    {(() => {
                      const tr = triggers.find(t => t.id === f.visibleIf?.fieldId);
                      if (tr?.options) return <select value={f.visibleIf.value} onChange={e => onUpd(f.id, { visibleIf: { ...f.visibleIf!, value: e.target.value } })} className={inputCls}><option value="">— Select —</option>{tr.options.map(o => <option key={o} value={o}>{o}</option>)}</select>;
                      return <input value={f.visibleIf.value} onChange={e => onUpd(f.id, { visibleIf: { ...f.visibleIf!, value: e.target.value } })} className={inputCls} placeholder="value" />;
                    })()}</div>
                </div>
                <div className="mt-4 space-y-2">
                  <h6 className="text-[11px] font-bold text-blue-700 uppercase">Fields inside this section:</h6>
                  {(f.children || []).length === 0 && <p className="text-xs text-slate-500 italic py-2">No fields yet. Add fields below.</p>}
                  
                  <Reorder.Group axis="y" values={f.children || []} onReorder={(newChildren) => onUpd(f.id, { children: newChildren })} className="space-y-2">
                    {(f.children || []).map((c, ci) => (
                      <FieldItem 
                        key={c.id} f={c} i={ci} isChild={true} 
                        onUpd={onUpd} onRem={onRem} onDup={onDup} onMove={onMove} onAddChild={onAddChild} 
                        triggers={triggers} exp={exp} setExp={setExp} fields={fields}
                      />
                    ))}
                  </Reorder.Group>

                  <div className="flex gap-1.5 flex-wrap pt-2">
                    {['text', 'number', 'textarea', 'select', 'radio', 'checkbox', 'mcq', 'file'].map(t => (
                      <button key={t} onClick={() => onAddChild(f.id, t)} className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold">+ {t}</button>))}
                  </div>
                </div>
              </div>)}
          </div>)}
      </Reorder.Item>
    );
  }

  const renderEditor = (f:FormField, i:number, isChild=false) => {
    return (
      <FieldItem 
        key={f.id} f={f} i={i} isChild={isChild} 
        onUpd={upd} onRem={rem} onDup={dup} onMove={move} onAddChild={addChild} 
        triggers={triggers} exp={exp} setExp={setExp} fields={fields}
      />
    );
  };

  const allowedTypes = TYPES;

  return (
    <div className="space-y-3">
      {fields.length === 0 && <div className="text-center py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300"><p className="text-sm text-slate-500">No fields yet. Add your first field below.</p></div>}
      
      <Reorder.Group axis="y" values={fields} onReorder={onChange} className="space-y-3">
        {fields.map((f, i) => renderEditor(f, i))}
      </Reorder.Group>

      <div className="flex flex-wrap gap-2 pt-3 border-t-2 border-slate-200">
        <span className="text-[11px] font-bold text-slate-500 uppercase self-center mr-2">Add field:</span>
        {allowedTypes.map(t=>(
          <button key={t.v} onClick={()=>add(t.v)} className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 ${
            t.v==='mcq'?'bg-amber-500 text-white hover:bg-amber-600':
            t.v==='section'?'bg-blue-600 text-white hover:bg-blue-700':
            t.v==='file'?'bg-sky-600 text-white hover:bg-sky-700':
            'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}><Plus size={12}/> {t.l}</button>))}
      </div>
    </div>);
}
