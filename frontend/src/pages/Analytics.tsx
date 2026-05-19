import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, TrendingUp, Users, FileText, PieChart, Calendar, Award, Target, Filter, ChevronRight, School } from 'lucide-react';

export default function Analytics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState('');
  const [forms, setForms] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const url = selectedForm ? `/stats?form_id=${selectedForm}` : '/stats';
      const s = await api.get(url);
      setStats(s); 
      if (s.forms) setForms(s.forms);
    } catch (err) { 
      console.error('Failed to fetch analytics:', err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, [selectedForm]);

  if (loading && !stats) return (
    <div className="flex flex-col items-center justify-center h-[60vh]">
      <div className="w-12 h-12 border-[3px] border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-slate-500 font-medium animate-pulse">Gathering insights...</p>
    </div>
  );

  const s = stats || {};
  const timeline = Object.entries(s.submissionTimeline || {}).sort(([a], [b]) => a.localeCompare(b));
  const maxTimeline = Math.max(...timeline.map(([, v]) => v as number), 1);

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary mb-1">
            <BarChart3 size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Performance Metrics</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm text-slate-500 font-medium">Real-time data insights {selectedForm ? 'for selected form' : 'across all active forms'}</p>
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1">
            <Filter size={10} /> Filter by Form
          </label>
          <select 
            value={selectedForm} 
            onChange={e => { setSelectedForm(e.target.value); setLoading(true); }} 
            className="text-sm bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 outline-none min-w-[280px] focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer font-bold text-slate-700 shadow-inner"
          >
            <option value="">All Forms (Overview)</option>
            {forms.map((f: any) => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Users', value: s.totalUsers, icon: Users, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/20' },
          { label: 'Active Forms', value: s.activeForms, icon: FileText, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' },
          { label: 'Submissions', value: s.totalSubmissions, icon: TrendingUp, color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
          { label: 'Completion', value: `${s.completionRate || 0}%`, icon: Target, color: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/20' },
          { label: 'Avg Score', value: `${s.avgScore || 0}%`, icon: Award, color: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/20' }
        ].map((kpi, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ delay: i * 0.05 }}
            className={`bg-gradient-to-br ${kpi.color} text-white rounded-[2rem] p-6 shadow-xl ${kpi.shadow} relative overflow-hidden group hover:scale-[1.02] transition-transform`}
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
            <kpi.icon size={24} className="opacity-70 mb-4" />
            <p className="text-3xl font-black mb-1">{kpi.value ?? 0}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Timeline Chart */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          className="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Calendar size={16} /></div>
              Submission Activity
            </h3>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500">Last 14 Days</span>
            </div>
          </div>
          
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <TrendingUp size={48} className="opacity-20 mb-3" />
              <p className="text-sm font-medium">No activity recorded yet</p>
            </div>
          ) : (
            <div className="flex items-end gap-2 h-56 px-2">
              {timeline.map(([date, count], i) => (
                <div key={date} className="flex-1 group relative flex flex-col items-center gap-3">
                  {/* Tooltip */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap z-10">
                    {count as number} Submissions
                  </div>
                  <motion.div 
                    initial={{ height: 0 }} 
                    animate={{ height: `${((count as number) / maxTimeline) * 100}%` }}
                    transition={{ delay: 0.2 + i * 0.03, duration: 0.8, ease: "circOut" }}
                    className="w-full bg-gradient-to-t from-primary to-accent-blue rounded-xl min-h-[6px] group-hover:from-primary-hover group-hover:to-primary transition-all relative"
                  >
                    <div className="absolute top-1 left-1 right-1 h-2 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                  <span className="text-[9px] font-bold text-slate-400 group-hover:text-primary transition-colors">{date.slice(5).replace('-', '/')}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Status Distribution */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} 
          animate={{ opacity: 1, x: 0 }} 
          className="lg:col-span-4 bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm"
        >
          <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><PieChart size={16} /></div>
            Status Distribution
          </h3>
          <div className="space-y-5">
            {[
              { label: 'Submitted', value: s.submissionsByStatus?.submitted || 0, color: 'bg-blue-500', bg: 'bg-blue-50' },
              { label: 'Under Review', value: s.submissionsByStatus?.under_review || 0, color: 'bg-indigo-500', bg: 'bg-indigo-50' },
              { label: 'Approved', value: s.submissionsByStatus?.approved || 0, color: 'bg-emerald-500', bg: 'bg-emerald-50' },
              { label: 'Rejected', value: s.submissionsByStatus?.rejected || 0, color: 'bg-red-500', bg: 'bg-red-50' }
            ].map(st => { 
              const total = Math.max(s.totalSubmissions || 1, 1); 
              const pct = Math.round((st.value / total) * 100);
              return (
                <div key={st.label} className="group">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600">{st.label}</span>
                    <span className="text-xs font-black text-slate-900">{st.value} <span className="text-slate-400 font-medium ml-1">({pct}%)</span></span>
                  </div>
                  <div className={`h-3 ${st.bg} rounded-full overflow-hidden p-0.5`}>
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${pct}%` }} 
                      transition={{ delay: 0.4, duration: 1, ease: "backOut" }} 
                      className={`h-full rounded-full ${st.color} shadow-sm`}
                    />
                  </div>
                </div>
              ); 
            })}
          </div>
        </motion.div>

        {/* Score Distribution - Only if submissions exist */}
        {s.totalSubmissions > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="lg:col-span-7 bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm"
          >
            <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Award size={16} /></div>
              Score Distribution
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {Object.entries(s.scoreDistribution || {}).map(([range, count], i) => {
                const total = Object.values(s.scoreDistribution || {}).reduce((a: number, b: any) => a + (b as number), 0) as number || 1;
                const pct = Math.round(((count as number) / total) * 100);
                return (
                  <div key={range} className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-slate-500 w-12">{range}%</span>
                    <div className="flex-1 h-4 bg-slate-50 rounded-lg overflow-hidden relative">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${pct}%` }} 
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }} 
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-lg" 
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-800 w-8">{count as number}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Nomination & School Stats */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className={`${s.totalSubmissions > 0 ? 'lg:col-span-5' : 'lg:col-span-12'} bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm`}
        >
          <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center"><Target size={16} /></div>
            Lifecycle & Reach
          </h3>
          
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Invited', count: s.nominationsByStatus?.invited || 0, color: 'bg-sky-50 text-sky-700' },
              { label: 'Pending', count: s.nominationsByStatus?.in_progress || 0, color: 'bg-indigo-50 text-indigo-700' },
              { label: 'Done', count: s.nominationsByStatus?.completed || 0, color: 'bg-emerald-50 text-emerald-700' }
            ].map(n => (
              <div key={n.label} className={`${n.color} rounded-2xl p-4 text-center border border-white shadow-sm`}>
                <p className="text-2xl font-black mb-1">{n.count}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider">{n.label}</p>
              </div>
            ))}
          </div>

          {s.schoolCodes && s.schoolCodes.length > 0 && (
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <School size={12} /> Top Active Schools
              </p>
              <div className="flex flex-wrap gap-2">
                {s.schoolCodes.map((c: string) => (
                  <span key={c} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 shadow-sm hover:border-primary transition-colors cursor-default">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" /> {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
