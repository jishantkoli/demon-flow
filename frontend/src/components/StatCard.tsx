import React from 'react';
import { LucideIcon } from 'lucide-react';

const colors: Record<string, { bg: string; icon: string }> = {
  purple: { bg: 'bg-violet-500 shadow-lg shadow-violet-500/30', icon: 'text-white' },
  blue: { bg: 'bg-blue-500 shadow-lg shadow-blue-500/30', icon: 'text-white' },
  red: { bg: 'bg-red-500 shadow-lg shadow-red-500/30', icon: 'text-white' },
  amber: { bg: 'bg-amber-500 shadow-lg shadow-amber-500/30', icon: 'text-white' },
  rose: { bg: 'bg-rose-500 shadow-lg shadow-rose-500/30', icon: 'text-white' },
  green: { bg: 'bg-emerald-500 shadow-lg shadow-emerald-500/30', icon: 'text-white' },
};

export default function StatCard({ label, value, icon: Icon, trend, trendUp, color = 'purple', subtitle, onClick, ctaText }: {
  label: string; value: string | number; icon: LucideIcon; trend?: string; trendUp?: boolean; color?: string; subtitle?: string;
  onClick?: () => void; ctaText?: string;
}) {
  const c = colors[color] || colors.purple;
  const clickable = typeof onClick === 'function';
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 p-6 shadow-sm transition-all duration-200 group ${clickable ? 'hover:shadow-md cursor-pointer hover:border-primary/40' : 'hover:shadow-md'}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') onClick?.(); } : undefined}
      aria-label={clickable ? `Open ${label}` : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-[28px] font-bold mt-2 font-heading leading-tight text-slate-900">{value}</p>
          {subtitle && <p className="text-[11px] text-slate-500 mt-2">{subtitle}</p>}
          {trend && <p className={`text-xs mt-2 font-semibold ${trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>{trendUp ? '↑' : '↓'} {trend}</p>}
          {ctaText && <p className="text-[11px] text-primary font-semibold mt-2">{ctaText}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.bg} group-hover:scale-110 transition-transform`}>
          <Icon size={24} className={c.icon} />
        </div>
      </div>
    </div>
  );
}
