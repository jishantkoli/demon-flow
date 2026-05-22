import React, { useState, useEffect } from 'react';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, FileText, Inbox, CheckSquare, BarChart3, Clock, TrendingUp, 
  Activity, Award, UserPlus, Calendar, Target, AlertTriangle, Shield,
  ArrowUpRight, Search, Bell, Plus, ChevronRight, LayoutGrid
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
      setRecentSubs(Array.isArray(subs) ? subs.slice(0, 8) : []);
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

  // ─── Admin Minimal View ───────────────────────────────────────────────────
  if (user.role === 'admin') {
    return (
      <div className="max-w-[1440px] mx-auto space-y-8 pb-12 px-4 sm:px-6">
        {/* Modern Glass Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-[0.2em]">
              <div className="w-4 h-[2px] bg-primary" /> System Overview
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight font-heading">
              Welcome, {user.name?.split(' ')[0]} <span className="text-primary animate-pulse">.</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm">Monitor system performance and teacher nominations in real-time.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-primary/30 transition-all">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Live Cloud Sync</span>
            </div>
            <button 
              onClick={() => navigate('/forms/create')}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              <Plus size={16} /> Create Form
            </button>
          </div>
        </div>

        {/* Enhanced Stat Grid */}
        <motion.div {...anim(0)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Platform Users" value={s.totalUsers || 0} icon={Users} color="blue" onClick={() => navigate('/users')} trend="+4 today" />
          <StatCard label="Total Forms" value={s.activeForms || 0} icon={FileText} color="green" onClick={() => navigate('/forms')} subtitle={`${s.draftForms || 0} drafts`} />
          <StatCard label="Entries Recieved" value={s.totalSubmissions || 0} icon={Inbox} color="purple" onClick={() => navigate('/submissions')} trend="+12% growth" />
          <StatCard label="Review Pipeline" value={s.pendingReviews || 0} icon={CheckSquare} color="amber" onClick={() => navigate('/reviews')} subtitle={`${s.completedReviews || 0} finalized`} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Activity Area */}
          <div className="lg:col-span-8 space-y-8">
            {/* Visual Analytics Card */}
            <motion.div {...anim(1)} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl shadow-slate-100/50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 group-hover:bg-primary/5 transition-colors" />
              
              <div className="flex items-center justify-between mb-10 relative">
                <div className="space-y-1">
                  <h3 className="font-black text-slate-900 flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner"><Calendar size={20} /></div>
                    Submission Activity
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest ml-13">Trends for last 10 days</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100" />)}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">+8 Active</span>
                </div>
              </div>
              
              {timeline.length === 0 ? (
                <div className="py-16 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/30">
                  <BarChart3 size={48} className="opacity-10 mx-auto mb-4" />
                  <p className="text-sm font-bold tracking-tight text-slate-400">Waiting for system traffic data...</p>
                </div>
              ) : (
                <div className="flex items-end gap-3 h-56 px-4 relative">
                  {/* Grid Lines */}
                  <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
                    {[0,1,2,3,4].map(i => <div key={i} className="w-full h-px bg-slate-900" />)}
                  </div>
                  
                  {timeline.map(([date, count], i) => (
                    <div key={date} className="flex-1 group/bar relative flex flex-col items-center gap-4 z-10">
                      <div className="absolute -top-12 opacity-0 group-hover/bar:opacity-100 transition-all bg-slate-900 text-white text-[10px] px-3 py-2 rounded-xl pointer-events-none shadow-2xl scale-90 group-hover/bar:scale-100">
                        {count as number} Submissions
                      </div>
                      <motion.div 
                        initial={{ height: 0 }} 
                        animate={{ height: `${((count as number) / maxTimeline) * 100}%` }}
                        transition={{ delay: 0.3 + i * 0.03, duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
                        className="w-full bg-gradient-to-t from-primary/80 to-primary rounded-2xl min-h-[10px] group-hover/bar:from-primary group-hover/bar:to-accent-blue transition-all shadow-sm hover:shadow-lg hover:shadow-primary/30"
                      />
                      <span className="text-[10px] font-black text-slate-400 group-hover/bar:text-primary transition-colors tracking-tighter">
                        {date.split('-')[2]} {new Date(date).toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Modern Activity Feed */}
            <motion.div {...anim(2)} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100/50 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white">
                <div className="space-y-1">
                  <h3 className="font-black text-slate-900 flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner"><Activity size={20} /></div>
                    Recent Feed
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest ml-13">Latest entries across all forms</p>
                </div>
                <button 
                  onClick={() => navigate('/submissions')} 
                  className="group flex items-center gap-2 text-[11px] font-black text-slate-500 hover:text-primary uppercase tracking-widest bg-slate-50 px-5 py-2.5 rounded-2xl transition-all"
                >
                  View All Entries <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
              
              <div className="divide-y divide-slate-50 px-4">
                {recentSubs.length === 0 ? (
                  <div className="p-20 text-center">
                    <Inbox size={48} className="mx-auto opacity-5 mb-4 text-slate-900" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No activity found</p>
                  </div>
                ) : recentSubs.map((sub, i) => (
                  <div
                    key={subId(sub)}
                    onClick={() => { if (canOpenSubmission(sub)) navigate(`/forms/view?submission=${subId(sub)}`); }}
                    className="w-full text-left p-6 flex items-center gap-5 transition-all hover:bg-slate-50/50 rounded-3xl cursor-pointer group my-1"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white flex items-center justify-center text-sm font-black transition-all shadow-inner group-hover:rotate-3 group-hover:scale-110">
                      {displaySubmissionNameFirstChar(sub)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-black text-slate-900 truncate group-hover:text-primary transition-colors">
                          {sub.form_title || 'Form Entry'}
                        </p>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Just now'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-slate-500 font-bold truncate tracking-tight">{displaySubmissionName(sub)}</p>
                        <ArrowUpRight size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={sub.status} size="xs" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Side Panels */}
          <div className="lg:col-span-4 space-y-8">
            {/* Redesigned Premium Status Card */}
            <motion.div {...anim(3)} className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-300/50 relative overflow-hidden group">
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/30 transition-all duration-700" />
              
              <div className="flex items-center justify-between mb-10 relative">
                <div className="space-y-1">
                  <h3 className="font-black flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 text-primary flex items-center justify-center shadow-inner"><Target size={20} /></div>
                    Submission Pulse
                  </h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest ml-13">System Conversion</p>
                </div>
              </div>

              <div className="space-y-8 relative">
                {[
                  { label: 'Pending', value: s.submissionsByStatus?.submitted || 0, color: 'bg-blue-400', icon: Inbox, bg: 'bg-blue-500/20' },
                  { label: 'Reviewing', value: s.submissionsByStatus?.under_review || 0, color: 'bg-indigo-400', icon: Clock, bg: 'bg-indigo-500/20' },
                  { label: 'Approved', value: s.submissionsByStatus?.approved || 0, color: 'bg-emerald-400', icon: CheckSquare, bg: 'bg-emerald-500/20' },
                  { label: 'Rejected', value: s.submissionsByStatus?.rejected || 0, color: 'bg-rose-400', icon: AlertTriangle, bg: 'bg-rose-500/20' }
                ].map((st, i) => { 
                  const total = Math.max(s.totalSubmissions || 1, 1); 
                  const pct = (st.value / total) * 100;
                  return (
                    <div key={st.label} className="group/item">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl ${st.bg} flex items-center justify-center text-white/90 shadow-sm border border-white/5`}><st.icon size={16} /></div>
                          <span className="text-[11px] font-black uppercase tracking-widest text-white/60 group-hover/item:text-white transition-colors">{st.label}</span>
                        </div>
                        <span className="text-sm font-black text-white">{st.value}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden p-0">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${pct}%` }} 
                          transition={{ delay: 0.5 + (i * 0.1), duration: 1.2, ease: [0.16, 1, 0.3, 1] }} 
                          className={`h-full rounded-full ${st.color} shadow-[0_0_10px_rgba(255,255,255,0.1)]`} 
                        />
                      </div>
                    </div>
                  ); 
                })}
              </div>

              <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Efficiency</p>
                  <p className="text-xl font-black text-emerald-400">
                    {s.totalSubmissions > 0 ? Math.round(((s.submissionsByStatus?.approved || 0) / s.totalSubmissions) * 100) : 0}% <span className="text-[10px] text-white/60 font-bold ml-1 tracking-normal">Approval</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-xs font-black text-white/30">
                  {s.totalSubmissions}
                </div>
              </div>
            </motion.div>

            {/* Quick Actions Panel */}
            <motion.div {...anim(4)} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
              <h3 className="font-black text-slate-900 text-sm mb-6 flex items-center gap-2 uppercase tracking-widest">
                <LayoutGrid size={16} className="text-primary" /> Shortcuts
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Add User', icon: UserPlus, path: '/users', color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Form List', icon: FileText, path: '/forms', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Reviews', icon: CheckSquare, path: '/reviews', color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Settings', icon: Shield, path: '/profile', color: 'text-slate-600', bg: 'bg-slate-50' }
                ].map(action => (
                  <button 
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className="flex flex-col items-center gap-3 p-5 rounded-3xl border border-slate-100 hover:border-primary/30 hover:shadow-md transition-all group"
                  >
                    <div className={`w-12 h-12 rounded-2xl ${action.bg} ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <action.icon size={20} />
                    </div>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{action.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Classic Role-Based View (For Teachers, Reviewers, etc.) ───────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Welcome back, {user.name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user.role === 'functionary' ? `Managing nominations for school ${user.school_code || ''}` : 
           user.role === 'form_creator' ? 'Form management and creation' : 'Your portal overview'}
        </p>
        <p className="text-[11px] text-slate-400 mt-1">Tip: Click on dashboard cards or list items to navigate directly to detail pages.</p>
      </div>

      <motion.div {...anim(0)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {user.role === 'reviewer' && <>
          <StatCard label="Pending Reviews" value={s.pendingReviews || 0} icon={CheckSquare} color="amber" onClick={() => navigate('/reviews')} ctaText="Start review" />
          <StatCard label="Completed" value={s.completedReviews || 0} icon={TrendingUp} color="green" onClick={() => navigate('/reviews')} />
          <StatCard label="Avg Score Given" value={s.avgScore || 0} icon={BarChart3} color="blue" subtitle="Overall" />
          <StatCard label="Assigned Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="purple" onClick={() => navigate('/submissions')} />
        </>}
        {user.role === 'functionary' && <>
          <StatCard label="Active Forms" value={s.activeForms || 0} icon={FileText} color="blue" onClick={() => navigate('/forms')} />
          <StatCard label="Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="purple" onClick={() => navigate('/submissions')} />
          <StatCard label="Nominations" value={s.totalNominations || 0} icon={UserPlus} color="green" subtitle={`${s.nominationsByStatus?.completed || 0} done`} onClick={() => navigate('/nominations')} />
          <StatCard label="Completion Rate" value={`${s.completionRate || 0}%`} icon={TrendingUp} color="purple" />
        </>}
        {user.role === 'teacher' && <>
          <StatCard label="Available Forms" value={s.activeForms || 0} icon={FileText} color="blue" onClick={() => navigate('/forms')} />
          <StatCard label="My Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="green" onClick={() => navigate('/submissions')} />
          <StatCard label="Approved" value={s.submissionsByStatus?.approved || 0} icon={CheckSquare} color="purple" />
          <StatCard label="Under Review" value={s.submissionsByStatus?.under_review || 0} icon={Clock} color="amber" />
        </>}
        {user.role === 'form_creator' && <>
          <StatCard label="Active Forms" value={s.activeForms || 0} icon={FileText} color="green" onClick={() => navigate('/forms')} />
          <StatCard label="Total Entries" value={s.totalSubmissions || 0} icon={Inbox} color="purple" />
        </>}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Reviewer Progress */}
          {user.role === 'reviewer' && (
            <motion.div {...anim(1)} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-semibold font-heading text-sm mb-4 flex items-center gap-2"><Award size={18} className="text-primary" /> Review Progress</h3>
              <div className="space-y-4">
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-500 font-bold uppercase">Completion</span><span className="font-bold text-primary">{s.pendingReviews + s.completedReviews > 0 ? Math.round((s.completedReviews / (s.pendingReviews + s.completedReviews)) * 100) : 0}%</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${(s.completedReviews / (Math.max(s.pendingReviews + s.completedReviews, 1))) * 100}%` }} className="h-full bg-primary" /></div>
              </div>
            </motion.div>
          )}

          {/* Recent Submissions for non-admins */}
          <motion.div {...anim(2)} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface/50">
              <h3 className="font-bold text-sm flex items-center gap-2"><Activity size={16} className="text-primary" /> {user.role === 'teacher' ? 'My Recent Submissions' : 'Recent Submissions'}</h3>
              <button onClick={() => navigate('/submissions')} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider">View All</button>
            </div>
            <div className="divide-y divide-border">
              {recentSubs.length === 0 ? (
                <div className="p-10 text-center text-muted"><Inbox size={32} className="mx-auto opacity-20 mb-2" /><p className="text-xs">No recent submissions found</p></div>
              ) : recentSubs.map((sub, i) => (
                <div key={subId(sub)} onClick={() => { if (canOpenSubmission(sub)) navigate(`/forms/view?submission=${subId(sub)}`); }} className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${canOpenSubmission(sub) ? 'hover:bg-slate-50 cursor-pointer' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{displaySubmissionNameFirstChar(sub)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{sub.form_title || 'Form Entry'}</p>
                    <p className="text-[10px] text-muted truncate">{displaySubmissionName(sub)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge 
                      status={
                        (['teacher', 'functionary'].includes(user.role) && 
                         ['submitted', 'under_review', 'approved', 'rejected', 'next_level', 'completed'].includes(sub.status)) 
                        ? 'submitted' 
                        : sub.status
                      } 
                      size="xs" 
                    />
                    <p className="text-[9px] text-muted mt-0.5">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Today'}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-primary/5 rounded-2xl border border-primary/10 p-6">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4"><Award size={20} /></div>
            <h3 className="font-bold text-sm mb-2">Portal Notice</h3>
            <p className="text-xs text-slate-600 leading-relaxed">Welcome to the school management portal. Use the sidebar to navigate through your assigned tasks and forms.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
