import React, { useState, useEffect } from 'react';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, FileText, Inbox, CheckSquare, BarChart3, Clock, TrendingUp, 
  Activity, Award, UserPlus, Calendar, Target, AlertTriangle, Shield
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

  // ─── Admin Minimal View ───────────────────────────────────────────────────
  if (user.role === 'admin') {
    return (
      <div className="max-w-[1400px] mx-auto space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Hello, {user.name?.split(' ')[0]}. Here is what's happening today.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Live System Status</span>
          </div>
        </div>

        <motion.div {...anim(0)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard label="Total Users" value={s.totalUsers || 0} icon={Users} color="blue" onClick={() => navigate('/users')} />
          <StatCard label="Active Forms" value={s.activeForms || 0} icon={FileText} color="green" onClick={() => navigate('/forms')} />
          <StatCard label="Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="purple" onClick={() => navigate('/submissions')} />
          <StatCard label="Pending Reviews" value={s.pendingReviews || 0} icon={CheckSquare} color="amber" onClick={() => navigate('/reviews')} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <motion.div {...anim(1)} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Calendar size={18} /></div>
                  Submission Activity
                </h3>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-full">Last 10 Days</div>
              </div>
              {timeline.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
                  <TrendingUp size={40} className="opacity-10 mx-auto mb-3" />
                  <p className="text-xs font-bold">Waiting for new submissions...</p>
                </div>
              ) : (
                <div className="flex items-end gap-3 h-48 px-2">
                  {timeline.map(([date, count], i) => (
                    <div key={date} className="flex-1 group relative flex flex-col items-center gap-3">
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded-xl pointer-events-none z-10 shadow-xl">
                        {count as number} Entries
                      </div>
                      <motion.div 
                        initial={{ height: 0 }} 
                        animate={{ height: `${((count as number) / maxTimeline) * 100}%` }}
                        transition={{ delay: 0.3 + i * 0.03, duration: 0.8, ease: "circOut" }}
                        className="w-full bg-gradient-to-t from-primary to-accent-blue rounded-xl min-h-[8px] group-hover:shadow-lg group-hover:shadow-primary/20 transition-all"
                      />
                      <span className="text-[9px] font-black text-slate-400 group-hover:text-primary transition-colors">{date.split('-').slice(1).join('/')}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div {...anim(2)} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-800 flex items-center gap-3 text-sm">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Activity size={18} /></div>
                  Recent Activity
                </h3>
                <button onClick={() => navigate('/submissions')} className="text-[11px] font-black text-primary hover:text-primary-hover uppercase tracking-widest bg-primary/5 px-4 py-2 rounded-xl transition-colors">View Archive</button>
              </div>
              <div className="divide-y divide-slate-50">
                {recentSubs.length === 0 ? (
                  <div className="p-16 text-center text-slate-400">
                    <Inbox size={40} className="mx-auto opacity-10 mb-4" />
                    <p className="text-xs font-bold">No submissions yet.</p>
                  </div>
                ) : recentSubs.map((sub, i) => (
                  <div key={subId(sub)} onClick={() => { if (canOpenSubmission(sub)) navigate(`/forms/view?submission=${subId(sub)}`); }} className="w-full text-left px-8 py-4 flex items-center gap-4 transition-all hover:bg-slate-50/80 cursor-pointer group">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-xs font-black transition-colors">
                      {displaySubmissionNameFirstChar(sub)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{sub.form_title || 'New Entry'}</p>
                      <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{displaySubmissionName(sub)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={sub.status} size="xs" />
                      <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Today'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <motion.div {...anim(3)} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-slate-50 rounded-full blur-3xl group-hover:bg-primary/5 transition-colors" />
              <div className="flex items-center justify-between mb-8 relative">
                <h3 className="font-black text-slate-800 flex items-center gap-3 text-sm">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Target size={18} /></div>
                  Overall Status
                </h3>
                <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600">{s.totalSubmissions || 0}</div>
              </div>
              <div className="space-y-6 relative">
                {[
                  { label: 'Pending', value: s.submissionsByStatus?.submitted || 0, color: 'from-blue-400 to-blue-500', icon: Inbox, bg: 'bg-blue-50', text: 'text-blue-600' },
                  { label: 'Reviewing', value: s.submissionsByStatus?.under_review || 0, color: 'from-indigo-400 to-indigo-500', icon: Clock, bg: 'bg-indigo-50', text: 'text-indigo-600' },
                  { label: 'Approved', value: s.submissionsByStatus?.approved || 0, color: 'from-emerald-400 to-emerald-500', icon: CheckSquare, bg: 'bg-emerald-50', text: 'text-emerald-600' },
                  { label: 'Rejected', value: s.submissionsByStatus?.rejected || 0, color: 'from-rose-400 to-rose-500', icon: AlertTriangle, bg: 'bg-rose-50', text: 'text-rose-600' }
                ].map((st, i) => { 
                  const total = Math.max(s.totalSubmissions || 1, 1); 
                  const pct = (st.value / total) * 100;
                  return (
                    <div key={st.label}>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-xl ${st.bg} ${st.text} flex items-center justify-center shadow-sm`}><st.icon size={14} /></div>
                          <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">{st.label}</span>
                        </div>
                        <span className="text-[12px] font-black text-slate-900">{st.value}</span>
                      </div>
                      <div className="h-2 bg-slate-50 rounded-full overflow-hidden p-0.5">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.5 + (i * 0.1), duration: 1, ease: "circOut" }} className={`h-full rounded-full bg-gradient-to-r ${st.color} shadow-sm relative`} />
                      </div>
                    </div>
                  ); 
                })}
              </div>
              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-black uppercase tracking-widest">
                <span>Conversion</span>
                <span className="text-emerald-500">{s.totalSubmissions > 0 ? Math.round(((s.submissionsByStatus?.approved || 0) / s.totalSubmissions) * 100) : 0}% Success</span>
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
                    <StatusBadge status={sub.status} size="xs" />
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
