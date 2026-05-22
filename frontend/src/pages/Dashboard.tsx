import React, { useState, useEffect } from 'react';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, FileText, Inbox, CheckSquare, Clock, TrendingUp, 
  Activity, Award, UserPlus, Calendar, Target, AlertTriangle, Shield,
  ChevronRight, ArrowUpRight, School, CheckCircle2, Settings
} from 'lucide-react';

export default function Dashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [s, subs] = await Promise.all([
        api.get('/stats').catch(() => ({})),
        api.get('/submissions').catch(() => [])
      ]);
      setStats(s || {});
      setRecentSubs(Array.isArray(subs) ? subs.slice(0, 10) : []);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setStats({});
      setRecentSubs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchLogs = async () => {
      if (user?.role !== 'admin') return;
      try {
        const logs = await api.get('/audit-logs?limit=10').catch(() => []);
        setRecentLogs(Array.isArray(logs) ? logs.slice(0, 10) : []);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setRecentLogs([]);
      }
    };

    fetchData();
    fetchLogs();
  }, [user?.role]);

  if (loading && !stats) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>;
  
  const s = stats || {};
  const anim = (i: number) => ({ initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05, duration: 0.4 } });
  
  const subId = (sub: any) => sub?.id || sub?._id;
  const canOpenSubmission = (sub: any) => Boolean(subId(sub));
  
  const parseResponses = (raw: any): Record<string, any> => {
    if (!raw) return {};
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        const out: Record<string, any> = {};
        parsed.forEach((r: any) => { if (r?.fieldId) out[String(r.fieldId)] = r.value; });
        return out;
      }
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const displaySubmissionName = (sub: any) => {
    if (sub?.user_name && String(sub.user_name).trim() && String(sub.user_name).trim().toLowerCase() !== 'anonymous') {
      return String(sub.user_name).trim();
    }
    const responses = parseResponses(sub?.responses);
    return String(responses.full_name || responses.name || responses.teacher_name || sub?.user_email || 'Anonymous').trim();
  };

  const displaySubmissionNameFirstChar = (sub: any) => displaySubmissionName(sub).charAt(0).toUpperCase();

  const timeline = Object.entries(s.submissionTimeline || {}).sort(([a], [b]) => a.localeCompare(b)).slice(-10);
  const maxTimeline = Math.max(...timeline.map(([, v]) => v as number), 1);

  // ─── Admin Premium Dashboard ──────────────────────────────────────────────
  if (user.role === 'admin') {
    return (
      <div className="max-w-[1400px] mx-auto space-y-8 pb-12 px-4 sm:px-6">
        
        {/* Premium Glass Welcome Hero Banner */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-10 text-white shadow-2xl border border-slate-800/60 group">
          {/* Abstract glowing mesh backgrounds */}
          <div className="absolute right-0 top-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-violet-600/20 blur-[100px] transition-all duration-1000 group-hover:bg-violet-500/30 group-hover:scale-110 pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 w-60 h-60 rounded-full bg-blue-500/10 blur-[80px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                <Shield size={14} className="text-violet-400 animate-pulse" />
                <span className="text-[10px] font-black text-violet-300 uppercase tracking-widest">Enterprise Command Center</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                System Overview
              </h1>
              <p className="text-slate-400 text-sm max-w-xl font-medium">
                Welcome back, <span className="text-white font-bold">{user.name}</span>. The system is operating normally with all services online. Here is your operational intelligence for today.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="px-5 py-3.5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Server Status</div>
                  <div className="text-xs font-extrabold text-slate-200">100% Operational</div>
                </div>
              </div>
              
              <div className="px-5 py-3.5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex items-center gap-3">
                <Activity size={16} className="text-blue-400" />
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Sync Latency</div>
                  <div className="text-xs font-extrabold text-slate-200">12ms (Optimal)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stunning Glow-Effect Stats Grid */}
        <motion.div {...anim(0)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Total Platform Users", value: s.totalUsers || 0, icon: Users, color: "from-blue-500 to-indigo-600", text: "text-blue-500", glow: "rgba(59, 130, 246, 0.15)", cta: "Manage Users", path: "/users" },
            { label: "Active Evaluation Forms", value: s.activeForms || 0, icon: FileText, color: "from-emerald-400 to-teal-600", text: "text-emerald-500", glow: "rgba(16, 185, 129, 0.15)", cta: "Configure Forms", path: "/forms" },
            { label: "Submissions Received", value: s.totalSubmissions || 0, icon: Inbox, color: "from-violet-500 to-purple-700", text: "text-violet-500", glow: "rgba(139, 92, 246, 0.15)", cta: "Browse Records", path: "/submissions" },
            { label: "Pending Evaluations", value: s.pendingReviews || 0, icon: CheckSquare, color: "from-amber-400 to-orange-500", text: "text-amber-500", glow: "rgba(245, 158, 11, 0.15)", cta: "Process Reviews", path: "/reviews" }
          ].map((card, i) => (
            <div 
              key={card.label} 
              onClick={() => navigate(card.path)}
              style={{ boxShadow: `0 20px 40px -15px ${card.glow}` }}
              className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:border-slate-300 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group relative overflow-hidden"
            >
              {/* Internal abstract decoration */}
              <div className="absolute right-0 bottom-0 w-24 h-24 bg-slate-50 rounded-full blur-xl group-hover:bg-slate-100 transition-colors pointer-events-none" />
              
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <card.icon size={22} />
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 group-hover:bg-slate-100 px-3 py-1.5 rounded-full transition-colors">
                  {card.cta}
                  <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{card.label}</div>
                <div className="text-3xl font-black text-slate-900 tracking-tight mt-1.5">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Main Dashboard Panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Visual Analytics & Recent Events (col-span-8) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Custom Premium Activity Chart */}
            <motion.div {...anim(1)} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-violet-600 uppercase tracking-widest">Analytics Dashboard</div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><TrendingUp size={16} /></div>
                    Submission Frequency & Volatility
                  </h3>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <Calendar size={12} className="text-slate-400" />
                  Temporal Analysis: Last 10 Days
                </div>
              </div>

              {timeline.length === 0 ? (
                <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
                  <Inbox size={44} className="opacity-20 mx-auto mb-3 text-slate-400" />
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Waiting for system records...</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-end gap-3 h-52 px-2 relative">
                    {/* Horizontal helper grid lines */}
                    <div className="absolute inset-x-0 top-0 border-t border-slate-50 pointer-events-none" />
                    <div className="absolute inset-x-0 top-1/3 border-t border-slate-50 pointer-events-none" />
                    <div className="absolute inset-x-0 top-2/3 border-t border-slate-50 pointer-events-none" />
                    
                    {timeline.map(([date, count], i) => (
                      <div key={date} className="flex-1 group relative flex flex-col items-center gap-3 h-full justify-end z-10">
                        {/* Hover Tooltip card */}
                        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-200 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-xl pointer-events-none z-20 shadow-xl flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                          <span className="font-extrabold">{count as number} Submissions</span>
                        </div>
                        
                        {/* Beautiful gradient bar */}
                        <motion.div 
                          initial={{ height: 0 }} 
                          animate={{ height: `${((count as number) / maxTimeline) * 85}%` }}
                          transition={{ delay: 0.2 + i * 0.03, duration: 0.8, ease: "circOut" }}
                          className="w-full bg-gradient-to-t from-violet-600 via-indigo-600 to-indigo-500 rounded-xl min-h-[10px] group-hover:from-violet-500 group-hover:to-blue-400 group-hover:shadow-lg group-hover:shadow-indigo-500/25 transition-all duration-300"
                        />
                        
                        <span className="text-[9px] font-black text-slate-400 group-hover:text-indigo-600 transition-colors uppercase mt-1">
                          {date.split('-').slice(1).join('/')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Quick Actions Shortcuts Board */}
            <motion.div {...anim(1.5)} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Administrative Utilities</div>
              <h3 className="text-base font-black text-slate-900 mb-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Settings size={16} /></div>
                System Operational Controls
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: "Form Generator", desc: "Design new custom forms", icon: FileText, bg: "bg-blue-50 text-blue-600", path: "/forms" },
                  { title: "Review Pipeline", desc: "Configure stages & groups", icon: Target, bg: "bg-purple-50 text-purple-600", path: "/reviews" },
                  { title: "Security Matrix", desc: "Manage system operators", icon: Shield, bg: "bg-amber-50 text-amber-600", path: "/users" }
                ].map((act) => (
                  <div 
                    key={act.title}
                    onClick={() => navigate(act.path)}
                    className="p-5 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer transition-all duration-200 group flex flex-col justify-between min-h-[120px]"
                  >
                    <div className={`w-9 h-9 rounded-xl ${act.bg} flex items-center justify-center`}>
                      <act.icon size={16} />
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-black text-slate-800 flex items-center gap-1">
                        {act.title}
                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all text-slate-500" />
                      </div>
                      <div className="text-[10px] font-medium text-slate-400 mt-1">{act.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Premium Recent Activity list */}
            <motion.div {...anim(2)} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Real-time Stream</div>
                  <h3 className="font-black text-slate-900 flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Activity size={16} /></div>
                    Recent Submissions
                  </h3>
                </div>
                <button 
                  onClick={() => navigate('/submissions')} 
                  className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-all active:scale-95 self-start sm:self-center"
                >
                  Submission Ledger <ChevronRight size={10} />
                </button>
              </div>
              
              <div className="divide-y divide-slate-50">
                {recentSubs.length === 0 ? (
                  <div className="p-16 text-center text-slate-400">
                    <Inbox size={44} className="mx-auto opacity-20 mb-4" />
                    <p className="text-xs font-bold uppercase tracking-wider">No submissions in queue</p>
                  </div>
                ) : recentSubs.map((sub, i) => (
                  <div 
                    key={subId(sub)} 
                    onClick={() => { if (canOpenSubmission(sub)) navigate(`/forms/view?submission=${subId(sub)}`); }} 
                    className="w-full text-left px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-slate-50/50 cursor-pointer group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 text-slate-600 group-hover:from-indigo-600 group-hover:to-indigo-500 group-hover:text-white flex items-center justify-center text-sm font-black transition-all duration-300 border border-slate-100/50 shrink-0">
                        {displaySubmissionNameFirstChar(sub)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                          {sub.form_title || 'Untitled Form submission'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-slate-400 tracking-wider">Nominee:</span>
                          <span className="text-[10px] text-slate-600 font-extrabold truncate">
                            {displaySubmissionName(sub)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 self-stretch sm:self-center">
                      <div className="text-left sm:text-right">
                        <StatusBadge 
                          status={
                            ['submitted', 'under_review', 'approved', 'rejected', 'next_level', 'completed'].includes(sub.status) 
                            ? 'submitted' 
                            : 'pending'
                          } 
                          size="xs" 
                        />
                        <p className="text-[9px] text-slate-400 font-bold mt-1.5 uppercase tracking-tighter">
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Today'}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>

          {/* Right Column: Platform Diagnostics & Conversion Status (col-span-4) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Highly Refined Performance Statistics Card */}
            <motion.div {...anim(3)} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-slate-50 rounded-full blur-3xl group-hover:bg-indigo-50/20 transition-all pointer-events-none" />
              
              <div className="flex items-center justify-between mb-8 relative">
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Platform Status</div>
                  <h3 className="font-black text-slate-900 flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Target size={16} /></div>
                    Conversion Funnel
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600">
                  {s.totalSubmissions || 0}
                </div>
              </div>

              <div className="space-y-6 relative">
                {[
                  { label: 'Pending Assessment', value: s.submissionsByStatus?.submitted || 0, color: 'from-blue-500 to-indigo-500', icon: Inbox, bg: 'bg-blue-50', text: 'text-blue-600' },
                  { label: 'Under Review', value: s.submissionsByStatus?.under_review || 0, color: 'from-indigo-500 to-purple-500', icon: Clock, bg: 'bg-indigo-50', text: 'text-indigo-600' },
                  { label: 'Approved Records', value: s.submissionsByStatus?.approved || 0, color: 'from-emerald-400 to-emerald-500', icon: CheckSquare, bg: 'bg-emerald-50', text: 'text-emerald-600' },
                  { label: 'Declined Submissions', value: s.submissionsByStatus?.rejected || 0, color: 'from-rose-400 to-rose-500', icon: AlertTriangle, bg: 'bg-rose-50', text: 'text-rose-600' }
                ].map((st, i) => { 
                  const total = Math.max(s.totalSubmissions || 1, 1); 
                  const pct = (st.value / total) * 100;
                  return (
                    <div key={st.label}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-xl ${st.bg} ${st.text} flex items-center justify-center shadow-sm`}><st.icon size={13} /></div>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{st.label}</span>
                        </div>
                        <span className="text-xs font-black text-slate-900">{st.value}</span>
                      </div>
                      
                      <div className="h-2 bg-slate-50 border border-slate-100/50 rounded-full overflow-hidden p-[1.5px]">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${pct}%` }} 
                          transition={{ delay: 0.4 + (i * 0.08), duration: 1, ease: "circOut" }} 
                          className={`h-full rounded-full bg-gradient-to-r ${st.color} shadow-sm`} 
                        />
                      </div>
                    </div>
                  ); 
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-black uppercase tracking-widest">
                <span>Success Index</span>
                <span className="text-emerald-500 font-black">
                  {s.totalSubmissions > 0 ? Math.round(((s.submissionsByStatus?.approved || 0) / s.totalSubmissions) * 100) : 0}% Approved
                </span>
              </div>
            </motion.div>

            {/* Premium System Information Widget */}
            <motion.div {...anim(3.5)} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Shield size={15} className="text-slate-400" />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Notice</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium mb-6">
                Your connection to the enterprise console is fully encrypted. All actions in this console are recorded in the central audit ledger for security compliance.
              </p>
              <div className="pt-4 border-t border-slate-50 flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Secure Connection Active
              </div>
            </motion.div>

          </div>

        </div>

      </div>
    );
  }

  // ─── Modern Role-Based View (For Teachers, Reviewers, etc.) ───────────────
  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Welcome back, {user.name?.split(' ')[0]}</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 rounded-lg border border-primary/10">
              <School size={12} className="text-primary" />
              <span className="text-[11px] font-black text-primary uppercase tracking-wider">{user.school_code || 'KV001'}</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              {user.role === 'functionary' ? 'Managing your school nominations' : 
               user.role === 'reviewer' ? 'Evaluating submissions' : 'Your portal dashboard'}
            </p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em]">
          <Clock size={12} /> {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      <motion.div {...anim(0)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {user.role === 'reviewer' && <>
          <StatCard label="Pending Reviews" value={s.pendingReviews || 0} icon={CheckSquare} color="amber" onClick={() => navigate('/reviews')} ctaText="Start Now" />
          <StatCard label="Completed" value={s.completedReviews || 0} icon={CheckCircle2} color="green" />
          <StatCard label="Average Score" value={s.avgScore || 0} icon={TrendingUp} color="blue" />
          <StatCard label="Assigned Total" value={s.totalSubmissions || 0} icon={Inbox} color="purple" />
        </>}
        {user.role === 'functionary' && <>
          <StatCard label="Active Forms" value={s.activeForms || 0} icon={FileText} color="blue" onClick={() => navigate('/forms')} />
          <StatCard label="Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="purple" onClick={() => navigate('/submissions')} />
          <StatCard label="Nominations" value={s.totalNominations || 0} icon={UserPlus} color="green" subtitle={`${s.nominationsByStatus?.completed || 0} done`} onClick={() => navigate('/nominations')} />
          <StatCard label="School Reach" value={`${s.completionRate || 0}%`} icon={TrendingUp} color="purple" />
        </>}
        {user.role === 'teacher' && <>
          <StatCard label="Open Forms" value={s.activeForms || 0} icon={FileText} color="blue" onClick={() => navigate('/forms')} />
          <StatCard label="My Entries" value={s.totalSubmissions || 0} icon={Inbox} color="green" onClick={() => navigate('/submissions')} />
        </>}
      </motion.div>

      <div className={`grid grid-cols-1 ${(user.role as string) === 'admin' || user.role === 'reviewer' || user.role === 'functionary' ? 'lg:grid-cols-12' : ''} gap-8`}>
        <div className={(user.role as string) === 'admin' || user.role === 'reviewer' || user.role === 'functionary' ? 'lg:col-span-8 space-y-8' : 'space-y-8'}>
          {/* Enhanced Progress for Reviewers */}
          {user.role === 'reviewer' && (
            <motion.div {...anim(1)} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl" />
              <h3 className="font-black text-slate-800 text-sm mb-6 flex items-center gap-3 relative">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Target size={18} /></div>
                Overall Progress
              </h3>
              <div className="space-y-6 relative">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Completion</p>
                    <p className="text-3xl font-black text-slate-900">
                      {s.pendingReviews + s.completedReviews > 0 ? Math.round((s.completedReviews / (s.pendingReviews + s.completedReviews)) * 100) : 0}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                    <p className="text-sm font-bold text-emerald-500">On Track</p>
                  </div>
                </div>
                <div className="h-3 bg-slate-50 rounded-full overflow-hidden p-0.5 border border-slate-100 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${(s.completedReviews / Math.max(s.pendingReviews + s.completedReviews, 1)) * 100}%` }} 
                    className="h-full bg-gradient-to-r from-primary to-accent-blue rounded-full shadow-sm"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Modern Activity List */}
          <motion.div {...anim(2)} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-800 flex items-center gap-3 text-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Activity size={18} /></div>
                {user.role === 'teacher' ? 'My Recent Entries' : 'Recent Updates'}
              </h3>
              <button onClick={() => navigate('/submissions')} className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors">View All</button>
            </div>
            <div className="divide-y divide-slate-50">
              {recentSubs.length === 0 ? (
                <div className="p-16 text-center text-slate-300">
                  <Inbox size={40} className="mx-auto opacity-10 mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">No activity found</p>
                </div>
              ) : recentSubs.map((sub, i) => (
                <div key={subId(sub)} onClick={() => { if (canOpenSubmission(sub)) navigate(`/forms/view?submission=${subId(sub)}`); }} className="w-full text-left px-8 py-5 flex items-center gap-5 transition-all hover:bg-slate-50 cursor-pointer group">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-sm font-black transition-all border border-slate-100">
                    {displaySubmissionNameFirstChar(sub)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{sub.form_title || 'Entry Detail'}</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-wider">{displaySubmissionName(sub)}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1.5">
                    <StatusBadge 
                      status={
                        (['teacher', 'functionary'].includes(user.role) && 
                         ['submitted', 'under_review', 'approved', 'rejected', 'next_level', 'completed'].includes(sub.status)) 
                        ? 'submitted' 
                        : (user.role === 'admin' ? sub.status : (['submitted', 'under_review', 'approved', 'rejected', 'next_level', 'completed'].includes(sub.status) ? 'submitted' : 'pending'))
                      } 
                      size="xs" 
                    />
                    <p className="text-[9px] text-slate-300 font-black uppercase tracking-tighter">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Active'}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-200 group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-1" />
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Platform Updates & CTA */}
        {((user.role as string) === 'admin' || user.role === 'reviewer' || user.role === 'functionary') && (
          <div className="lg:col-span-4 space-y-8">
            <motion.div {...anim(3)} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-all" />
              <div className="relative z-10">
                <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                  <Award size={22} className="text-primary" />
                </div>
                <h3 className="text-xl font-black mb-3 leading-tight">Ready to start?</h3>
                <p className="text-white/60 text-xs font-medium leading-relaxed mb-8">
                  {user.role === 'reviewer' ? `You have ${s.pendingReviews || 0} submissions to evaluate. Your feedback helps teachers grow.` : 
                   user.role === 'functionary' ? 'Manage your school nominations and ensure all teachers complete their forms on time.' :
                   'Complete your pending forms to submit your profile for review.'}
                </p>
                <button 
                  onClick={() => navigate(user.role === 'reviewer' ? '/reviews' : user.role === 'functionary' ? '/nominations' : '/forms')}
                  className="w-full bg-white text-slate-900 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-primary hover:text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  Launch Dashboard <ArrowUpRight size={14} />
                </button>
              </div>
            </motion.div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  <Shield size={16} className="text-slate-400" />
                </div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Portal Notice</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium mb-4">
                Your session is secured with end-to-end encryption. For any technical support, please contact the district coordinator.
              </p>
              <div className="pt-4 border-t border-slate-50 flex items-center gap-3 text-[10px] font-black text-primary uppercase tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> System Online
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
