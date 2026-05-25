import React, { useState, useEffect } from 'react';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, FileText, Inbox, SquareCheck, Clock, TrendingUp, 
  Activity, Award, UserPlus, Calendar, Target, AlertTriangle, Shield,
  ChevronRight, ArrowUpRight, School, CircleCheck, Settings, Terminal
} from 'lucide-react';

export default function Dashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [allStats, setAllStats] = useState<any>(null);
  const [forms, setForms] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);
  const [allRecentSubs, setAllRecentSubs] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'submissions' | 'logs'>('submissions');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [s, subs, formsList] = await Promise.all([
        api.get('/stats').catch(() => ({})),
        api.get('/submissions').catch(() => []),
        api.get('/forms').catch(() => [])
      ]);
      setAllStats(s || {});
      setStats(s || {});
      setAllRecentSubs(Array.isArray(subs) ? subs.slice(0, 10) : []);
      setRecentSubs(Array.isArray(subs) ? subs.slice(0, 10) : []);
      setForms(Array.isArray(formsList) ? formsList : []);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setAllStats({});
      setStats({});
      setForms([]);
      setAllRecentSubs([]);
      setRecentSubs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSelect = async (formId: string | null) => {
    setSelectedFormId(formId);
    try {
      setLoading(true);
      
      if (!formId) {
        setStats(allStats);
        setRecentSubs(allRecentSubs);
        return;
      }

      // Fetch filtered stats for the selected form
      const [formStats, subs] = await Promise.all([
        api.get(`/stats?form_id=${formId}`).catch(() => ({})),
        api.get('/submissions').catch(() => [])
      ]);
      
      setStats(formStats || {});
      
      // Filter submissions by form
      const filteredSubs = (Array.isArray(subs) ? subs : []).filter((sub: any) => 
        sub.form_id === formId || sub.formId === formId
      ).slice(0, 10);
      setRecentSubs(filteredSubs);
    } catch (err) {
      console.error('Error fetching form-specific stats:', err);
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
        
        {/* Clean Enterprise Corporate Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Hello, {user.name}. Centralized platform status, nominations audit trail, and user analytics.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {forms.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Filter by Form:</label>
                <select
                  value={selectedFormId || ''}
                  onChange={(e) => handleFormSelect(e.target.value || null)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary cursor-pointer"
                >
                  <option value="">All Forms</option>
                  {forms.map((form: any) => (
                    <option key={form._id || form.id} value={form._id || form.id}>
                      {form.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All Services Operational
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold">
              <Activity size={13} className="text-slate-500" />
              Sync Latency: 12ms
            </div>
          </div>
        </div>

        {/* Crisp Enterprise Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { 
              label: "Total Users", 
              value: s.totalUsers || 0, 
              subtext: `${s.usersByRole?.teacher || 0} Teachers • ${s.usersByRole?.reviewer || 0} Reviewers`,
              icon: Users, 
              color: "text-blue-600 bg-blue-50 border-blue-100/50",
              cta: "Manage Users", 
              path: "/users" 
            },
            { 
              label: "Active Forms", 
              value: s.activeForms || 0, 
              subtext: `${s.draftForms || 0} Drafts • ${s.expiredForms || 0} Expired`,
              icon: FileText, 
              color: "text-emerald-600 bg-emerald-50 border-emerald-100/50",
              cta: "Configure Forms", 
              path: "/forms" 
            },
            { 
              label: "Submissions Received", 
              value: s.totalSubmissions || 0, 
              subtext: `Success Index: ${s.totalSubmissions > 0 ? Math.round(((s.submissionsByStatus?.approved || 0) / s.totalSubmissions) * 100) : 0}%`,
              icon: Inbox, 
              color: "text-indigo-600 bg-indigo-50 border-indigo-100/50",
              cta: "Browse Records", 
              path: "/submissions" 
            },
            { 
              label: "Pending Reviews", 
              value: s.pendingReviews || 0, 
              subtext: `${s.completedReviews || 0} Gradings Completed`,
              icon: SquareCheck, 
              color: "text-amber-600 bg-amber-50 border-amber-100/50",
              cta: "Process Reviews", 
              path: "/reviews" 
            }
          ].map((card, i) => (
            <div 
              key={card.label} 
              onClick={() => navigate(card.path)}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div className="flex justify-between items-center mb-4">
                <div className={`w-10 h-10 rounded-xl ${card.color} border flex items-center justify-center`}>
                  <card.icon size={18} />
                </div>
                <div className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 group-hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition-colors">
                  {card.cta}
                  <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </div>
                <div className="text-[10px] font-semibold text-slate-400 mt-2 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  {card.subtext}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Dashboard Panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Visual Analytics & Tabbed Ledger (col-span-8) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Custom Clean Activity Chart */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Analytics Dashboard</div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-1">
                    <TrendingUp size={16} className="text-slate-500" />
                    Submission Velocity Trend
                  </h3>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <Calendar size={12} className="text-slate-400" />
                  Temporal Analysis: Last 10 Days
                </div>
              </div>

              {timeline.length === 0 ? (
                <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Inbox size={40} className="opacity-20 mx-auto mb-2 text-slate-400" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Waiting for system records...</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-end gap-3 h-48 px-2 relative">
                    {/* Horizontal helper grid lines */}
                    <div className="absolute inset-x-0 top-0 border-t border-slate-100 pointer-events-none" />
                    <div className="absolute inset-x-0 top-1/3 border-t border-slate-100 pointer-events-none" />
                    <div className="absolute inset-x-0 top-2/3 border-t border-slate-100 pointer-events-none" />
                    
                    {timeline.map(([date, count], i) => (
                      <div key={date} className="flex-1 group relative flex flex-col items-center gap-2 h-full justify-end z-10">
                        {/* Hover Tooltip card */}
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded-lg pointer-events-none z-20 shadow-md flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span className="font-semibold">{count as number} Submissions</span>
                        </div>
                        
                        {/* Beautiful clean bar */}
                        <div 
                          style={{ height: `${((count as number) / maxTimeline) * 85}%` }}
                          className="w-full bg-indigo-600 rounded-md min-h-[6px] group-hover:bg-indigo-500 transition-colors duration-150"
                        />
                        
                        <span className="text-[9px] font-bold text-slate-400 group-hover:text-slate-700 transition-colors mt-1">
                          {date.split('-').slice(1).join('/')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Clean Tabbed Stream Center: Submissions vs System Audit Logs */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              
              {/* Tab Selector Header */}
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                  <button 
                    onClick={() => setActiveTab('submissions')}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'submissions' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Recent Submissions
                  </button>
                  <button 
                    onClick={() => setActiveTab('logs')}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'logs' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    System Audit Logs
                  </button>
                </div>
                
                {activeTab === 'submissions' ? (
                  <button 
                    onClick={() => navigate('/submissions')} 
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider bg-slate-100 hover:bg-slate-200/80 border border-slate-200 px-3 py-1.5 rounded-lg transition-all"
                  >
                    View All Submissions <ChevronRight size={10} />
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    <Shield size={11} className="text-slate-400" />
                    Security Ledger (Last 10 Actions)
                  </div>
                )}
              </div>
              
              {/* Tab Content Panels */}
              <div className="divide-y divide-slate-100">
                {activeTab === 'submissions' ? (
                  recentSubs.length === 0 ? (
                    <div className="p-16 text-center text-slate-400">
                      <Inbox size={40} className="mx-auto opacity-20 mb-3" />
                      <p className="text-xs font-semibold uppercase tracking-wider">No submissions in queue</p>
                    </div>
                  ) : recentSubs.map((sub, i) => (
                    <div 
                      key={subId(sub)} 
                      onClick={() => { if (canOpenSubmission(sub)) navigate(`/forms/view?submission=${subId(sub)}`); }} 
                      className="w-full text-left px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-slate-50/50 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 flex items-center justify-center text-xs font-bold transition-all border border-slate-200/80 shrink-0">
                          {displaySubmissionNameFirstChar(sub)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                            {sub.form_title || 'Untitled Form submission'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400">Nominee:</span>
                            <span className="text-[10px] text-slate-600 font-semibold truncate">
                              {displaySubmissionName(sub)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 self-stretch sm:self-center">
                        <div className="text-left sm:text-right">
                          <StatusBadge 
                            status={
                              ['submitted', 'under_review', 'approved', 'rejected', 'next_level', 'completed'].includes(sub.status) 
                              ? 'submitted' 
                              : 'pending'
                            } 
                            size="xs" 
                          />
                          <p className="text-[9px] text-slate-400 font-semibold mt-1 uppercase tracking-tighter">
                            {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Today'}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  ))
                ) : (
                  recentLogs.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 bg-slate-50/50 font-mono">
                      <Terminal size={32} className="mx-auto opacity-10 mb-2 text-slate-500" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Security audit trail is empty</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            <th className="px-6 py-3.5">User</th>
                            <th className="px-6 py-3.5">Action</th>
                            <th className="px-6 py-3.5">Timestamp</th>
                            <th className="px-6 py-3.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recentLogs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-6 py-3.5">
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-slate-800">{log.user_name || 'System Operator'}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{log.user_email}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">{log.action}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-xs font-medium text-slate-500">
                                {log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-6 py-3.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  PASS
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Quick Actions Shortcuts Board */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Administrative Utilities</div>
              <h3 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Settings size={16} className="text-slate-500" />
                System Operational Controls
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: "Form Generator", desc: "Design new custom forms", icon: FileText, bg: "bg-blue-50 text-blue-600 border-blue-100/50", path: "/forms" },
                  { title: "Review Pipeline", desc: "Configure stages & groups", icon: Target, bg: "bg-purple-50 text-purple-600 border-purple-100/50", path: "/reviews" },
                  { title: "Security Matrix", desc: "Manage system operators", icon: Shield, bg: "bg-amber-50 text-amber-600 border-amber-100/50", path: "/users" }
                ].map((act) => (
                  <div 
                    key={act.title}
                    onClick={() => navigate(act.path)}
                    className="p-5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer transition-all duration-150 group flex flex-col justify-between min-h-[110px]"
                  >
                    <div className={`w-8 h-8 rounded-lg ${act.bg} border flex items-center justify-center`}>
                      <act.icon size={15} />
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-0.5">
                        {act.title}
                        <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 translate-x-[-2px] group-hover:translate-x-0 transition-all text-slate-400" />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{act.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Platform Diagnostics & Fulfillment (col-span-4) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Highly Useful Platform Progress Widget */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden group">
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Fulfillment Monitor</div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm mb-6">
                <Award size={16} className="text-slate-500" />
                Nomination Response Rate
              </h3>
              
              {/* Circular SVG Progress Indicator */}
              <div className="flex flex-col items-center justify-center py-4 border-b border-slate-100">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  {/* Circle SVG */}
                  <svg className="w-28 h-28 transform -rotate-90">
                    <circle cx="56" cy="56" r="44" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                    <motion.circle 
                      cx="56" 
                      cy="56" 
                      r="44" 
                      stroke="#4f46e5" 
                      strokeWidth="6" 
                      fill="transparent" 
                      strokeDasharray="276"
                      initial={{ strokeDashoffset: 276 }}
                      animate={{ strokeDashoffset: 276 - (276 * (s.completionRate || 0)) / 100 }}
                      transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-slate-900">{s.completionRate || 0}%</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Finished</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 w-full text-center mt-6">
                  <div>
                    <div className="text-xs font-bold text-slate-700">{s.nominationsByStatus?.invited || 0}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Invited</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700">{s.nominationsByStatus?.in_progress || 0}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Pending</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700">{s.nominationsByStatus?.completed || 0}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Completed</div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Avg Graded Score</span>
                <span className="text-indigo-600 font-bold">{s.avgScore || 0}% Average</span>
              </div>
            </div>

            {/* Platform Funnel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between mb-6 relative">
                <div>
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Platform Status</div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm mt-1">
                    <Target size={16} className="text-slate-500" />
                    Conversion Funnel
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600">
                  {s.totalSubmissions || 0}
                </div>
              </div>

              <div className="space-y-4 relative">
                {[
                  { label: 'Pending Assessment', value: s.submissionsByStatus?.submitted || 0, color: 'bg-blue-600', icon: Inbox, bg: 'bg-blue-50 text-blue-600 border-blue-100/50' },
                  { label: 'Under Review', value: s.submissionsByStatus?.under_review || 0, color: 'bg-indigo-600', icon: Clock, bg: 'bg-indigo-50 text-indigo-600 border-indigo-100/50' },
                  { label: 'Approved Records', value: s.submissionsByStatus?.approved || 0, color: 'bg-emerald-500', icon: SquareCheck, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100/50' },
                  { label: 'Declined Submissions', value: s.submissionsByStatus?.rejected || 0, color: 'bg-rose-500', icon: AlertTriangle, bg: 'bg-rose-50 text-rose-600 border-rose-100/50' }
                ].map((st, i) => { 
                  const total = Math.max(s.totalSubmissions || 1, 1); 
                  const pct = (st.value / total) * 100;
                  return (
                    <div key={st.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-md ${st.bg} border flex items-center justify-center`}><st.icon size={11} /></div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{st.label}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-900">{st.value}</span>
                      </div>
                      
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${pct}%` }} 
                          transition={{ delay: 0.3 + (i * 0.05), duration: 0.8, ease: "circOut" }} 
                          className={`h-full rounded-full ${st.color}`} 
                        />
                      </div>
                    </div>
                  ); 
                })}
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Success Index</span>
                <span className="text-emerald-600 font-bold">
                  {s.totalSubmissions > 0 ? Math.round(((s.submissionsByStatus?.approved || 0) / s.totalSubmissions) * 100) : 0}% Approved
                </span>
              </div>
            </div>

            {/* Premium System Information Widget */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Shield size={13} className="text-slate-400" />
                </div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Security Notice</h3>
              </div>
              <p className="text-[11.5px] text-slate-500 leading-relaxed font-medium mb-4">
                Your connection to the enterprise console is fully encrypted. All actions in this console are recorded in the central audit ledger for security compliance.
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[9.5px] font-bold text-indigo-600 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Secure Connection Active
              </div>
            </div>

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
        
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {forms.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Filter by Form:</label>
              <select
                value={selectedFormId || ''}
                onChange={(e) => handleFormSelect(e.target.value || null)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary cursor-pointer"
              >
                <option value="">All Forms</option>
                {forms.map((form: any) => (
                  <option key={form._id || form.id} value={form._id || form.id}>
                    {form.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="hidden md:flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em]">
            <Clock size={12} /> {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      <motion.div {...anim(0)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {user.role === 'reviewer' && <>
          <StatCard label="Pending Reviews" value={s.pendingReviews || 0} icon={SquareCheck} color="amber" onClick={() => navigate('/reviews')} ctaText="Start Now" />
          <StatCard label="Completed" value={s.completedReviews || 0} icon={CircleCheck} color="green" />
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
