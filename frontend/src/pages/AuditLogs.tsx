import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import DataTable from '../components/DataTable';
import { Shield, Filter, MapPin, User } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    const url = actionFilter ? `/audit-logs?action=${actionFilter}` : '/audit-logs';
    api.get(url).then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, [actionFilter]);

  const toTitle = (text: string) =>
    String(text || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());

  const parseDetails = (value: any) => {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return { raw: value };
      }
    }
    return typeof value === 'object' ? value : {};
  };

  const actionTone = (action: string) => {
    const a = String(action || '').toLowerCase();
    if (a.includes('login') || a.includes('otp')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (a.includes('create') || a.includes('submit') || a.includes('review') || a.includes('export')) return 'bg-primary/10 text-primary ring-primary/20';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  };

  const columns = [
    {
      key: 'id',
      label: 'Log ID',
      sortable: true,
      render: (v: string) => <span className="text-xs font-mono text-slate-500">{String(v || '').slice(-10)}</span>
    },
    {
      key: 'user_name',
      label: 'User',
      sortable: true,
      render: (_v: string, row: any) => {
        const details = parseDetails(row.details);
        const name = row.user_name || details.user_name || details.full_name || details.email || 'Unknown user';
        const email = row.user_email || details.email || '';
        const role = row.user_role || details.role || '';
        return (
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"><User size={10} /> {name}</p>
            {email ? <p className="text-[10px] text-slate-500">{email}</p> : null}
            {role ? <p className="text-[10px] text-slate-400 capitalize">{String(role).replace(/_/g, ' ')}</p> : null}
          </div>
        );
      }
    },
    { key: 'action', label: 'Action', sortable: true, render: (v: string) => (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ring-1 capitalize ${actionTone(v)}`}>
        <Shield size={10} /> {toTitle(v)}
      </span>) },
    {
      key: 'details',
      label: 'Details',
      render: (v: string, row: any) => {
      const d = parseDetails(v);
      const ip = d.ip || d.client_ip || row?.metadata?.ip;
      const method = d.method || d.http_method;
      const schoolCode = d.school_code || d.schoolCode;
      const userAgent = d.user_agent || d.userAgent || row?.metadata?.userAgent;
      try {
        const entries = Object.entries(d).filter(([k]) => !['user_agent', 'userAgent', 'ip', 'client_ip', 'method', 'http_method'].includes(k));
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
              {method ? <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-semibold">{String(method).toUpperCase()}</span> : null}
              {ip ? <span className="inline-flex items-center gap-1"><MapPin size={9} /> {ip}</span> : null}
              {schoolCode ? <span className="font-mono font-semibold text-primary">{schoolCode}</span> : null}
            </div>
            {entries.length > 0 ? (
              <p className="text-[10px] text-slate-500 break-words">
                {entries.slice(0, 2).map(([k, val]) => `${toTitle(k)}: ${String(val)}`).join(' | ')}
              </p>
            ) : null}
            {userAgent ? <p className="text-[9px] text-slate-400 truncate max-w-[260px]" title={String(userAgent)}>{String(userAgent)}</p> : null}
          </div>
        );
      } catch {
        return <span className="text-xs text-slate-500 break-words">{String(v || '—')}</span>;
      }
    }
    },
    { key: 'created_at', label: 'Timestamp', sortable: true, render: (v: string) => v ? (
      <div className="text-xs">
        <p className="font-medium">{new Date(v).toLocaleDateString()}</p>
        <p className="text-slate-500 text-[10px]">{new Date(v).toLocaleTimeString()}</p>
      </div>
    ) : '—' },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold font-heading">Audit Logs</h1><p className="text-sm text-slate-500">Complete security trail with timestamps and IP addresses</p></div>
      <DataTable columns={columns} data={logs} loading={loading} searchPlaceholder="Search logs..."
        filters={<div className="flex items-center gap-2"><Filter size={14} className="text-slate-500" />
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 outline-none" aria-label="Filter by action">
            <option value="">All Actions</option><option value="login">Login</option><option value="otp_requested">OTP Requested</option><option value="create_form">Create Form</option><option value="submit_form">Submit Form</option><option value="review">Review</option><option value="export">Export</option></select></div>}
      />
    </div>
  );
}
