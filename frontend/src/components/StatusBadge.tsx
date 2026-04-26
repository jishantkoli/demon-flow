import React from 'react';

const styles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20',
  submitted: 'bg-blue-50 text-blue-700 ring-blue-500/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-500/20',
  in_progress: 'bg-sky-50 text-sky-700 ring-sky-500/20',
  under_review: 'bg-sky-50 text-sky-700 ring-sky-500/20',
  draft: 'bg-slate-100 text-slate-500 ring-slate-400/20',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-500/20',
  expired: 'bg-slate-100 text-slate-400 ring-slate-300/20',
  inactive: 'bg-slate-100 text-slate-400 ring-slate-300/20',
  invited: 'bg-indigo-50 text-indigo-700 ring-indigo-500/20',
};

export default function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' }) {
  const s = styles[status] || styles.draft;
  const cls = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[11px]';
  return <span className={`inline-flex items-center rounded-full font-semibold capitalize ring-1 ring-inset ${cls} ${s}`}>{status?.replace(/_/g, ' ') || 'unknown'}</span>;
}
