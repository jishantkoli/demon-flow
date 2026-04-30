import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { loginWithPassword, requestOTP, verifyOTP } from '../lib/auth';
import { motion } from 'framer-motion';
import { GraduationCap, Mail, Key, Phone, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle, Info } from 'lucide-react';

type Portal = 'select' | 'admin' | 'functionary' | 'teacher';

export default function Login({ onLogin }: { onLogin: (u: any) => void }) {
  const [searchParams] = useSearchParams();
  const [portal, setPortal] = useState<Portal>('select');
  const [email, setEmail] = useState('');
  
  // Auto-select portal and pre-fill email if provided in query params
  useEffect(() => {
    const portalParam = searchParams.get('portal') as Portal;
    const emailParam = searchParams.get('email');
    const redirectParam = searchParams.get('redirect');

    if (portalParam && ['admin', 'functionary', 'teacher'].includes(portalParam)) {
      setPortal(portalParam);
    } else if (redirectParam?.startsWith('/fill/')) {
      setPortal('teacher');
    }

    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [schoolCode, setSchoolCode] = useState('');

  const reset = () => { setEmail(''); setPassword(''); setOtp(''); setOtpSent(false); setError(''); setSuccess(''); setSchoolCode(''); };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { 
      const res = await loginWithPassword(email, password); 
      console.log('Admin Login success:', res);
      
      const redirect = searchParams.get('redirect');
      if (redirect) {
        setSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          window.location.href = redirect;
        }, 800);
      } else {
        onLogin(res.user); 
      }
    }
    catch (err: any) { 
       console.error('Admin Login failed:', err);
       setError(err.message); 
     } finally { setLoading(false); }
   };

   const handleRequestOTP = async () => {
     setError(''); setSuccess(''); setLoading(true);
     try {
       const res = await requestOTP(email);
       setOtpSent(true);
       if (res.school_code) setSchoolCode(res.school_code);
       setSuccess('OTP sent! Use 123456 for local testing.');
     } catch (err: any) { setError(err.message); } finally { setLoading(false); }
   };
  
    const handleVerifyOTP = async (e: React.FormEvent) => {
      e.preventDefault(); setError(''); setLoading(true);
      try { 
        const res = await verifyOTP(email, otp); 
        console.log('OTP Verify success:', res);
        
        const redirect = searchParams.get('redirect');
        if (redirect) {
          // If there's a redirect URL, go there after a brief success message
          setSuccess('Login successful! Redirecting...');
          setTimeout(() => {
            window.location.href = redirect;
          }, 1000);
        } else {
          onLogin(res.user); 
        }
      }
      catch (err: any) { 
        console.error('OTP Verify failed:', err);
        setError(err.message); 
      } finally { setLoading(false); }
    };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm text-fg placeholder-muted";
  const btnCls = "w-full py-2.5 bg-sidebar text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px] shadow-md shadow-sidebar/20";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/60 to-sky-50/40 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="w-48 h-48 mx-auto mb-4 overflow-hidden flex items-center justify-center">
            <img src="/logo.png" alt="CISCE Logo" className="w-full h-full object-contain drop-shadow-xl" onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = '<div class="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center font-bold text-2xl shadow-xl border-4 border-white">CISCE</div>';
            }} />
          </div>
          <h1 className="text-3xl font-bold font-heading text-primary tracking-tight">CISCE Data Collection Portal</h1>
          <p className="text-sm text-muted mt-2 font-medium">Council for the Indian School Certificate Examinations</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden">
          {portal === 'select' ? (
            <div className="p-6 space-y-3">
              <h2 className="text-lg font-bold text-center mb-5 font-heading text-fg">Choose Your Portal</h2>
              {[
                { id: 'admin' as Portal, label: 'Admin / Reviewer', desc: 'Username & password login', icon: Key, iconBg: 'bg-primary/10', iconColor: 'text-primary' },
                { id: 'functionary' as Portal, label: 'School Functionary', desc: 'Email OTP Verification', icon: Mail, iconBg: 'bg-primary/10', iconColor: 'text-primary' },
                { id: 'teacher' as Portal, label: 'Teacher', desc: 'Direct form OTP access', icon: Phone, iconBg: 'bg-primary/10', iconColor: 'text-primary' },
              ].map(p => (
                <button key={p.id} onClick={() => { reset(); setPortal(p.id); }}
                  className="w-full p-4 rounded-xl border-2 border-slate-100 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all flex items-center gap-4 group text-left">
                  <div className={`w-11 h-11 rounded-xl ${p.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <p.icon size={20} className={p.iconColor} />
                  </div>
                  <div className="flex-1"><p className="font-semibold text-sm text-fg">{p.label}</p><p className="text-[11px] text-muted">{p.desc}</p></div>
                  <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-colors" />
                </button>
              ))}
              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200/60">
                <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1.5"><Key size={12} /> Development OTP: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">123456</code></p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200/60">
                <p className="text-[11px] text-blue-700 font-medium flex items-center gap-1.5"><Info size={12} /> Functionary: 30min session · Admin: 24h session</p>
              </div>
            </div>
          ) : portal === 'admin' ? (
            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button type="button" onClick={() => setPortal('select')} className="text-muted hover:text-fg text-sm">←</button>
                <h2 className="text-lg font-bold font-heading text-fg">Admin / Reviewer</h2>
              </div>
              {error && <div className="p-3 bg-red-50 border border-red-200/60 rounded-xl text-xs text-red-600 flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
              <div><label className="text-xs font-semibold text-muted mb-1.5 block">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls} placeholder="admin@school.edu" /></div>
              <div><label className="text-xs font-semibold text-muted mb-1.5 block">Password</label>
                <div className="relative"><input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required className={inputCls} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Key size={14} /> Sign In</>}
              </button>
            </form>
          ) : (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => { setPortal('select'); reset(); }} className="text-muted hover:text-fg text-sm">←</button>
                <h2 className="text-lg font-bold font-heading text-fg">{portal === 'functionary' ? 'School Functionary' : 'Teacher'}</h2>
              </div>
              {error && <div className="p-3 bg-red-50 border border-red-200/60 rounded-xl text-xs text-red-600 flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
              {success && <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl text-xs text-emerald-600 flex items-center gap-2"><CheckCircle size={14} />{success}</div>}
              {!otpSent ? (
                <>
                  <div><label className="text-xs font-semibold text-muted mb-1.5 block">{portal === 'functionary' ? 'School Email' : 'Email or Phone'}</label>
                    <input type={portal === 'functionary' ? 'email' : 'text'} value={email} onChange={e => setEmail(e.target.value)}
                      className={inputCls} placeholder={portal === 'functionary' ? 'head.kv001@cbss.school.org' : 'teacher@school.edu or +91...'} />
                    {portal === 'functionary' && <p className="text-[10px] text-muted mt-1">Format: head.{'{code}'}@cbss.school.org — auto-extracts school code</p>}
                  </div>
                  <button onClick={handleRequestOTP} disabled={loading || !email} className={btnCls}>
                    {loading ? 'Sending...' : 'Request OTP'}
                  </button>
                </>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  {schoolCode && <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60"><p className="text-xs text-emerald-700 font-semibold">School Code: <span className="font-mono text-sm">{schoolCode}</span></p></div>}
                  <div><label className="text-xs font-semibold text-muted mb-1.5 block">Enter 6-digit OTP</label>
                    <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-center text-2xl tracking-[0.5em] font-mono text-fg" placeholder="• • • • • •" autoFocus />
                    <p className="text-[10px] text-muted mt-1 text-center">OTP valid for 5 minutes</p>
                  </div>
                  <button type="submit" disabled={loading || otp.length < 6} className={btnCls}>
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                  <button type="button" onClick={() => { setOtpSent(false); setOtp(''); setSuccess(''); }} className="w-full text-xs text-muted hover:text-primary">Resend OTP</button>
                </form>
              )}
            </div>
          )}
        </div>
        <p className="text-center text-[10px] text-muted mt-6">Session: {portal === 'functionary' ? '30min' : '24h'} · All logins tracked · Secure tokens</p>
      </motion.div>
    </div>
  );
}
