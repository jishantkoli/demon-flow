import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import DataTable from '../components/DataTable';
import { Shield, Filter, Clock, MapPin } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    const url = actionFilter ? `/audit-logs?action=${actionFilter}` : '/audit-logs';
    api.get(url).then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, [actionFilter]);

  const columns = [
    { key: 'id', label: '#', sortable: true, render: (v: number) => <span className="text-xs font-mono text-slate-500">#{v}</span> },
    { key: 'user_id', label: 'User', sortable: true, render: (v: number) => <span className="text-xs font-mono font-bold">#{v}</span> },
    { key: 'action', label: 'Action', sortable: true, render: (v: string) => (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold capitalize">
        <Shield size={10} /> {v?.replace(/_/g, ' ')}
      </span>) },
    { key: 'details', label: 'Details', render: (v: string) => {
      try {
        const d = typeof v === 'string' ? JSON.parse(v) : v;
        return (<div className="text-xs text-slate-500 space-y-0.5">
          {d.method && <span className="inline-block mr-2">Method: <span className="font-semibold">{d.method}</span></span>}
          {d.ip && <span className="inline-flex items-center gap-1"><MapPin size={9} /> {d.ip}</span>}
          {d.user_agent && <p className="text-[9px] truncate max-w-[200px]" title={d.user_agent}>{d.user_agent}</p>}
          {d.school_code && <span className="inline-block ml-2 font-mono font-bold text-primary">{d.school_code}</span>}
        </div>);
      } catch { return <span className="text-xs text-slate-500">{v}</span>; }
    }},
    { key: 'created_at', label: 'Timestamp', sortable: true, render: (v: string) => v ? (
      <div className="text-xs"><p className="font-medium">{new Date(v).toLocaleDateString()}</p><p className="text-slate-500 text-[10px]">{new Date(v).toLocaleTimeString()}</p></div>
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
