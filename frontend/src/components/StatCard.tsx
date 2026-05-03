import React from 'react';
import { LucideIcon } from 'lucide-react';

const colors: Record<string, { bg: string; icon: string }> = {
  purple: { bg: 'bg-accent-purple shadow-lg shadow-accent-purple/30', icon: 'text-white' },
  blue: { bg: 'bg-accent-blue shadow-lg shadow-accent-blue/30', icon: 'text-white' },
  red: { bg: 'bg-accent-red shadow-lg shadow-accent-red/30', icon: 'text-white' },
  amber: { bg: 'bg-accent-orange shadow-lg shadow-accent-orange/30', icon: 'text-white' },
  rose: { bg: 'bg-accent-red shadow-lg shadow-accent-red/30', icon: 'text-white' },
  green: { bg: 'bg-success shadow-lg shadow-success/30', icon: 'text-white' },
};

export default function StatCard({ label, value, icon: Icon, trend, trendUp, color = 'purple', subtitle, onClick, ctaText }: {
  label: string; value: string | number; icon: LucideIcon; trend?: string; trendUp?: boolean; color?: string; subtitle?: string;
  onClick?: () => void; ctaText?: string;
}) {
  const c = colors[color] || colors.purple;
  const clickable = typeof onClick === 'function';
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm transition-all duration-200 group ${clickable ? 'hover:shadow-md cursor-pointer hover:border-primary/40' : 'hover:shadow-md'}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') onClick?.(); } : undefined}
      aria-label={clickable ? `Open ${label}` : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-[26px] font-bold mt-1 font-heading leading-tight text-slate-900">{value}</p>
          {subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>}
          {trend && <p className={`text-xs mt-1.5 font-semibold ${trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>{trendUp ? '↑' : '↓'} {trend}</p>}
          {clickable && <p className="text-[10px] text-primary font-semibold mt-1.5">{ctaText || 'Click to open details'}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.bg} group-hover:scale-110 transition-transform`}>
          <Icon size={20} className={c.icon} />
        </div>
      </div>
    </div>
  );
}
