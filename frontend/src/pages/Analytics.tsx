import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, FileText, PieChart, Calendar, Award, Target } from 'lucide-react';

export default function Analytics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState('');
  const [forms, setForms] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const url = selectedForm ? `/stats?form_id=${selectedForm}` : '/stats';
      const s = await api.get(url);
      setStats(s); setForms(s.forms || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, [selectedForm]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>;
  const s = stats || {};

  const timeline = Object.entries(s.submissionTimeline || {}).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const maxTimeline = Math.max(...timeline.map(([, v]) => v as number), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold font-heading">Analytics</h1><p className="text-sm text-slate-500">Comprehensive data insights and reporting</p></div>
        <select value={selectedForm} onChange={e => { setSelectedForm(e.target.value); setLoading(true); }} className="text-xs bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none min-w-[200px]" aria-label="Select form">
          <option value="">All Forms (Overview)</option>
          {forms.map((f: any) => <option key={f.id} value={f.id}>{f.title} ({f.status})</option>)}
        </select>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[{ label: 'Users', value: s.totalUsers, icon: Users, color: 'from-blue-500 to-blue-600' },
          { label: 'Active Forms', value: s.activeForms, icon: FileText, color: 'from-emerald-500 to-emerald-600' },
          { label: 'Submissions', value: s.totalSubmissions, icon: TrendingUp, color: 'from-indigo-500 to-indigo-600' },
          { label: 'Completion', value: `${s.completionRate || 0}%`, icon: Target, color: 'from-amber-500 to-amber-600' },
          { label: 'Avg Score', value: `${s.avgScore || 0}%`, icon: Award, color: 'from-pink-500 to-pink-600' }]
          .map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`bg-gradient-to-br ${kpi.color} text-white rounded-2xl p-4 shadow-lg`}>
              <kpi.icon size={20} className="opacity-80 mb-2" />
              <p className="text-2xl font-bold">{kpi.value || 0}</p>
              <p className="text-[11px] opacity-80">{kpi.label}</p>
            </motion.div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submission Timeline Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold font-heading text-sm mb-4 flex items-center gap-2"><Calendar size={14} className="text-primary" /> Submission Timeline</h3>
          {timeline.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">No timeline data</p> : (
            <div className="flex items-end gap-1 h-40">
              {timeline.map(([date, count], i) => (
                <div key={date} className="flex-1 flex flex-col items-center gap-1" title={`${date}: ${count} submissions`}>
                  <motion.div initial={{ height: 0 }} animate={{ height: `${((count as number) / maxTimeline) * 100}%` }}
                    transition={{ delay: 0.3 + i * 0.03, duration: 0.5 }}
                    className="w-full bg-gradient-to-t from-primary to-accent-blue rounded-t-lg min-h-[4px]" />
                  <span className="text-[8px] text-slate-500 -rotate-45 origin-left whitespace-nowrap">{date.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Status Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold font-heading text-sm mb-4">Submission Status</h3>
          <div className="space-y-3">
            {[{ label: 'Submitted', value: s.submissionsByStatus?.submitted || 0, color: 'bg-blue-500' },
              { label: 'Under Review', value: s.submissionsByStatus?.under_review || 0, color: 'bg-indigo-500' },
              { label: 'Approved', value: s.submissionsByStatus?.approved || 0, color: 'bg-emerald-500' },
              { label: 'Rejected', value: s.submissionsByStatus?.rejected || 0, color: 'bg-red-500' }]
              .map(st => { const total = Math.max(s.totalSubmissions || 1, 1); return (
                <div key={st.label}><div className="flex justify-between text-xs mb-1"><span className="font-medium">{st.label}</span><span className="text-slate-500">{st.value} ({Math.round(st.value / total * 100)}%)</span></div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${(st.value / total) * 100}%` }} transition={{ delay: 0.4, duration: 0.8 }} className={`h-full rounded-full ${st.color}`} /></div>
                </div>); })}
          </div>
        </motion.div>

        {/* Score Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold font-heading text-sm mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-primary" /> Score Distribution</h3>
          <div className="space-y-2">
            {Object.entries(s.scoreDistribution || {}).map(([range, count]) => {
              const total = Object.values(s.scoreDistribution || {}).reduce((a: number, b: any) => a + (b as number), 0) as number || 1;
              return (
                <div key={range}><div className="flex justify-between text-xs mb-1"><span className="font-medium">{range}%</span><span className="text-slate-500">{count as number}</span></div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${((count as number) / total) * 100}%` }} transition={{ delay: 0.5, duration: 0.6 }} className="h-full rounded-full bg-gradient-to-r from-primary to-accent-green" /></div>
                </div>);
            })}
          </div>
        </motion.div>

        {/* Nominations */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold font-heading text-sm mb-4">Nomination Status</h3>
          <div className="grid grid-cols-3 gap-3">
            {[{ label: 'Invited', count: s.nominationsByStatus?.invited || 0, color: 'bg-sky-50 text-sky-700' },
              { label: 'In Progress', count: s.nominationsByStatus?.in_progress || 0, color: 'bg-indigo-50 text-indigo-700' },
              { label: 'Completed', count: s.nominationsByStatus?.completed || 0, color: 'bg-emerald-50 text-emerald-700' }]
              .map(n => (<div key={n.label} className={`${n.color} rounded-xl p-3 text-center`}><p className="text-xl font-bold">{n.count}</p><p className="text-[10px] font-semibold">{n.label}</p></div>))}
          </div>
          {s.schoolCodes && s.schoolCodes.length > 0 && (
            <div className="mt-4"><p className="text-xs font-semibold text-slate-500 mb-2">Active School Codes</p>
              <div className="flex flex-wrap gap-1">{s.schoolCodes.map((c: string) => <span key={c} className="text-[10px] font-mono font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">{c}</span>)}</div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
