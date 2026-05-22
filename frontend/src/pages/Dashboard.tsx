import React, { useState, useEffect } from 'react';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, FileText, Inbox, CheckSquare, BarChart3, Clock, TrendingUp, 
  AlertTriangle, Activity, Award, UserPlus, Layers, Calendar, PieChart, 
  Target, Filter, School, Shield 
} from 'lucide-react';

export default function Dashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');
  const [selectedForm, setSelectedForm] = useState('');
  const [forms, setForms] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const url = selectedForm ? `/stats?form_id=${selectedForm}` : '/stats';
      const [s, subs] = await Promise.all([
        api.get(url).catch(() => ({})),
        api.get('/submissions').catch(() => [])
      ]);
      setStats(s || {});
      setRecentSubs(Array.isArray(subs) ? subs.slice(0, 10) : []);
      if (s.forms) setForms(s.forms);
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
  }, [user?.role, selectedForm]);

  if (loading && !stats) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>;
  
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

  const timeline = Object.entries(s.submissionTimeline || {}).sort(([a], [b]) => a.localeCompare(b));
  const maxTimeline = Math.max(...timeline.map(([, v]) => v as number), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading">Welcome back, {user.name?.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {user.role === 'admin' ? 'System overview and real-time analytics' : 
             user.role === 'functionary' ? `Managing nominations for school ${user.school_code || ''}` : 
             user.role === 'form_creator' ? 'Form management and creation' : 'Your portal overview'}
          </p>
        </div>

        {user.role === 'admin' && (
          <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'analytics' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Analytics
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <p className="text-[11px] text-slate-400">Tip: Click on dashboard cards or list items to navigate directly to detail pages.</p>

            {/* Stat Cards Grid */}
            <motion.div {...anim(0)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {user.role === 'admin' && <>
                <StatCard label="Total Users" value={s.totalUsers || 0} icon={Users} color="blue" onClick={() => navigate('/users')} ctaText="Manage users" />
                <StatCard label="Active Forms" value={s.activeForms || 0} icon={FileText} color="green" subtitle={`${s.draftForms || 0} drafts`} onClick={() => navigate('/forms')} ctaText="View forms" />
                <StatCard label="Submissions" value={s.totalSubmissions || 0} icon={Inbox} color="purple" onClick={() => navigate('/submissions')} ctaText="View entries" />
                <StatCard label="Pending Reviews" value={s.pendingReviews || 0} icon={CheckSquare} color="amber" subtitle={`${s.completedReviews || 0} done`} onClick={() => navigate('/reviews')} ctaText="Review now" />
              </>}
              {user.role === 'reviewer' && <>
                <StatCard label="Pending Reviews" value={s.pendingReviews || 0} icon={CheckSquare} color="amber" onClick={() => navigate('/reviews')} ctaText="Start review" />
                <StatCard label="Completed" value={s.completedReviews || 0} icon={TrendingUp} color="green" onClick={() => navigate('/reviews')} />
                <StatCard label="Avg Score Given" value={s.avgScore || 0} icon={BarChart3} color="blue" subtitle="Overall" />
                <StatCard label="Assigned" value={s.totalSubmissions || 0} icon={Inbox} color="purple" onClick={() => navigate('/submissions')} />
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

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Recent Submissions & Progress */}
              <div className="lg:col-span-8 space-y-6">
                {/* Reviewer Progress */}
                {user.role === 'reviewer' && (
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
                    </div>
                  </motion.div>
                )}

                {/* Teacher Progress */}
                {user.role === 'teacher' && (
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
                    </div>
                  </motion.div>
                )}

                {/* Admin/Functionary Recent Submissions */}
                {(user.role === 'admin' || user.role === 'functionary') && (
                  <motion.div {...anim(1)} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border flex items-center justify-between bg-surface/50">
                      <h3 className="font-bold text-sm flex items-center gap-2"><Activity size={16} className="text-primary" /> Recent Submissions</h3>
                      <button onClick={() => navigate('/submissions')} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider">View All</button>
                    </div>
                    <div className="divide-y divide-border">
                      {recentSubs.length === 0 ? (
                        <div className="p-10 text-center text-muted">
                          <Inbox size={32} className="mx-auto opacity-20 mb-2" />
                          <p className="text-xs">No recent submissions found</p>
                        </div>
                      ) : recentSubs.map((sub, i) => (
                        <div
                          key={subId(sub)}
                          onClick={() => { if (canOpenSubmission(sub)) navigate(`/forms/view?submission=${subId(sub)}`); }}
                          className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${canOpenSubmission(sub) ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                            {displaySubmissionNameFirstChar(sub)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{sub.form_title || 'Form Entry'}</p>
                            <p className="text-[10px] text-muted truncate">{displaySubmissionName(sub)} • {displaySubmissionMeta(sub)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <StatusBadge status={sub.status} size="xs" />
                            <p className="text-[9px] text-muted mt-0.5">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Just now'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Teacher Recent Submissions */}
                {user.role === 'teacher' && (
                  <motion.div {...anim(2)} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                      <h3 className="font-semibold font-heading text-sm flex items-center gap-2">
                        <Inbox size={16} className="text-primary" /> My Recent Submissions
                      </h3>
                      <button className="text-[10px] text-primary font-bold hover:underline" onClick={() => navigate('/submissions')}>View all</button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {recentSubs.filter(sub => sub.user_email === user.email).length === 0 ? (
                        <div className="p-10 text-center">
                          <p className="text-sm text-slate-500">You haven't submitted any forms yet.</p>
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
                            <StatusBadge status={sub.status} size="xs" />
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Right Column: Audit Logs, CTA & Status */}
              <div className="lg:col-span-4 space-y-6">
                {/* Admin Audit Logs */}
                {user.role === 'admin' && (
                  <motion.div {...anim(2)} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border flex items-center justify-between bg-surface/50">
                      <h3 className="font-bold text-sm flex items-center gap-2"><Shield size={16} className="text-amber-500" /> Audit Logs</h3>
                    </div>
                    <div className="divide-y divide-border max-h-[400px] overflow-y-auto custom-scrollbar">
                      {recentLogs.length === 0 ? (
                        <p className="p-8 text-center text-xs text-muted">No audit logs recorded</p>
                      ) : recentLogs.map((log, i) => (
                        <div key={i} className="p-4 hover:bg-surface/30 transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase text-primary px-1.5 py-0.5 bg-primary/5 rounded">{log.action?.replace(/_/g, ' ')}</span>
                            <span className="text-[9px] text-muted">{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</span>
                          </div>
                          <p className="text-[11px] text-fg/80 leading-relaxed truncate" title={log.details}>{log.details}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Reviewer/Teacher CTA Cards */}
                {(user.role === 'reviewer' || user.role === 'teacher') && (
                  <motion.div {...anim(2)} className={`rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-center ${user.role === 'reviewer' ? 'bg-gradient-to-br from-primary to-primary/80' : 'bg-gradient-to-br from-indigo-600 to-violet-700'}`}>
                    <div className="relative z-10">
                      <h3 className="text-2xl font-bold mb-2">{user.role === 'reviewer' ? 'Ready to start?' : 'Ready to contribute?'}</h3>
                      <p className="text-white/80 text-sm mb-6 max-w-[280px]">
                        {user.role === 'reviewer' 
                          ? `You have ${s.pendingReviews || 0} submissions waiting for evaluation.` 
                          : `There are ${s.activeForms || 0} forms available for you.`}
                      </p>
                      <button 
                        onClick={() => navigate(user.role === 'reviewer' ? '/reviews' : '/forms')}
                        className="bg-white text-primary px-8 py-3 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors shadow-sm"
                      >
                        {user.role === 'reviewer' ? 'Go to Review Queue' : 'Browse Forms'}
                      </button>
                    </div>
                    {user.role === 'reviewer' ? <CheckSquare className="absolute -right-6 -bottom-6 text-white/10 w-48 h-48 -rotate-12" /> : <FileText className="absolute -right-6 -bottom-6 text-white/10 w-48 h-48 -rotate-12" />}
                  </motion.div>
                )}

                {/* Admin Status Summary - Redesigned */}
                {user.role === 'admin' && (
                  <motion.div {...anim(3)} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm overflow-hidden relative group">
                    <div className="absolute -right-12 -top-12 w-32 h-32 bg-slate-50 rounded-full blur-3xl group-hover:bg-primary/5 transition-colors" />
                    
                    <div className="flex items-center justify-between mb-6 relative">
                      <h3 className="font-bold font-heading text-sm text-slate-800 flex items-center gap-2">
                        <Target size={16} className="text-primary" /> Submission Status
                      </h3>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        Total: {s.totalSubmissions || 0}
                      </span>
                    </div>

                    <div className="space-y-5 relative">
                      {[
                        { label: 'Submitted', value: s.submissionsByStatus?.submitted || 0, color: 'from-blue-500 to-blue-600', icon: Inbox, bg: 'bg-blue-50', text: 'text-blue-600' },
                        { label: 'Under Review', value: s.submissionsByStatus?.under_review || 0, color: 'from-indigo-500 to-indigo-600', icon: Clock, bg: 'bg-indigo-50', text: 'text-indigo-600' },
                        { label: 'Approved', value: s.submissionsByStatus?.approved || 0, color: 'from-emerald-500 to-emerald-600', icon: CheckSquare, bg: 'bg-emerald-50', text: 'text-emerald-600' },
                        { label: 'Rejected', value: s.submissionsByStatus?.rejected || 0, color: 'from-rose-500 to-rose-600', icon: AlertTriangle, bg: 'bg-rose-50', text: 'text-rose-600' }
                      ].map((st, i) => { 
                        const total = Math.max(s.totalSubmissions || 1, 1); 
                        const pct = (st.value / total) * 100;
                        return (
                          <div key={st.label} className="group/item">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg ${st.bg} ${st.text} flex items-center justify-center`}>
                                  <st.icon size={12} />
                                </div>
                                <span className="text-[11px] font-bold text-slate-600">{st.label}</span>
                              </div>
                              <span className="text-[11px] font-black text-slate-900">{st.value}</span>
                            </div>
                            <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden p-0">
                              <motion.div 
                                initial={{ width: 0 }} 
                                animate={{ width: `${pct}%` }} 
                                transition={{ delay: 0.4 + (i * 0.1), duration: 1, ease: "circOut" }} 
                                className={`h-full rounded-full bg-gradient-to-r ${st.color} shadow-sm relative`}
                              >
                                {pct > 15 && (
                                  <div className="absolute top-0 right-0 bottom-0 w-1 bg-white/30" />
                                )}
                              </motion.div>
                            </div>
                          </div>
                        ); 
                      })}
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      <span>Conversion Rate</span>
                      <span className="text-emerald-500">{s.totalSubmissions > 0 ? Math.round(((s.submissionsByStatus?.approved || 0) / s.totalSubmissions) * 100) : 0}% Approved</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8 pb-10"
          >
            {/* Analytics Header & Filter */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary mb-1">
                  <BarChart3 size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Performance Metrics</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Analytics Dashboard</h2>
                <p className="text-xs text-slate-500 font-medium">Insights {selectedForm ? 'for selected form' : 'across all forms'}</p>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1">
                  <Filter size={10} /> Filter by Form
                </label>
                <select 
                  value={selectedForm} 
                  onChange={e => { setSelectedForm(e.target.value); }} 
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
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap z-10">
                          {count as number} Submissions
                        </div>
                        <motion.div 
                          initial={{ height: 0 }} 
                          animate={{ height: `${((count as number) / maxTimeline) * 100}%` }}
                          transition={{ delay: 0.2 + i * 0.03, duration: 0.8, ease: "circOut" }}
                          className="w-full bg-gradient-to-t from-primary to-accent-blue rounded-xl min-h-[6px]"
                        />
                        <span className="text-[9px] font-bold text-slate-400">{date.slice(5).replace('-', '/')}</span>
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
                  Distribution
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
                      <div key={st.label}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-slate-600">{st.label}</span>
                          <span className="text-xs font-black text-slate-900">{st.value}</span>
                        </div>
                        <div className={`h-2 ${st.bg} rounded-full overflow-hidden`}>
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${pct}%` }} 
                            transition={{ delay: 0.4, duration: 1 }} 
                            className={`h-full rounded-full ${st.color}`}
                          />
                        </div>
                      </div>
                    ); 
                  })}
                </div>
              </motion.div>

              {/* Score Distribution */}
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
                          <div className="flex-1 h-3 bg-slate-50 rounded-lg overflow-hidden relative">
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${pct}%` }} 
                              transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }} 
                              className="h-full bg-gradient-to-r from-amber-400 to-orange-500" 
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-800 w-8">{count as number}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Lifecycle & Reach */}
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
                      <School size={12} /> Top Schools
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {s.schoolCodes.map((c: string) => (
                        <span key={c} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 shadow-sm">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
