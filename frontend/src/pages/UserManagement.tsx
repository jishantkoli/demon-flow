import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { UserPlus, Edit2, Trash2, Filter, Upload, Download, Users } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'teacher', school_name: '', district: '', password_hash: '', status: 'active' });
  const [importText, setImportText] = useState('');

  const fetchUsers = async () => {
    try { 
      const params = roleFilter ? `?role=${roleFilter}` : ''; 
      const data = await api.get(`/users${params}`).catch(() => []); 
      setUsers(Array.isArray(data) ? data : []); 
    }
    catch (err) { 
      console.error('Error fetching users:', err); 
      setUsers([]);
    } finally { 
      setLoading(false); 
    }
  };
  useEffect(() => { fetchUsers(); }, [roleFilter]);

  const openCreate = () => { setEditUser(null); setForm({ name: '', email: '', phone: '', role: 'teacher', school_name: '', district: '', password_hash: '', status: 'active' }); setShowModal(true); };
  const openEdit = (u: any) => { setEditUser(u); setForm({ name: u.name || '', email: u.email || '', phone: u.phone || '', role: u.role, school_name: u.school_name || '', district: u.district || '', password_hash: '', status: u.status || 'active' }); setShowModal(true); };

  const handleSave = async () => {
    try {
      if (editUser) { const updates: any = { id: editUser.id, ...form }; if (!form.password_hash) delete updates.password_hash; await api.put('/users', updates); }
      else { await api.post('/users', form); }
      setShowModal(false); fetchUsers();
    } catch (err: any) { alert(err.message); }
  };

  const handleDelete = async (id: number) => { if (!confirm('Delete this user?')) return; await api.del('/users', { id }); fetchUsers(); };

  const handleBulkImport = async () => {
    try {
      const lines = importText.trim().split('\n').filter(l => l.trim());
      const userList = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return { name: parts[0], email: parts[1], phone: parts[2] || '', role: parts[3] || 'functionary', school_name: parts[4] || '', district: parts[5] || '' };
      });
      await api.post('/users', { action: 'bulk-import', users: userList });
      setShowImport(false); setImportText(''); fetchUsers();
    } catch (err: any) { alert(err.message); }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Role', 'School', 'District', 'Status'];
    const rows = users.map(u => [u.name, u.email, u.phone || '', u.role, u.school_name || '', u.district || '', u.status || '']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'users-export.csv'; a.click();
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true, render: (v: string, row: any) => (
      <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{(v || '?').charAt(0)}</div>
        <div><p className="font-medium text-sm">{v}</p><p className="text-[10px] text-slate-500">{row.email}</p></div></div>) },
    { key: 'role', label: 'Role', sortable: true, render: (v: string) => <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100">{v}</span> },
    { key: 'school_name', label: 'School', sortable: true, render: (v: string) => <span className="text-sm">{v || '—'}</span> },
    { key: 'district', label: 'District', sortable: true },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'active'} /> },
    { key: 'created_at', label: 'Joined', sortable: true, render: (v: string) => v ? <span className="text-xs text-slate-500">{new Date(v).toLocaleDateString()}</span> : '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold font-heading">User Management</h1><p className="text-sm text-slate-500">Manage all portal users, roles, and access</p></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 shadow-sm"><Upload size={14} /> Import CSV</button>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100 shadow-sm"><Download size={14} /> Export</button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover shadow-sm min-h-[44px]"><UserPlus size={16} /> Add User</button>
        </div>
      </div>

      <DataTable columns={columns} data={users} loading={loading} searchPlaceholder="Search users by name, email, school..."
        onRowClick={openEdit} emptyMessage="No users found" emptyIcon={<Users size={40} />}
        filters={<div className="flex items-center gap-2"><Filter size={14} className="text-slate-500" />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 outline-none text-slate-900" aria-label="Filter by role">
            <option value="">All Roles</option><option value="admin">Admin</option><option value="reviewer">Reviewer</option><option value="functionary">Functionary</option><option value="teacher">Teacher</option>
          </select></div>}
        actions={(row: any) => (
          <div className="flex items-center gap-1">
            <button onClick={e => { e.stopPropagation(); openEdit(row); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary" aria-label="Edit"><Edit2 size={14} /></button>
            <button onClick={e => { e.stopPropagation(); handleDelete(row.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-danger" aria-label="Delete"><Trash2 size={14} /></button>
          </div>)}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editUser ? 'Edit User' : 'Create User'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[{ label: 'Full Name', key: 'name', type: 'text', ph: 'Dr. Rajesh Kumar' }, { label: 'Email', key: 'email', type: 'email', ph: 'user@school.edu' },
            { label: 'Phone', key: 'phone', type: 'tel', ph: '+919876543210' }, { label: 'School Name', key: 'school_name', type: 'text', ph: 'Kendriya Vidyalaya' },
            { label: 'District', key: 'district', type: 'text', ph: 'New Delhi' }, { label: 'Password', key: 'password_hash', type: 'password', ph: editUser ? 'Leave blank to keep' : 'Set password' }]
            .map(f => (<div key={f.key}><label className="text-xs font-semibold text-slate-500 mb-1.5 block">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none focus:border-primary" /></div>))}
          <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none">
              <option value="admin">Admin</option><option value="reviewer">Reviewer</option><option value="functionary">Functionary</option><option value="teacher">Teacher</option></select></div>
          <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none">
              <option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-100">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 bg-primary text-white text-sm rounded-xl font-semibold hover:bg-primary-hover">Save</button>
        </div>
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Bulk Import Users" size="lg">
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-700 font-medium">CSV Format: Name, Email, Phone, Role, School Name, District</p>
            <p className="text-[10px] text-blue-600 mt-1">Example: Sunita Devi, head.kv001@cbss.school.org, +919876543213, functionary, Kendriya Vidyalaya No. 1, New Delhi</p>
          </div>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={8} placeholder="Paste CSV data here..." className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none font-mono resize-none" />
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-100">Cancel</button>
            <button onClick={handleBulkImport} disabled={!importText.trim()} className="px-6 py-2 bg-primary text-white text-sm rounded-xl font-semibold hover:bg-primary-hover disabled:opacity-50">Import</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
