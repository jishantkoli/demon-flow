import React, { useState } from 'react';
import { User } from '../lib/auth';
import { UserCircle, Mail, Phone, Building, Shield, Clock, Save, Key, MapPin } from 'lucide-react';

export default function Profile({ user }: { user: User }) {
  const [saved, setSaved] = useState(false);
  const schoolCode = user.school_code || (user.email?.match(/^head\.([a-z0-9]+)@/i)?.[1]?.toUpperCase());

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-xl font-bold font-heading">Profile Settings</h1><p className="text-sm text-slate-500">Manage your account and session information</p></div>
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-sidebar to-sidebar-light p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 text-white flex items-center justify-center text-2xl font-bold backdrop-blur-sm">{user.name?.charAt(0)?.toUpperCase()}</div>
          <div className="text-white"><h2 className="text-lg font-bold">{user.name}</h2><p className="text-sm text-blue-200 capitalize">{user.role}{schoolCode ? ` · ${schoolCode}` : ''}</p></div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ label: 'Full Name', icon: UserCircle, value: user.name, editable: true },
              { label: 'Email', icon: Mail, value: user.email, editable: false },
              { label: 'Phone', icon: Phone, value: user.phone || 'Not set', editable: true },
              { label: 'Role', icon: Shield, value: user.role, editable: false },
              { label: 'School', icon: Building, value: user.school_name || 'Not set', editable: false },
              { label: 'District', icon: MapPin, value: user.district || 'Not set', editable: false }]
              .map(f => (<div key={f.label}><label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1"><f.icon size={12} /> {f.label}</label>
                <input type="text" defaultValue={f.value || ''} disabled={!f.editable}
                  className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none ${f.editable ? 'bg-slate-100' : 'bg-slate-100 opacity-60'}`} /></div>))}
          </div>
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold mb-3">Session & Security</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-500 p-2 bg-slate-100 rounded-xl"><Clock size={12} /> Timeout: {user.role === 'functionary' ? '30 minutes' : '24 hours'}</div>
              <div className="flex items-center gap-2 text-slate-500 p-2 bg-slate-100 rounded-xl"><Key size={12} /> Auth: {user.role === 'admin' || user.role === 'reviewer' ? 'Password' : 'OTP'}</div>
              <div className="flex items-center gap-2 text-slate-500 p-2 bg-slate-100 rounded-xl"><Shield size={12} /> All logins tracked with IP</div>
              {schoolCode && <div className="flex items-center gap-2 text-slate-500 p-2 bg-slate-100 rounded-xl"><Building size={12} /> School: {schoolCode}</div>}
            </div>
          </div>
          <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors min-h-[44px]">
            <Save size={14} /> {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
