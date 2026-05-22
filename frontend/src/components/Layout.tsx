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
  { label: 'Email Center', icon: Mail, path: '/email-center' },
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
const formCreatorNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Form Builder', icon: FileText, path: '/forms' },
];

function getNav(role: string) {
  switch (role) { 
    case 'admin': return adminNav; 
    case 'reviewer': return reviewerNav; 
    case 'functionary': return functionaryNav; 
    case 'form_creator': return formCreatorNav;
    default: return teacherNav; 
  }
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
  const isPublicFill = location.pathname.startsWith('/fill/');

  const loadNotifications = () => {
    if (!user?.id || user.id === 'anon') {
      setNotifications([]);
      return;
    }
    api.get(`/notifications?user_id=${user.id}`)
      .then(res => {
        setNotifications(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        setNotifications([]);
      });
  };

  useEffect(() => {
    loadNotifications();
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
      if (nextToken) {
        localStorage.setItem('auth_token', nextToken);
        // Force re-render of layout state if needed, or just let the interval pick up the new token
        if (res?.user) localStorage.setItem('auth_user', JSON.stringify(res.user));
        setSessionWarning(false);
        // No alert needed, just smooth transition
      } else {
        throw new Error('No token received');
      }
    } catch (err) {
      console.error('Session extension failed:', err);
      onLogout();
    } finally {
      setExtending(false);
    }
  };

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter(n => !n.is_read).length;
  const markAllRead = async () => {
    if (!user?.id || user.id === 'anon') return;
    await api.put('/notifications', { id: 'all', user_id: user.id, is_read: true }).catch(() => {});
    setNotifications(prev => (Array.isArray(prev) ? prev : []).map(n => ({ ...n, is_read: true })));
  };
  const breadcrumbs = location.pathname.split('/').filter(Boolean);
  const match = user.email ? user.email.match(/^head\.([a-z0-9]+)@/i) : null;
  const schoolCode = user.school_code || (match ? match[1]?.toUpperCase() : undefined);
  const handleMainClick = () => {
    setShowNotif(false);
    setShowProfile(false);
    if (sidebarOpen) setSidebarOpen(false);
  };

  // Keep hooks stable: bypass UI only after all hooks are declared.
  if (user.id === 'anon' || isPublicFill) {
    return (
      <div className="min-h-screen bg-canvas">
        <main className="flex-1 overflow-x-hidden cursor-pointer" onClick={handleMainClick}>{children}</main>
      </div>
    );
  }

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

      {/* ===== SIDEBAR — Sleek Premium Corporate Design ===== */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[250px] bg-[#090d16] border-r border-slate-800/80 text-white flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 flex items-center gap-2.5 border-b border-slate-800/60 bg-white/[0.01]">
          <div className="w-10 h-10 flex items-center justify-center overflow-hidden shrink-0 rounded-lg bg-slate-800/40 p-1 border border-slate-700/30">
            <img src="/logo-sidebar.png" alt="Logo" className="w-full h-full object-contain" onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = '<span class="text-white font-black text-[10px]">CISCE</span>';
            }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm leading-tight tracking-tight text-slate-100">CISCE Portal</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Official System</p>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        {schoolCode && (
          <div className="mx-3 mt-3 px-3 py-1.5 rounded-lg bg-slate-800/30 border border-slate-800/60 flex items-center justify-between">
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">School Code</span>
            <span className="text-xs font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">{schoolCode}</span>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {nav.map(item => {
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                  active
                    ? 'bg-slate-800 text-white border border-slate-700/50'
                    : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-100'
                }`}>
                <item.icon size={15} className={active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/60 bg-white/[0.01]">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold border border-slate-700/50">{user.name?.charAt(0)?.toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-slate-200">{user.name}</p>
              <p className="text-[9px] text-slate-500 capitalize">{user.role}</p>
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
            <button onClick={() => { if (!showNotif) loadNotifications(); setShowNotif(!showNotif); setShowProfile(false); }} className="p-2 rounded-xl hover:bg-surface text-muted relative" aria-label="Notifications">
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
                  {safeNotifications.length === 0 ? <p className="p-6 text-center text-sm text-muted">No notifications</p> : safeNotifications.slice(0, 10).map(n => (
                    <div key={n.id} className={`px-4 py-3 border-b border-border/50 ${!n.is_read ? 'bg-blue-50/60' : ''}`}>
                      <p className="text-xs font-medium">{n.title || 'New Notification'}</p>
                      <p className="text-[11px] text-muted mt-0.5">{n.message}</p>
                      <p className="text-[9px] text-muted mt-1">{new Date(n.created_at).toLocaleString()}</p>
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
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden cursor-pointer" onClick={handleMainClick}>{children}</main>
      </div>
      {(showNotif || showProfile) && <div className="fixed inset-0 z-20" onClick={() => { setShowNotif(false); setShowProfile(false); }} />}
    </div>
  );
}
