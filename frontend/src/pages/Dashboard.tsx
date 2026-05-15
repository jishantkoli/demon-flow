import React, { useState, useEffect } from 'react';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Inbox, CheckSquare, BarChart3, Clock, TrendingUp, AlertTriangle, Activity, Award, UserPlus, Layers } from 'lucide-react';

export default function Dashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, subs] = await Promise.all([
          api.get('/stats').catch(() => ({})),
          api.get('/submissions').catch(() => [])
        ]);
        setStats(s || {});
        setRecentSubs(Array.isArray(subs) ? subs.slice(0, 6) : []);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setStats({});
        setRecentSubs([]);
      }
    };

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

    Promise.all([fetchData(), fetchLogs()]).finally(() => setLoading(false));
  }, [user?.role]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>;
  const s = stats || {};
  const anim = (i: number) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05, duration: 0.4 } });
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
    const possible = responses.full_name || responses.name || responses.teacher_name;
    const text = String(possible || '').trim();
    if (text) return text;
    return sub?.user_email || 'Anonymous';
  };
  const displaySubmissionNameFirstChar = (sub: any) => {
    const name = displaySubmissionName(sub);
    return name.charAt(0).toUpperCase();
  };
  const displaySubmissionMeta = (sub: any) => {
    const email = String(sub?.user_email || '').trim();
    if (email) return email;
    const responses = parseResponses(sub?.responses);
    const schoolCode = responses.school_code || responses.schoolCode;
    if (schoolCode) return `School: ${schoolCode}`;
    return 'No contact info';
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold font-heading">Welcome back, {user.name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500 mt-1">{user.role === 'admin' ? 'System overview and real-time analytics' : user.role === 'functionary' ? `Managing nominations for school ${user.school_code || ''}` : 'Your portal overview'}</p>
        <p className="text-[11px] text-slate-400 mt-1">Tip: Click on dashboard cards or list items to navigate directly to detail pages.</p>
      </div>

      <motion.div {...anim(0)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {user.role === 'admin' && <>
          <StatCard label="Total Users" value={s.totalUsers || 0} icon={Users} color="blue" trend="+12% this month" trendUp onClick={() => navigate('/users')} ctaText="Open user management" />
          <StatCard label="Active Forms" value={s.activeForms || 0} icon={FileText} color="green" subtitle={`${s.draftForms || 0} drafts, ${s.expiredForms || 0} expired`} onClick={() => navigate('/forms')} ctaText="Open forms list" />
          <StatCard label="Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="purple" trend="+8% this week" trendUp onClick={() => navigate('/submissions')} ctaText="Open submissions" />
          <StatCard label="Pending Reviews" value={s.pendingReviews || 0} icon={CheckSquare} color="amber" subtitle={`${s.completedReviews || 0} completed`} onClick={() => navigate('/reviews')} ctaText="Open review queue" />
        </>}
        {user.role === 'reviewer' && <>
          <StatCard label="Pending Reviews" value={s.pendingReviews || 0} icon={CheckSquare} color="amber" onClick={() => navigate('/reviews')} ctaText="Open my pending reviews" />
          <StatCard label="Completed" value={s.completedReviews || 0} icon={TrendingUp} color="green" onClick={() => navigate('/reviews')} ctaText="Open completed reviews" />
          <StatCard label="Avg Score Given" value={s.avgScore || 0} icon={BarChart3} color="blue" subtitle="Across all reviews" onClick={() => navigate('/reviews')} ctaText="Open review insights" />
          <StatCard label="Assigned Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="purple" onClick={() => navigate('/submissions')} ctaText="Open submissions" />
        </>}
        {user.role === 'functionary' && <>
          <StatCard label="Active Forms" value={s.activeForms || 0} icon={FileText} color="blue" onClick={() => navigate('/forms')} ctaText="Open forms" />
          <StatCard label="Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="purple" onClick={() => navigate('/submissions')} ctaText="Open submissions" />
          <StatCard label="Nominations" value={s.totalNominations || 0} icon={UserPlus} color="green" subtitle={`${s.nominationsByStatus?.completed || 0} completed`} onClick={() => navigate('/nominations')} ctaText="Open nominations" />
          <StatCard label="Completion Rate" value={`${s.completionRate || 0}%`} icon={TrendingUp} color="purple" onClick={() => navigate('/nominations')} ctaText="View nomination progress" />
        </>}
        {user.role === 'teacher' && <>
          <StatCard label="Available Forms" value={s.activeForms || 0} icon={FileText} color="blue" onClick={() => navigate('/forms')} ctaText="Open forms" />
          <StatCard label="My Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="green" onClick={() => navigate('/submissions')} ctaText="Open my submissions" />
          <StatCard label="Approved" value={s.submissionsByStatus?.approved || 0} icon={CheckSquare} color="purple" onClick={() => navigate('/submissions')} ctaText="Open approved entries" />
          <StatCard label="Under Review" value={s.submissionsByStatus?.under_review || 0} icon={Clock} color="amber" onClick={() => navigate('/submissions')} ctaText="Open under review entries" />
        </>}
      </motion.div>

      {user.role === 'reviewer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div {...anim(1)} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-semibold font-heading text-lg mb-4 flex items-center gap-2">
              <Award size={20} className="text-primary" /> Your Review Progress
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Overall Completion</span>
                  <span className="font-bold text-primary">
                    {s.pendingReviews + s.completedReviews > 0 
                      ? Math.round((s.completedReviews / (s.pendingReviews + s.completedReviews)) * 100) 
                      : 0}%
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${(s.completedReviews / (Math.max(s.pendingReviews + s.completedReviews, 1))) * 100}%` }} 
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                  <p className="text-2xl font-bold text-slate-900">{s.pendingReviews || 0}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Pending Task</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                  <p className="text-2xl font-bold text-slate-900">{s.completedReviews || 0}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Finalized</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div {...anim(2)} className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-center">
            <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-2">Ready to start?</h3>
              <p className="text-white/80 text-sm mb-6 max-w-[280px]">You have {s.pendingReviews || 0} submissions waiting for your expert evaluation. Every review helps us find the best talent.</p>
              <button 
                onClick={() => navigate('/reviews')}
                className="bg-white text-primary px-8 py-3 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors shadow-sm"
              >
                Go to Review Queue
              </button>
            </div>
            <CheckSquare className="absolute -right-6 -bottom-6 text-white/10 w-48 h-48 -rotate-12" />
          </motion.div>
        </div>
      )}

      {user.role === 'teacher' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div {...anim(1)} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-semibold font-heading text-lg mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-primary" /> Submission Progress
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">Overall Completion</span>
                    <span className="font-bold text-primary">
                      {s.activeForms > 0 
                        ? Math.round((s.totalSubmissions / Math.max(s.activeForms, 1)) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${Math.min((s.totalSubmissions / Math.max(s.activeForms, 1)) * 100, 100)}%` }} 
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                    <p className="text-2xl font-bold text-slate-900">{s.activeForms || 0}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Open Forms</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                    <p className="text-2xl font-bold text-slate-900">{s.totalSubmissions || 0}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">My Entries</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div {...anim(2)} className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-center">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-2">Ready to contribute?</h3>
                <p className="text-white/80 text-sm mb-6 max-w-[280px]">There are {s.activeForms || 0} forms available for you. Your feedback helps us improve our academic standards.</p>
                <button 
                  onClick={() => navigate('/forms')}
                  className="bg-white text-indigo-700 px-8 py-3 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors shadow-sm"
                >
                  Browse Forms
                </button>
              </div>
              <FileText className="absolute -right-6 -bottom-6 text-white/10 w-48 h-48 -rotate-12" />
            </motion.div>

            <motion.div {...anim(3)} className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-semibold font-heading text-sm flex items-center gap-2">
                  <Inbox size={16} className="text-primary" /> My Recent Submissions
                </h3>
                <button
                  className="text-[10px] text-primary font-bold hover:underline"
                  onClick={() => navigate('/submissions')}
                >
                  View all
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {recentSubs.filter(sub => sub.user_email === user.email).length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Inbox size={20} className="text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500">You haven't submitted any forms yet.</p>
                    <button onClick={() => navigate('/forms')} className="text-xs text-primary font-semibold mt-2 hover:underline">Browse available forms</button>
                  </div>
                ) : (
                  recentSubs.filter(sub => sub.user_email === user.email).slice(0, 4).map((sub, idx) => (
                    <button
                      key={subId(sub) || `teacher-sub-${idx}`}
                      className="w-full text-left px-5 py-4 flex items-center gap-4 transition-colors hover:bg-slate-50"
                      onClick={() => navigate(`/forms/view?submission=${subId(sub)}`)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary flex-shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{sub.form_title || 'Untitled Form'}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Submitted on {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full font-semibold capitalize ring-1 ring-inset px-2.5 py-0.5 text-[11px] bg-blue-50 text-blue-700 ring-blue-500/20">
                      Submitted
                    </span>
                  </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}

      {(user.role === 'admin' || user.role === 'functionary') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div {...anim(1)} className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold font-heading text-sm">Recent Submissions</h3>
              <button
                className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20"
                onClick={() => navigate('/submissions')}
              >
                View all
              </button>
            </div>
            <div className="divide-y divide-border/50">
              {recentSubs.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No submissions yet</div> : recentSubs.map((sub, idx) => (
                <button
                  key={subId(sub) || `sub-${idx}`}
                  className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${canOpenSubmission(sub) ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                  onClick={() => {
                    if (!canOpenSubmission(sub)) return;
                    navigate(`/forms/view?submission=${subId(sub)}`);
                  }}
                  disabled={!canOpenSubmission(sub)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{displaySubmissionNameFirstChar(sub)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sub.form_title || `Form #${sub.form_id}`}</p>
                    <p className="text-[11px] text-slate-600 font-medium truncate">{displaySubmissionName(sub)}</p>
                    <p className="text-[10px] text-slate-500 truncate">{displaySubmissionMeta(sub)}</p>
                  </div>
                  <StatusBadge status={sub.status} />
                  {sub.score != null && <span className="text-xs font-bold text-primary">{Number(typeof sub.score === 'object' ? sub.score?.percentage : sub.score).toFixed(2)}%</span>}
                  <span className="text-[10px] text-slate-500 hidden sm:block">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : ''}</span>
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div {...anim(2)} className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold font-heading text-sm flex items-center gap-2"><Activity size={14} className="text-accent-green" /> Login Activity</h3>
              <button
                className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20"
                onClick={() => navigate('/audit-logs')}
              >
                Open logs
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {recentLogs.length === 0 ? <p className="text-center text-sm text-slate-500 py-6">No activity yet</p> : recentLogs.map(log => (
                <div key={log.id} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div><p className="text-xs font-medium capitalize">{log.action?.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-slate-500">{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</p>
                    {log.details && (() => { 
                      try { 
                        const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details; 
                        return d.ip ? <p className="text-[9px] text-slate-500/60">IP: {d.ip}</p> : null; 
                      } catch { return null; } 
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {user.role === 'admin' && stats && (
        <motion.div {...anim(3)} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-semibold font-heading text-sm mb-4">Submission Status</h3>
            <div className="space-y-3">
              {[{ label: 'Submitted', value: s.submissionsByStatus?.submitted || 0, color: 'bg-blue-500' },
                { label: 'Under Review', value: s.submissionsByStatus?.under_review || 0, color: 'bg-indigo-500' },
                { label: 'Approved', value: s.submissionsByStatus?.approved || 0, color: 'bg-emerald-500' },
                { label: 'Rejected', value: s.submissionsByStatus?.rejected || 0, color: 'bg-red-500' }]
                .map(st => { const total = Math.max(s.totalSubmissions || 1, 1); return (
                  <div key={st.label}><div className="flex justify-between text-xs mb-1"><span className="font-medium">{st.label}</span><span className="text-slate-500">{st.value} ({Math.round(st.value / total * 100)}%)</span></div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${(st.value / total) * 100}%` }} transition={{ delay: 0.3, duration: 0.8 }} className={`h-full rounded-full ${st.color}`} /></div>
                  </div>
                ); })}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-semibold font-heading text-sm mb-4">Users by Role</h3>
            <div className="grid grid-cols-2 gap-3">
              {[{ role: 'Admin', count: s.usersByRole?.admin || 0, color: 'from-accent-blue/80 to-accent-blue', plural: 'Admins' },
                { role: 'Reviewer', count: s.usersByRole?.reviewer || 0, color: 'from-accent-purple/80 to-accent-purple', plural: 'Reviewers' },
                { role: 'Functionary', count: s.usersByRole?.functionary || 0, color: 'from-success/80 to-success', plural: 'Functionaries' },
                { role: 'Teacher', count: s.usersByRole?.teacher || 0, color: 'from-accent-orange/80 to-accent-orange', plural: 'Teachers' }]
                .map(r => <div key={r.role} className={`bg-gradient-to-br ${r.color} text-white rounded-xl p-4 text-center shadow-md`}><p className="text-2xl font-bold">{r.count}</p><p className="text-xs opacity-80">{r.plural}</p></div>)}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
