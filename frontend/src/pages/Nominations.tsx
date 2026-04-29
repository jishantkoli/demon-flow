import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { User } from '../lib/auth';
import { api, API_BASE } from '../lib/api';
import { copyToClipboard } from '../lib/utils';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { UserPlus, Send, Copy, Link2, Upload, RefreshCw, QrCode, MessageSquare, Trash2 } from 'lucide-react';

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

  const handleFileUpload = async (fieldId: string, file: File) => {
    try {
      console.log('Starting upload for', fieldId, file.name);
      setUploading(fieldId);
      
      const data = await api.upload('/uploads', file);
      console.log('Upload success:', data);
      
      setAddForm(p => ({ ...p, [fieldId]: data.url || data.filename }));
    } catch (err: any) {
      console.error('FileUpload error:', err);
      alert(err.message || 'Failed to upload file');
    } finally {
      setUploading(null);
    }
  };
  const [selectedNom, setSelectedNom] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const activeFormObj = forms.find(f => String(f.id) === String(selectedForm));
  const activeSettings = activeFormObj?.settings ? (typeof activeFormObj.settings === 'string' ? JSON.parse(activeFormObj.settings) : activeFormObj.settings) : {};

  const schoolCode = user.school_code || (user.email?.match(/^head\.([a-z0-9]+)@/i)?.[1]?.toUpperCase()) || '';
  const isAdmin = user.role === 'admin';

  const fetchData = async () => {
    try {
      let url = '/nominations?';
      if (!isAdmin) url += `functionary_id=${user.id}&`;
      const [n, f] = await Promise.all([
        api.get(url),
        api.get('/forms?status=active')
      ]);
      // Only show forms that have nomination mode ON (form_type === 'nomination')
      const nominationForms = f.filter((form: any) => form.form_type === 'nomination');
      setNominations(n); 
      setForms(nominationForms);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  // Reset addForm when selectedForm changes to ensure we have the right fields
  useEffect(() => {
    if (selectedForm) {
      const initial: Record<string, any> = { teacher_name: '', teacher_email: '', teacher_phone: '', link_type: activeSettings.teacher_login || 'otp' };
      if (activeSettings.nomination_custom_fields) {
        activeSettings.nomination_custom_fields.forEach((cf: any) => {
          initial[cf.id] = '';
        });
      }
      setAddForm(initial);
    }
  }, [selectedForm, activeFormObj]);

  // Smart filter: if form_id is provided but no nominations exist for it, show all
  useEffect(() => {
    if (initialFormId && nominations.length > 0) {
      const hasNomsForForm = nominations.some(n => n.form_id === initialFormId);
      if (!hasNomsForForm) {
        setSelectedForm('');
      }
    }
  }, [nominations, initialFormId]);

  const nomsByForm = (formId: string) => nominations.filter(n => n.form_id === formId);

  const handleAddTeacher = async () => {
    if (!selectedForm) return alert('Select a form first');
    
    // Validation
    if (!addForm.teacher_name) return alert('Teacher name is required');
    if (activeSettings.require_email !== false && !addForm.teacher_email) return alert('Email is required');
    if (activeSettings.require_phone && !addForm.teacher_phone) return alert('Phone number is required');
    
    const customFields = activeSettings.nomination_custom_fields || [];
    for (const cf of customFields) {
      if (cf.required && !addForm[cf.id]) return alert(`${cf.label} is required`);
    }
    
    try {
      setLoading(true);
      // Construct additional data from custom fields
      const additional_data: Record<string, any> = {};
      customFields.forEach((cf: any) => {
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
        additional_data // Send custom fields in additional_data
      });
      setShowAdd(false); 
      alert('Teacher nominated successfully! Email link has been sent.');
      fetchData();
      setAddForm({ teacher_name: '', teacher_email: '', teacher_phone: '', link_type: 'otp' });
      // Redirect back to forms if we came from there
      if (initialFormId) {
        setTimeout(() => navigate('/forms'), 1000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add teacher');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!selectedForm) return alert('Select a form first');
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return alert('No data provided');

    try {
      setLoading(true);
      const nomList = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return { form_id: selectedForm, functionary_id: user.id, teacher_name: parts[0], teacher_email: parts[1], teacher_phone: parts[2] || '', school_code: schoolCode, link_type: 'otp', status: 'pending' };
      });
      await api.post('/nominations', { action: 'bulk-nominate', nominations: nomList });
      setShowBulk(false); setBulkText(''); 
      fetchData();
      // Redirect back to forms if we came from there
      if (initialFormId) {
        setTimeout(() => navigate('/forms'), 1000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to bulk import teachers');
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async (nom: any) => {
    try {
      await api.put('/nominations', { id: nom.id, status: 'invited', invited_at: new Date().toISOString() });
      alert(`Invitation sent to ${nom.teacher_name}! (simulated)`);
      fetchData();
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert('Failed to send invitation. Please try again.');
    }
  };

  const resendInvite = async (nom: any) => {
    try {
      await api.put('/nominations', { id: nom.id, reminder_count: (nom.reminder_count || 0) + 1, last_reminder_at: new Date().toISOString() });
      alert(`Reminder sent to ${nom.teacher_name}! (simulated)`);
      fetchData();
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      alert('Failed to resend invitation. Please try again.');
    }
  };

  const copyLink = async (nom: any) => {
    const link = `${window.location.origin}/fill/${nom.form_id}?token=${nom.unique_token}&sc=${nom.school_code}`;
    const success = await copyToClipboard(link);
    if (success) alert('Link copied!');
    else alert('Failed to copy link. Please select and copy manually.');
  };

  const columns = [
    { key: 'teacher_name', label: 'Teacher', sortable: true, render: (v: string, row: any) => (
      <div><p className="font-medium text-sm">{v}</p><p className="text-[10px] text-slate-500">{row.teacher_email}</p></div>) },
    { key: 'school_code', label: 'School', render: (v: string) => <span className="text-xs font-mono font-bold text-primary">{v}</span> },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'link_type', label: 'Access', render: (v: string) => <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">{v}</span> },
    { key: 'reminder_count', label: 'Reminders', render: (v: number) => <span className="text-xs text-slate-500">{v || 0} sent</span> },
    { key: 'invited_at', label: 'Invited', sortable: true, render: (v: string) => v ? <span className="text-xs text-slate-500">{new Date(v).toLocaleDateString()}</span> : '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold font-heading">Nominations</h1>
          <p className="text-sm text-slate-500">Manage teacher nominations for school <span className="font-bold text-primary">{schoolCode}</span></p></div>
        <div className="flex items-center gap-2">
          <select value={selectedForm} onChange={e => setSelectedForm(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all min-w-[200px]">
            <option value="">All Active Forms</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>
          <button onClick={() => setShowBulk(true)} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-100"><Upload size={14} /> CSV Import</button>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover min-h-[44px]"><UserPlus size={16} /> Add Teacher</button>
        </div>
      </div>

      {/* Nomination Limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.filter(f => !selectedForm || f.id === selectedForm).map(f => {
          const noms = nomsByForm(f.id);
          let maxNom = 5;
          try { 
            const s = typeof f.settings === 'string' ? JSON.parse(f.settings) : f.settings; 
            maxNom = s?.nomination_limit || s?.max_nominations || 5; 
          } catch {}
          
          const isSelected = selectedForm === f.id;
          const isFull = noms.length >= maxNom;

          return (
            <div 
              key={f.id} 
              onClick={() => setSelectedForm(isSelected ? '' : f.id)}
              className={`bg-white rounded-2xl border-2 p-4 shadow-sm cursor-pointer transition-all group ${
                isSelected ? 'border-primary ring-2 ring-primary/10' : 'border-slate-200 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-bold transition-colors ${isSelected ? 'text-primary' : 'group-hover:text-primary'}`}>
                  {f.title}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isFull ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                }`}>
                  {noms.length}/{maxNom}
                </span>
              </div>
              
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-green-500'}`} 
                  style={{ width: `${Math.min((noms.length / maxNom) * 100, 100)}%` }} 
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-3 text-[10px] text-slate-500">
                  <span title="Completed">✓ {noms.filter(n => n.status === 'completed').length}</span>
                  <span title="In Progress">○ {noms.filter(n => n.status === 'in_progress' || n.status === 'invited').length}</span>
                </div>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedForm(f.id);
                    setShowAdd(true);
                  }}
                  disabled={isFull && !isAdmin}
                  className={`text-[10px] font-bold px-3 py-1 rounded-lg transition-all ${
                    isFull && !isAdmin 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-primary text-white hover:bg-primary-hover shadow-sm hover:shadow-md'
                  }`}
                >
                  {isFull && !isAdmin ? 'Limit Reached' : '+ Nominate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <DataTable columns={columns} data={nominations.filter(n => !selectedForm || n.form_id === selectedForm)} loading={loading} searchPlaceholder="Search teachers..."
        onRowClick={(row) => { setSelectedNom(row); setShowDetails(true); }}
        actions={(row: any) => (
          <div className="flex items-center gap-1">
            <button onClick={e => { e.stopPropagation(); copyLink(row); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary" title="Copy Link"><Link2 size={14} /></button>
            {row.status === 'pending' && <button onClick={e => { e.stopPropagation(); sendInvite(row); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-green-500" title="Send Invitation"><Send size={14} /></button>}
            {row.status === 'invited' && <button onClick={e => { e.stopPropagation(); resendInvite(row); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-amber-500" title="Resend"><RefreshCw size={14} /></button>}
          </div>)}
      />

      {/* Details Modal */}
      <Modal open={showDetails} onClose={() => setShowDetails(false)} title="Nomination Details">
        {selectedNom && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">{selectedNom.teacher_name?.[0]}</div>
              <div>
                <h3 className="font-bold text-lg">{selectedNom.teacher_name}</h3>
                <p className="text-sm text-slate-500">{selectedNom.teacher_email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Status</p>
                <StatusBadge status={selectedNom.status} />
              </div>
              <div className="p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Access Type</p>
                <p className="text-sm font-semibold capitalize">{selectedNom.link_type}</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">School Code</p>
                <p className="text-sm font-semibold font-mono">{selectedNom.school_code}</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Invited At</p>
                <p className="text-sm font-semibold">{selectedNom.invited_at ? new Date(selectedNom.invited_at).toLocaleDateString() : 'Not Invited'}</p>
              </div>
              {selectedNom.teacher_phone && (
                <div className="p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Phone</p>
                  <p className="text-sm font-semibold">{selectedNom.teacher_phone}</p>
                </div>
              )}
              {selectedNom.additional_data && Object.entries(selectedNom.additional_data).map(([key, val]) => {
                const customField = activeSettings.nomination_custom_fields?.find((cf: any) => cf.id === key);
                const label = customField ? customField.label : (key.charAt(0).toUpperCase() + key.slice(1));
                const isFile = customField?.type === 'file' || (typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val));
                // Cloudinary returns full https:// URLs; fallback for legacy local filenames
                const fileUrl = isFile ? (typeof val === 'string' && val.startsWith('http') ? val as string : `${API_BASE.replace('/api/v1', '')}/uploads/${encodeURIComponent(val as string)}`) : '';

                return (
                  <div key={key} className="p-3 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">{label}</p>
                    {isFile ? (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 mt-1">
                        <Link2 size={12} /> View File
                      </a>
                    ) : (
                      <p className="text-sm font-semibold">{String(val)}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowDetails(false)} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-100">Close</button>
              {selectedNom.status === 'pending' && (
                <button onClick={() => { sendInvite(selectedNom); setShowDetails(false); }} className="px-6 py-2 bg-primary text-white text-sm rounded-xl font-semibold hover:bg-primary-hover flex items-center gap-2">
                  <Send size={14} /> Send Invitation
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Teacher Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Teacher Nomination">
        <div className="space-y-4">
          {!selectedForm && (
            <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Select Form First</label>
              <select value={selectedForm} onChange={e => setSelectedForm(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none">
                <option value="">Choose a form...</option>
                {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select></div>
          )}

          {selectedForm && (
             <>
               <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Teacher Name *</label>
                 <input type="text" value={addForm.teacher_name} onChange={e => setAddForm(p => ({ ...p, teacher_name: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none" placeholder="Full name" /></div>
               
               <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Email {activeSettings.require_email !== false ? '*' : ''}</label>
                 <input type="email" value={addForm.teacher_email} onChange={e => setAddForm(p => ({ ...p, teacher_email: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none" placeholder="teacher@email.com" /></div>
               
               {activeSettings.require_phone && (
                  <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Phone *</label>
                    <input type="tel" value={addForm.teacher_phone} onChange={e => setAddForm(p => ({ ...p, teacher_phone: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none" placeholder="+91..." /></div>
                )}

                {/* Custom Fields */}
                {((activeSettings.nomination_custom_fields as any[]) || []).map((cf: any) => (
                  <div key={cf.id}><label className="text-xs font-semibold text-slate-500 mb-1.5 block">{cf.label} {cf.required ? '*' : ''}</label>
                    {cf.type === 'dropdown' ? (
                      <select value={addForm[cf.id]} onChange={e => setAddForm(p => ({ ...p, [cf.id]: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none">
                        <option value="">Select Option</option>
                        {(cf.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : cf.type === 'radio' ? (
                      <div className="flex flex-wrap gap-3 mt-1">
                        {(cf.options || []).map((o: string) => (
                          <label key={o} className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name={cf.id} checked={addForm[cf.id] === o} onChange={() => setAddForm(p => ({ ...p, [cf.id]: o }))} className="w-4 h-4 accent-primary" />
                            <span className="text-sm">{o}</span>
                          </label>
                        ))}
                      </div>
                    ) : cf.type === 'checkbox' ? (
                      <div className="flex flex-wrap gap-3 mt-1">
                        {(cf.options || []).map((o: string) => {
                          const values = (addForm[cf.id] || '').split(',').map((v: string) => v.trim()).filter(Boolean);
                          const checked = values.includes(o);
                          return (
                            <label key={o} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={checked} onChange={() => {
                                const newValues = checked ? values.filter((v: string) => v !== o) : [...values, o];
                                setAddForm(p => ({ ...p, [cf.id]: newValues.join(', ') }));
                              }} className="w-4 h-4 rounded accent-primary" />
                              <span className="text-sm">{o}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : cf.type === 'textarea' ? (
                      <textarea value={addForm[cf.id]} onChange={e => setAddForm(p => ({ ...p, [cf.id]: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none resize-none" placeholder={cf.label} />
                    ) : cf.type === 'file' ? (
                      <div className="mt-1">
                        {(() => {
                          const inputId = `nom-file-${cf.id}`;
                          return (
                            <>
                        <input
                          id={inputId}
                          key={inputId}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(cf.id, file);
                            // Do NOT reset e.currentTarget.value here as it might interfere with some browsers
                          }}
                        />
                        {addForm[cf.id] ? (
                          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                            <span className="text-xs flex-1 truncate font-medium">File Uploaded: {String(addForm[cf.id]).split('/').pop()}</span>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddForm(p => ({ ...p, [cf.id]: '' })); }} className="p-1 text-rose-500 hover:bg-rose-100 rounded-md transition-colors"><Trash2 size={12} /></button>
                          </div>
                        ) : (
                          <label 
                            htmlFor={inputId}
                            onClick={(e) => {
                              // If label click doesn't work, we can manually trigger input
                              // but htmlFor should work fine if ID is unique.
                              console.log('Label clicked for', inputId);
                            }}
                            className="block border border-dashed border-slate-300 rounded-xl p-3 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                          >
                            {uploading === cf.id ? (
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                            ) : (
                              <Upload size={16} className="mx-auto text-slate-400 mb-1" />
                            )}
                            <p className="text-[10px] text-slate-500">{uploading === cf.id ? 'Uploading...' : 'Click to upload file'}</p>
                          </label>
                        )}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <input type={cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'} value={addForm[cf.id]} onChange={e => setAddForm(p => ({ ...p, [cf.id]: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none" />
                    )}</div>
                ))}

                {isAdmin && (
                 <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Access Type</label>
                   <select value={addForm.link_type} onChange={e => setAddForm(p => ({ ...p, link_type: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none">
                     <option value="otp">OTP Required</option><option value="direct">Direct Link (No Login)</option></select></div>
               )}
             </>
           )}
          
          <p className="text-[10px] text-slate-500">School code <span className="font-bold">{schoolCode}</span> will be auto-attached. Teacher account auto-created if new.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-100">Cancel</button>
            <button onClick={handleAddTeacher} disabled={loading || !selectedForm} className="px-6 py-2 bg-primary text-white text-sm rounded-xl font-semibold hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Adding...' : 'Add & Send Link'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Import */}
      <Modal open={showBulk} onClose={() => setShowBulk(false)} title="Bulk Import Teachers" size="lg">
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-700 font-medium">CSV Format: Teacher Name, Email, Phone (optional)</p>
            <p className="text-[10px] text-blue-600 mt-1">Example: Anita Singh, anita@school.edu, +919876543216</p>
          </div>
          <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={8} placeholder="Paste CSV data..." className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none font-mono resize-none" />
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowBulk(false)} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-100">Cancel</button>
            <button onClick={handleBulkAdd} disabled={!bulkText.trim()} className="px-6 py-2 bg-primary text-white text-sm rounded-xl font-semibold hover:bg-primary-hover disabled:opacity-50">Import Teachers</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
