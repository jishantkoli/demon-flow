import { api } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'reviewer' | 'functionary' | 'teacher';
  avatar_url?: string;
  phone?: string;
  school_name?: string;
  district?: string;
  school_code?: string;
  status?: string;
}

export function getStoredUser(): User | null {
  try {
    const u = localStorage.getItem('auth_user');
    if (!u || u === 'undefined' || u === 'null') return null;
    const user = JSON.parse(u);
    return user;
  } catch (e) {
    console.error('Error getting stored user:', e);
    return null;
  }
}
export function getToken(): string | null { return localStorage.getItem('auth_token'); }
export function getSessionExpiry(): number | null {
  try { 
    const t = getToken(); 
    if (!t) return null; 
    const payload = t.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const d = JSON.parse(jsonPayload);
    return d.exp ? d.exp * 1000 : null; // JWT exp is in seconds
  } catch { return null; }
}

export async function loginWithPassword(email: string, password: string) {
  const res = await api.post('/auth', { action: 'login-password', email, password });
  localStorage.setItem('auth_user', JSON.stringify(res.user));
  localStorage.setItem('auth_token', res.token);
  return res;
}

export async function requestOTP(emailOrPhone: string) {
  const isPhone = /^[\d+]/.test(emailOrPhone);
  return api.post('/auth', { action: 'request-otp', ...(isPhone ? { phone: emailOrPhone } : { email: emailOrPhone }) });
}

export async function verifyOTP(emailOrPhone: string, otp: string) {
  const isPhone = /^[\d+]/.test(emailOrPhone);
  const res = await api.post('/auth', { action: 'verify-otp', otp, ...(isPhone ? { phone: emailOrPhone } : { email: emailOrPhone }) });
  localStorage.setItem('auth_user', JSON.stringify(res.user));
  localStorage.setItem('auth_token', res.token);
  return res;
}

export async function verifyToken(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await api.post('/auth', { action: 'verify-token', token });
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    return res.user;
  } catch (e) {
    console.error('verifyToken failed:', e); // Debug log
    logout();
    return null;
  }
}

export function logout() {
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_token');
}
