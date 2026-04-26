import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { User, getSessionExpiry } from '../lib/auth';
import { api } from '../lib/api';
import {
  LayoutDashboard, Users, FileText, Inbox, CheckSquare, BarChart3,
  Shield, Download, Bell, Menu, X, ChevronRight, Sun, Moon, LogOut,
  Settings, ChevronDown, AlertTriangle, UserPlus, Mail
} from 'lucide-react';

const adminNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'User Management', icon: Users, path: '/users' },
  { label: 'Form Builder', icon: FileText, path: '/forms' },
  { label: 'Submissions', icon: Inbox, path: '/submissions' },
  { label: 'Review System', icon: CheckSquare, path: '/reviews' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Email Center', icon: Mail, path: '/email-center' },
  { label: 'Audit Logs', icon: Shield, path: '/audit-logs' },
  { label: 'Exports', icon: Download, path: '/exports' },
];
const reviewerNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'My Reviews', icon: CheckSquare, path: '/reviews' },
  { label: 'Submissions', icon: Inbox, path: '/submissions' },
];
const functionaryNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'My Forms', icon: FileText, path: '/forms' },
  { label: 'Nominations', icon: UserPlus, path: '/nominations' },
  { label: 'Submissions', icon: Inbox, path: '/submissions' },
];
const teacherNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Available Forms', icon: FileText, path: '/forms' },
  { label: 'My Submissions', icon: Inbox, path: '/submissions' },
];

function getNav(role: string) {
  switch (role) { case 'admin': return adminNav; case 'reviewer': return reviewerNav; case 'functionary': return functionaryNav; default: return teacherNav; }
}

export default function Layout({ user, onLogout, children }: { user: User; onLogout: () => void; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [extending, setExtending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const nav = getNav(user.role);

  useEffect(() => {
    if (!user?.id || user.id === 'anon') {
      setNotifications([]);
      return;
    }
    api.get(`/notifications?user_id=${user.id}`).then(setNotifications).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      const exp = getSessionExpiry();
      if (!exp) return;
      const remaining = exp - Date.now();
      if (remaining <= 0) { onLogout(); return; }
      if (remaining <= 2 * 60 * 1000) {
        setSessionWarning(true);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      } else {
        setSessionWarning(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [onLogout]);

  const handleExtendSession = async () => {
    setExtending(true);
    try {
      const res: any = await api.post('/auth/refresh', {});
      const nextToken = res?.token || res?.accessToken;
      if (nextToken) localStorage.setItem('auth_token', nextToken);
      if (res?.user) localStorage.setItem('auth_user', JSON.stringify(res.user));
      setSessionWarning(false);
    } catch {
      onLogout();
    } finally {
      setExtending(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const markAllRead = async () => {
    if (!user?.id || user.id === 'anon') return;
    await api.put('/notifications', { id: 'all', user_id: user.id, is_read: true }).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };
  const breadcrumbs = location.pathname.split('/').filter(Boolean);
  const schoolCode = user.school_code || (user.email?.match(/^head\.([a-z0-9]+)@/i)?.[1]?.toUpperCase());

  return (
    <div className="min-h-screen bg-surface text-fg flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {sessionWarning && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-warning text-white px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2">
          <AlertTriangle size={16} /> Session expires in {timeLeft}
          <button
            onClick={handleExtendSession}
            disabled={extending}
            className="ml-3 px-3 py-0.5 bg-white/25 rounded-lg text-xs hover:bg-white/40 disabled:opacity-60"
          >
            {extending ? 'Extending...' : 'Extend'}
          </button>
        </div>
      )}

      {/* ===== SIDEBAR — Vibrant Indigo ===== */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[260px] bg-gradient-to-b from-sidebar-light to-sidebar text-white flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm shadow-inner backdrop-blur-md">SD</div>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-[14px] leading-tight tracking-tight text-white">SchoolData</h1>
            <p className="text-[9px] text-white/50 uppercase tracking-[0.15em]">Collection Portal</p>
          </div>
          <button className="lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        {schoolCode && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/10">
            <p className="text-[9px] text-white/60 uppercase tracking-wider font-bold">School Code</p>
            <p className="text-sm font-bold text-white">{schoolCode}</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {nav.map(item => {
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-white text-primary shadow-lg shadow-black/10'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}>
                <item.icon size={17} className={active ? 'text-primary' : 'text-white/50'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white border border-white/10">{user.name?.charAt(0)?.toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-white">{user.name}</p>
              <p className="text-[10px] text-white/40 capitalize">{user.role}{schoolCode ? ` · ${schoolCode}` : ''}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className={`sticky ${sessionWarning ? 'top-[36px]' : 'top-0'} z-30 bg-card border-b border-border px-4 lg:px-6 h-14 flex items-center gap-3`}>
          <button className="lg:hidden text-muted hover:text-fg p-1" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted">
            <Link to="/" className="hover:text-primary font-medium">Home</Link>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={11} />
                <span className={i === breadcrumbs.length - 1 ? 'text-fg font-semibold capitalize' : 'capitalize'}>{crumb.replace(/-/g, ' ')}</span>
              </React.Fragment>
            ))}
          </div>
          <div className="flex-1" />

          <div className="relative">
            <button onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }} className="p-2 rounded-xl hover:bg-surface text-muted relative" aria-label="Notifications">
              <Bell size={17} />
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger text-white text-[8px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>}
            </button>
            {showNotif && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden z-50">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <h3 className="font-bold text-sm">Notifications</h3>
                  <button onClick={markAllRead} className="text-[10px] text-primary hover:underline font-bold">Mark all read</button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? <p className="p-6 text-center text-sm text-muted">No notifications</p> : notifications.slice(0, 10).map(n => (
                    <div key={n.id} className={`px-4 py-3 border-b border-border/50 ${!n.is_read ? 'bg-blue-50/60' : ''}`}>
                      <p className="font-bold text-xs">{n.title}</p>
                      <p className="text-muted text-[11px] mt-0.5">{n.message}</p>
                      <p className="text-[9px] text-muted/60 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }} className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-xl hover:bg-surface">
              <div className="w-7 h-7 rounded-full bg-sidebar text-white flex items-center justify-center text-[10px] font-bold">{user.name?.charAt(0)?.toUpperCase()}</div>
              <ChevronDown size={13} className="text-muted" />
            </button>
            {showProfile && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden z-50">
                <div className="p-4 border-b border-border">
                  <p className="font-bold text-sm">{user.name}</p>
                  <p className="text-[11px] text-muted truncate">{user.email}</p>
                  <span className="inline-block mt-1.5 px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded-full capitalize">{user.role}</span>
                </div>
                <button onClick={() => { navigate('/profile'); setShowProfile(false); }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface flex items-center gap-2"><Settings size={14} className="text-muted" /> Profile</button>
                <button onClick={onLogout} className="w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-danger/5 flex items-center gap-2"><LogOut size={14} /> Sign Out</button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>
      {(showNotif || showProfile) && <div className="fixed inset-0 z-20" onClick={() => { setShowNotif(false); setShowProfile(false); }} />}
    </div>
  );
}
