import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createBrowserRouter, RouterProvider, Routes, Route, Navigate, useSearchParams, Outlet } from 'react-router-dom';
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

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-red-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 text-center mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 text-center mb-6">The application crashed due to a runtime error. This might be due to missing configuration or malformed data.</p>
            <div className="bg-slate-50 rounded-xl p-4 mb-6 overflow-auto max-h-40">
              <p className="text-xs font-mono text-red-600 break-words">{this.state.error?.message}</p>
              <p className="text-[10px] text-slate-400 mt-2">Check browser console for more details.</p>
            </div>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
            >
              Try to Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const { user, loading, logout, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();

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

  // Define public routes: explicitly /fill/ or any form route with a nomination token
  const isPublicFill = 
    window.location.pathname.startsWith('/fill/') || 
    (window.location.pathname.includes('/forms/') && window.location.search.includes('token='));

  if (!user && !isPublicFill) {
    return <Login onLogin={refreshUser} />;
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
        <Route path="/login" element={user ? <Navigate to={searchParams.get('redirect') || "/"} replace /> : <Login onLogin={refreshUser} />} />
        <Route path="*" element={<Navigate to={user || isPublicFill ? undefined : "/login"} replace />} />
      </Routes>
    </Layout>
  );
}

const router = createBrowserRouter([
  {
    path: "*",
    element: <AppContent />,
  }
]);

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
