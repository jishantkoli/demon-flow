import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Badge({ tone = 'blue', children }: { tone?: 'blue' | 'green' | 'amber' | 'rose' | 'slate'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Card({ children, className = '', padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={`card ${padded ? 'p-5' : ''} ${className} bg-white rounded-xl shadow-sm border border-slate-200`}>{children}</div>;
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6">
      <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">{icon}</div>
      <div className="font-semibold text-slate-800">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export function Sparkline({ data, w = 120, h = 36 }: { data: number[]; w?: number; h?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / (data.length - 1 || 1);
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} className="block">
      <polyline className="fill-blue-50 stroke-none" points={area} />
      <polyline className="fill-none stroke-blue-500 stroke-2" points={points} />
    </svg>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="text-sm text-slate-500 flex items-center gap-1.5 flex-wrap">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-slate-300">/</span>}
          {it.to ? <Link to={it.to} className="hover:text-blue-600">{it.label}</Link> : <span className="text-slate-800 font-medium">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span onClick={() => onChange(!checked)} className={`w-10 h-6 rounded-full transition-colors relative ${checked ? 'bg-green-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </label>
  );
}
