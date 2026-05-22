import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { User } from '../lib/auth';
import { api, API_BASE } from '../lib/api';
import { copyToClipboard, getCleanFileName } from '../lib/utils';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, Send, Link2, Upload, RefreshCw, Trash2, 
  Search, Filter, ChevronRight, School, Inbox, CheckCircle2, 
  Clock, AlertCircle, FileText, Plus, MoreVertical, Printer
} from 'lucide-react';

export default function Nominations({ user }: { user: User }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialFormId = searchParams.get('form_id') || '';
  
  const [nominations, setNominations] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [selectedForm, setSelectedForm] = useState<string>(initialFormId);
  const [addForm, setAddForm] = useState<Record<string, any>>({ teacher_name: '', teacher_email: '', teacher_phone: '', link_type: 'otp' });
  const [bulkText, setBulkText] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedNom, setSelectedNom] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const activeFormObj = forms.find(f => String(f.id) === String(selectedForm));
  const activeSettings = activeFormObj?.settings ? (typeof activeFormObj.settings === 'string' ? JSON.parse(activeFormObj.settings) : activeFormObj.settings) : {};

  const schoolCode = user.school_code || '';
  const isAdmin = user.role === 'admin';

  const fetchData = async () => {
    try {
      setLoading(true);
      let url = '/nominations?';
      if (!isAdmin) url += `functionary_id=${user.id}&`;
      const [n, f] = await Promise.all([
        api.get(url),
        api.get('/forms?status=active')
      ]);
      const nominationForms = f.filter((form: any) => form.form_type === 'nomination');
      setNominations(n); 
      setForms(nominationForms);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (selectedForm) {
      const initial: Record<string, any> = { 
        teacher_name: '', 
        teacher_email: '', 
        teacher_phone: '', 
        link_type: activeSettings.teacher_login || 'otp' 
      };
      if (activeSettings.nomination_custom_fields) {
        activeSettings.nomination_custom_fields.forEach((cf: any) => {
          initial[cf.id] = '';
        });
      }
      setAddForm(initial);
    }
  }, [selectedForm, activeFormObj]);

  const nomsByForm = (formId: string) => nominations.filter(n => n.form_id === formId);

  const handleAddTeacher = async () => {
    if (!selectedForm) return alert('Select a form first');
    if (!addForm.teacher_name) return alert('Teacher name is required');
    if (activeSettings.require_email !== false && !addForm.teacher_email) return alert('Email is required');
    
    try {
      setLoading(true);
      const additional_data: Record<string, any> = {};
      (activeSettings.nomination_custom_fields || []).forEach((cf: any) => {
        additional_data[cf.id] = addForm[cf.id];
      });

      await api.post('/nominations', {
        form_id: selectedForm, 
        functionary_id: user.id, 
        teacher_name: addForm.teacher_name,
        teacher_email: addForm.teacher_email, 
        teacher_phone: addForm.teacher_phone,
        school_code: schoolCode, 
        link_type: addForm.link_type,
        status: 'pending',
        additional_data
      });
      setShowAdd(false); 
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to add teacher');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (nom: any) => {
    const link = `${window.location.origin}/fill/${nom.form_id}?token=${nom.unique_token}&sc=${nom.school_code}`;
    const success = await copyToClipboard(link);
    if (success) alert('Link copied!');
  };

  const sendInvite = async (nom: any) => {
    try {
      await api.put('/nominations', { id: nom.id, status: 'invited', invited_at: new Date().toISOString() });
      fetchData();
    } catch (error) { console.error(error); }
  };

  const columns = [
    { 
      key: 'teacher_name', 
      label: 'Teacher Details', 
      sortable: true, 
      render: (v: string, row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
            {v[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{v}</p>
            <p className="text-[10px] text-slate-400 font-medium">{row.teacher_email}</p>
          </div>
        </div>
      ) 
    },
    { 
      key: 'status', 
      label: 'Submission Status', 
      render: (v: string) => {
        const isSubmitted = ['submitted', 'under_review', 'approved', 'rejected', 'next_level', 'completed'].includes(v);
        return <StatusBadge status={isSubmitted ? 'submitted' : 'pending'} size="xs" />;
      } 
    },
    { 
      key: 'link_type', 
      label: 'Login Method', 
      render: (v: string) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
          {v === 'otp' ? <Clock size={10} /> : <Link2 size={10} />}
          {v}
        </span>
      ) 
    },
    { 
      key: 'invited_at', 
      label: 'Invitation Date', 
      sortable: true, 
      render: (v: string) => v ? (
        <span className="text-[11px] font-medium text-slate-500">
          {new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </span>
      ) : <span className="text-[11px] text-slate-300 italic">Not sent</span>
    },
  ];

  const anim = (i: number) => ({ initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05, duration: 0.4 } });

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-10">
      {/* Modern Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Teacher Nominations</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 rounded-lg border border-primary/10">
              <School size={12} className="text-primary" />
              <span className="text-[11px] font-black text-primary uppercase tracking-wider">{schoolCode}</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">Manage and track your school's nominations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden lg:block">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select 
              value={selectedForm} 
              onChange={e => setSelectedForm(e.target.value)}
              className="pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer appearance-none min-w-[240px]"
            >
              <option value="">All Active Nomination Forms</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
          
          <button 
            onClick={() => setShowAdd(true)} 
            disabled={!selectedForm && forms.length > 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-2xl text-sm font-black hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <UserPlus size={18} />
            <span>Nominate Teacher</span>
          </button>
        </div>
      </div>

      {/* Form Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {forms.filter(f => !selectedForm || f.id === selectedForm).map((f, i) => {
          const noms = nomsByForm(f.id);
          let maxNom = 5;
          try { 
            const s = typeof f.settings === 'string' ? JSON.parse(f.settings) : f.settings; 
            maxNom = s?.nomination_limit || s?.max_nominations || 5; 
          } catch {}
          
          const isSelected = selectedForm === f.id;
          const isFull = noms.length >= maxNom;
          const completed = noms.filter(n => ['submitted', 'under_review', 'approved', 'rejected', 'completed'].includes(n.status)).length;

          return (
            <motion.div 
              key={f.id} 
              {...anim(i)}
              onClick={() => setSelectedForm(isSelected ? '' : f.id)}
              className={`bg-white rounded-[2.5rem] border-2 p-6 shadow-sm cursor-pointer transition-all group relative overflow-hidden ${
                isSelected ? 'border-primary shadow-xl shadow-primary/5' : 'border-slate-100 hover:border-primary/40'
              }`}
            >
              <div className="absolute -right-8 -top-8 w-24 h-24 bg-slate-50 rounded-full blur-2xl group-hover:bg-primary/5 transition-colors" />
              
              <div className="flex items-start justify-between mb-6 relative">
                <div className="max-w-[70%]">
                  <h3 className={`font-black text-sm leading-tight transition-colors ${isSelected ? 'text-primary' : 'text-slate-800 group-hover:text-primary'}`}>
                    {f.title}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Nomination Pool</p>
                </div>
                <div className={`px-3 py-1.5 rounded-xl font-black text-xs ${
                  isFull ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {noms.length}/{maxNom}
                </div>
              </div>
              
              <div className="space-y-4 relative">
                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(noms.length / maxNom) * 100}%` }}
                    className={`h-full rounded-full ${isFull ? 'bg-rose-500' : 'bg-primary'}`} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Completed</span>
                      <span className="text-xs font-black text-slate-700">{completed}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Pending</span>
                      <span className="text-xs font-black text-slate-700">{noms.length - completed}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedForm(f.id);
                      setShowAdd(true);
                    }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isFull && !isAdmin 
                        ? 'bg-slate-50 text-slate-300 cursor-not-allowed' 
                        : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/30 active:scale-90'
                    }`}
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modern Table Section */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users size={18} />
            </div>
            <h2 className="font-black text-slate-800 text-sm">Nominated Teachers</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2.5 text-slate-400 hover:text-primary transition-colors" title="Print List">
              <Printer size={18} />
            </button>
            <button onClick={() => setShowBulk(true)} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">
              Bulk Import
            </button>
          </div>
        </div>

        <DataTable 
          columns={columns} 
          data={nominations.filter(n => !selectedForm || n.form_id === selectedForm)} 
          loading={loading} 
          searchPlaceholder="Quick search teacher or email..."
          onRowClick={(row) => { setSelectedNom(row); setShowDetails(true); }}
          actions={(row: any) => (
            <div className="flex items-center gap-1 justify-end">
              <button 
                onClick={e => { e.stopPropagation(); copyLink(row); }} 
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/5 text-slate-400 hover:text-primary transition-all" 
                title="Copy Token Link"
              >
                <Link2 size={16} />
              </button>
              {row.status === 'pending' && (
                <button 
                  onClick={e => { e.stopPropagation(); sendInvite(row); }} 
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-500 transition-all" 
                  title="Send Invite"
                >
                  <Send size={16} />
                </button>
              )}
              <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-300">
                <MoreVertical size={16} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Details Modal - Modern Styling */}
      <Modal open={showDetails} onClose={() => setShowDetails(false)} title="Nomination Details">
        {selectedNom && (
          <div className="space-y-8 py-2">
            <div className="flex items-center gap-5 p-6 bg-gradient-to-br from-slate-50 to-white rounded-[2rem] border border-slate-100 shadow-inner">
              <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-primary/20">
                {selectedNom.teacher_name?.[0].toUpperCase()}
              </div>
              <div>
                <h3 className="font-black text-xl text-slate-900 tracking-tight">{selectedNom.teacher_name}</h3>
                <p className="text-sm text-slate-500 font-medium">{selectedNom.teacher_email}</p>
                <div className="flex gap-2 mt-2">
                  <StatusBadge status={selectedNom.status} size="xs" />
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[9px] font-black text-slate-500 uppercase">{selectedNom.link_type}</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'School Code', value: selectedNom.school_code, icon: School, mono: true },
                { label: 'Invited Date', value: selectedNom.invited_at ? new Date(selectedNom.invited_at).toLocaleDateString() : 'Pending', icon: Calendar },
                { label: 'Phone Number', value: selectedNom.teacher_phone || 'N/A', icon: Clock },
                { label: 'Reminders', value: `${selectedNom.reminder_count || 0} sent`, icon: RefreshCw }
              ].map((item, idx) => (
                <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 group hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <item.icon size={12} className="text-slate-400" />
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{item.label}</p>
                  </div>
                  <p className={`text-sm font-black text-slate-700 ${item.mono ? 'font-mono' : ''}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {selectedNom.additional_data && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Form Data</h4>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(selectedNom.additional_data).map(([key, val]) => {
                    const customField = activeSettings.nomination_custom_fields?.find((cf: any) => cf.id === key);
                    const label = customField ? customField.label : key;
                    const isFile = customField?.type === 'file';
                    const fileUrl = isFile ? (typeof val === 'string' && val.startsWith('http') ? val : `${API_BASE.replace('/api/v1', '')}/uploads/${val}`) : '';

                    return (
                      <div key={key} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500">{label}</span>
                        {isFile ? (
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-primary hover:bg-primary hover:text-white transition-all flex items-center gap-2 shadow-sm">
                            <Link2 size={12} /> View File
                          </a>
                        ) : (
                          <span className="text-xs font-black text-slate-800">{String(val)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button onClick={() => setShowDetails(false)} className="px-6 py-2.5 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-colors">Close</button>
              {selectedNom.status === 'pending' && (
                <button 
                  onClick={() => { sendInvite(selectedNom); setShowDetails(false); }} 
                  className="px-8 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  <Send size={14} /> Send Invitation
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Teacher Modal - Modern Styling */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Nomination">
        <div className="space-y-6 py-2">
          {!selectedForm ? (
            <div className="p-8 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
              <FileText size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500">Please select a form from the dashboard first</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teacher Full Name</label>
                  <input 
                    type="text" 
                    value={addForm.teacher_name} 
                    onChange={e => setAddForm(p => ({ ...p, teacher_name: e.target.value }))} 
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-inner" 
                    placeholder="Enter full name..." 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <input 
                    type="email" 
                    value={addForm.teacher_email} 
                    onChange={e => setAddForm(p => ({ ...p, teacher_email: e.target.value }))} 
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-inner" 
                    placeholder="teacher@school.edu" 
                  />
                </div>

                {activeSettings.nomination_custom_fields?.map((cf: any) => (
                  <div key={cf.id} className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{cf.label}</label>
                    <input 
                      type="text" 
                      value={addForm[cf.id]} 
                      onChange={e => setAddForm(p => ({ ...p, [cf.id]: e.target.value }))} 
                      className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-inner" 
                      placeholder={`Enter ${cf.label.toLowerCase()}...`} 
                    />
                  </div>
                ))}
              </div>

              <div className="bg-primary/5 p-5 rounded-[2rem] border border-primary/10 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-primary uppercase tracking-wider mb-1">Automatic Enrollment</h4>
                  <p className="text-[11px] text-primary/70 font-medium leading-relaxed">School code <span className="font-black underline">{schoolCode}</span> will be attached. A secure access link will be sent to the teacher instantly.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => setShowAdd(false)} className="px-6 py-2.5 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl">Cancel</button>
                <button 
                  onClick={handleAddTeacher} 
                  disabled={loading} 
                  className="px-8 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>Add Nomination</span>
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
