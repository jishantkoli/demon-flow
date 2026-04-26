import React, { useState } from 'react';
import { api } from '../lib/api';
import { Download, FileSpreadsheet, FileText, Archive, Loader2, Users, CheckSquare, Shield } from 'lucide-react';

export default function Exports() {
  const [exporting, setExporting] = useState('');

  const exportData = async (type: string) => {
    setExporting(type);
    try {
      let data: any[];
      switch (type) {
        case 'users': data = await api.get('/users'); break;
        case 'forms': data = await api.get('/forms'); break;
        case 'submissions': data = await api.get('/submissions'); break;
        case 'reviews': data = await api.get('/reviews'); break;
        case 'nominations': data = await api.get('/nominations'); break;
        case 'review-scores': data = await api.get('/review-scores'); break;
        case 'audit-logs': data = await api.get('/audit-logs'); break;
        default: data = [];
      }
      if (data.length === 0) { alert('No data to export'); return; }
      const headers = Object.keys(data[0]);
      const csv = [headers.join(','), ...data.map(row => headers.map(h => {
        const val = row[h]; if (val == null) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${type}-${new Date().toISOString().split('T')[0]}.csv`; a.click();
      await api.post('/audit-logs', { user_id: 1, action: 'export', details: JSON.stringify({ type, rows: data.length }) });
    } catch (err: any) { alert('Export failed: ' + err.message); } finally { setExporting(''); }
  };

  const exports = [
    { key: 'users', label: 'Users', desc: 'All users with roles, schools, and status', icon: Users, color: 'from-blue-500 to-blue-600' },
    { key: 'forms', label: 'Forms', desc: 'All forms with types, fields, and settings', icon: FileText, color: 'from-emerald-500 to-emerald-600' },
    { key: 'submissions', label: 'Submissions', desc: 'Complete submission data with responses', icon: Archive, color: 'from-indigo-500 to-indigo-600' },
    { key: 'nominations', label: 'Nominations', desc: 'Teacher nominations with status tracking', icon: FileSpreadsheet, color: 'from-sky-500 to-sky-600' },
    { key: 'reviews', label: 'Reviews', desc: 'Review pipeline data and decisions', icon: CheckSquare, color: 'from-amber-500 to-amber-600' },
    { key: 'review-scores', label: 'Review Scores', desc: 'Detailed scoring with grades and comments', icon: FileSpreadsheet, color: 'from-pink-500 to-pink-600' },
    { key: 'audit-logs', label: 'Audit Logs', desc: 'Full security logs with IPs and timestamps', icon: Shield, color: 'from-red-500 to-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold font-heading">Data Exports</h1><p className="text-sm text-slate-500">Download data as CSV/Excel for analysis. ZIP exports available for submissions.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exports.map(exp => (
          <div key={exp.key} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${exp.color} text-white flex items-center justify-center mb-3`}><exp.icon size={22} /></div>
            <h3 className="font-semibold text-sm font-heading">{exp.label}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">{exp.desc}</p>
            <button onClick={() => exportData(exp.key)} disabled={!!exporting}
              className="w-full py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]">
              {exporting === exp.key ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exporting === exp.key ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
