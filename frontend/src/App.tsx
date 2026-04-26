import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { initTheme } from './lib/theme';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import Forms from './pages/Forms';
import FormFill from './pages/FormFill';
import FormView from './pages/FormView';
import FormBuilder from './pages/FormBuilder';
import Submissions from './pages/Submissions';
import ReviewSystem from './pages/ReviewSystem';
import Nominations from './pages/Nominations';
import Analytics from './pages/Analytics';
import EmailCenter from './pages/EmailCenter';
import AuditLogs from './pages/AuditLogs';
import Exports from './pages/Exports';
import Profile from './pages/Profile';

initTheme();

function AppContent() {
  const { user, loading, logout, refreshUser } = useAuth();

  console.log('AppContent render:', { user, loading }); // Debug log

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500 font-semibold">Loading SchoolData Portal...</p>
          <p className="text-[10px] text-slate-500 mt-1">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Allow access to public form filling even if not logged in
    const isPublicFill = window.location.pathname.startsWith('/fill/');
    if (!isPublicFill) {
      return <Login onLogin={refreshUser} />;
    }
  }

  return (
    <Layout user={user || { id: 'anon', name: 'Anonymous', role: 'teacher', email: '' }} onLogout={logout}>
      <Routes>
        <Route path="/" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
        {user?.role === 'admin' && <Route path="/users" element={<UserManagement />} />}
        <Route path="/forms" element={user ? <Forms user={user} /> : <Navigate to="/login" />} />
        {user?.role === 'admin' && <Route path="/forms/new" element={<FormBuilder />} />}
        {user?.role === 'admin' && <Route path="/forms/:id/builder" element={<FormBuilder />} />}
        <Route path="/fill/:id" element={<FormFill user={user || { id: 'anon', name: 'Anonymous', role: 'teacher', email: '' }} />} />
        <Route path="/forms/view" element={user ? <FormView user={user} /> : <Navigate to="/login" />} />
        <Route path="/submissions" element={user ? <Submissions user={user} /> : <Navigate to="/login" />} />
        <Route path="/reviews" element={user ? <ReviewSystem user={user} /> : <Navigate to="/login" />} />
        {user?.role === 'functionary' && <Route path="/nominations" element={<Nominations user={user} />} />}
        {user?.role === 'admin' && <Route path="/analytics" element={<Analytics />} />}
        {user?.role === 'admin' && <Route path="/email-center" element={<EmailCenter user={user} />} />}
        {user?.role === 'admin' && <Route path="/audit-logs" element={<AuditLogs />} />}
        {user?.role === 'admin' && <Route path="/exports" element={<Exports />} />}
        <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/login" />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={refreshUser} />} />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
