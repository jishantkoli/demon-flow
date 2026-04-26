import React, { useState, useEffect } from 'react';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { CheckCircle, XCircle, Clock, Filter, Layers, Save, Star } from 'lucide-react';

export default function Reviews({ user }: { user: User }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [overallScore, setOverallScore] = useState<number>(0);
  const [grade, setGrade] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [levelForm, setLevelForm] = useState({ form_id: 0, name: '', level_number: 1, scoring_type: 'form_level', blind_review: false, grade_scale: 'A,B,C,D', reviewer_ids: '', filter_criteria: '' });
  const [tab, setTab] = useState<'pending' | 'completed'>('pending');
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      let rUrl = '/reviews?';
      if (user.role === 'reviewer') rUrl += `reviewer_id=${user.id}&`;
      if (statusFilter) rUrl += `status=${statusFilter}&`;
      const [r, s, l, u, f] = await Promise.all([
        api.get(rUrl), api.get('/submissions'), api.get('/review-levels'),
        api.get('/users?role=reviewer'), api.get('/forms')
      ]);
      setReviews(r); setSubmissions(s); setLevels(l); setReviewers(u); setForms(f);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, [statusFilter]);

  const filteredReviews = reviews.filter(r => tab === 'pending' ? r.status === 'pending' : r.status !== 'pending');
  const getSub = (subId: number) => submissions.find(s => s.id === subId);

  const openReview = (review: any) => {
    setSelected(review);
    const sub = getSub(review.submission_id);
    setSelectedSub(sub);
    setReviewComment(review.comments || '');
    setOverallScore(0); setGrade(''); setRecommendation('');
  };

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!selected) return;
    await api.put('/reviews', { id: selected.id, status: action, comments: reviewComment });
    await api.put('/submissions', { id: selected.submission_id, status: action });
    await api.post('/review-scores', {
      review_id: selected.id, submission_id: selected.submission_id, reviewer_id: user.id,
      level_id: selected.level, overall_score: overallScore, grade, comments: reviewComment,
      recommendation, is_draft: false
    });
    await api.post('/audit-logs', { user_id: user.id, action: 'review', details: JSON.stringify({ submission_id: selected.submission_id, decision: action, score: overallScore, grade }) });
    setSelected(null); fetchData();
  };

  const saveDraft = async () => {
    if (!selected) return;
    await api.post('/review-scores', {
      review_id: selected.id, submission_id: selected.submission_id, reviewer_id: user.id,
      level_id: selected.level, overall_score: overallScore, grade, comments: reviewComment,
      recommendation, is_draft: true
    });
    alert('Draft saved!');
  };

  const createLevel = async () => {
    await api.post('/review-levels', {
      form_id: levelForm.form_id, level_number: levelForm.level_number, name: levelForm.name,
      scoring_type: levelForm.scoring_type, blind_review: levelForm.blind_review,
      grade_scale: levelForm.grade_scale.split(',').map(s => s.trim()),
      reviewer_ids: levelForm.reviewer_ids.split(',').map(s => parseInt(s.trim())).filter(Boolean),
      filter_criteria: levelForm.filter_criteria ? JSON.parse(levelForm.filter_criteria) : {}
    });
    setShowLevelModal(false); fetchData();
  };

  let subResponses: Record<string, any> = {};
  if (selectedSub?.responses) { try { subResponses = typeof selectedSub.responses === 'string' ? JSON.parse(selectedSub.responses) : selectedSub.responses; } catch {} }

  const pendingCount = reviews.filter(r => r.status === 'pending').length;
  const approvedCount = reviews.filter(r => r.status === 'approved').length;
  const rejectedCount = reviews.filter(r => r.status === 'rejected').length;

  const columns = [
    { key: 'id', label: '#', sortable: true, render: (v: number) => <span className="text-xs font-mono text-slate-500">#{v}</span> },
    { key: 'submission_id', label: 'Submission', sortable: true, render: (v: number) => { const sub = getSub(v); return <span className="text-sm font-medium">{sub?.form_title || `#${v}`}</span>; } },
    { key: 'reviewer_name', label: 'Reviewer', sortable: true },
    { key: 'level', label: 'Level', render: (v: number) => <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">L{v}</span> },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'created_at', label: 'Assigned', sortable: true, render: (v: string) => v ? <span className="text-xs text-slate-500">{new Date(v).toLocaleDateString()}</span> : '\u2014' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold font-heading">{user.role === 'reviewer' ? 'My Reviews' : 'Review System'}</h1>
          <p className="text-sm text-slate-500">Multi-level review pipeline with scoring and grading</p></div>
        {user.role === 'admin' && <button onClick={() => setShowLevelModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover shadow-sm min-h-[44px]"><Layers size={16} /> Create Level</button>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
          <Clock size={20} className="mx-auto text-amber-500 mb-1" /><p className="text-xl font-bold">{pendingCount}</p><p className="text-xs text-amber-600">Pending</p></div>
        <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
          <CheckCircle size={20} className="mx-auto text-emerald-500 mb-1" /><p className="text-xl font-bold">{approvedCount}</p><p className="text-xs text-emerald-600">Approved</p></div>
        <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
          <XCircle size={20} className="mx-auto text-red-500 mb-1" /><p className="text-xl font-bold">{rejectedCount}</p><p className="text-xs text-red-600">Rejected</p></div>
      </div>

      {/* Review Levels */}
      {user.role === 'admin' && levels.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold font-heading text-sm mb-3 flex items-center gap-2"><Layers size={14} className="text-primary" /> Review Levels</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {levels.map(l => (
              <div key={l.id} className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">L{l.level_number}: {l.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-semibold">{l.scoring_type?.replace('_', ' ')}</span>
                </div>
                <p className="text-[10px] text-slate-500">Form #{l.form_id} \u00b7 {l.blind_review ? 'Blind' : 'Open'} review</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['pending', 'completed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
            {t} ({reviews.filter(r => t === 'pending' ? r.status === 'pending' : r.status !== 'pending').length})
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={filteredReviews} loading={loading} searchPlaceholder="Search reviews..." onRowClick={openReview} />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Review #${selected?.id || ''}`} size="xl">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[{ label: 'Submission', value: `#${selected.submission_id}` }, { label: 'Level', value: `Level ${selected.level}` },
                { label: 'Status', value: selected.status, badge: true }, { label: 'Reviewer', value: selected.reviewer_name }]
                .map((m, i) => (<div key={i} className="bg-slate-100 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase font-semibold">{m.label}</p>
                  {m.badge ? <div className="mt-0.5"><StatusBadge status={m.value} /></div> : <p className="text-sm font-bold mt-0.5">{m.value}</p>}</div>))}
            </div>

            {selectedSub && Object.keys(subResponses).length > 0 && (
              <div><h4 className="text-sm font-bold mb-2">Submission Responses</h4>
                <div className="bg-slate-100 rounded-xl p-4 space-y-2">
                  {Object.entries(subResponses).map(([key, val]) => (
                    <div key={key} className="flex flex-col sm:flex-row gap-1 py-1 border-b border-slate-200 last:border-0">
                      <span className="text-xs font-semibold text-slate-500 min-w-[160px]">{key}:</span>
                      <span className="text-sm">{Array.isArray(val) ? (val as any[]).join(', ') : String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.status === 'pending' && (user.role === 'admin' || user.role === 'reviewer') && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Overall Score (0-100)</label>
                    <input type="number" min={0} max={100} value={overallScore} onChange={e => setOverallScore(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none focus:border-primary" /></div>
                  <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Grade</label>
                    <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none">
                      <option value="">Select Grade</option><option value="A">A - Excellent</option><option value="B">B - Good</option><option value="C">C - Average</option><option value="D">D - Below Average</option></select></div>
                  <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Recommendation</label>
                    <select value={recommendation} onChange={e => setRecommendation(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none">
                      <option value="">Select</option><option value="approve">Approve</option><option value="reject">Reject</option><option value="next_level">Promote to Next Level</option><option value="revise">Request Revision</option></select></div>
                </div>
                <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Review Comments</label>
                  <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none h-24 resize-none" placeholder="Add detailed review comments..." /></div>
                <div className="flex gap-3">
                  <button onClick={saveDraft} className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-white flex items-center gap-2 min-h-[44px]"><Save size={14} /> Save Draft</button>
                  <button onClick={() => handleAction('approved')} className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 flex items-center justify-center gap-2 min-h-[44px]"><CheckCircle size={16} /> Approve</button>
                  <button onClick={() => handleAction('rejected')} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 flex items-center justify-center gap-2 min-h-[44px]"><XCircle size={16} /> Reject</button>
                </div>
              </>
            )}
            {selected.status !== 'pending' && <div className="text-center py-6"><StatusBadge status={selected.status} /><p className="text-xs text-slate-500 mt-2">Review completed</p></div>}
          </div>
        )}
      </Modal>

      <Modal open={showLevelModal} onClose={() => setShowLevelModal(false)} title="Create Review Level" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Form</label>
              <select value={levelForm.form_id} onChange={e => setLevelForm(p => ({ ...p, form_id: parseInt(e.target.value) }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none">
                <option value={0}>Select Form</option>{forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Level Number</label>
              <input type="number" value={levelForm.level_number} onChange={e => setLevelForm(p => ({ ...p, level_number: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none" /></div>
            <div className="col-span-2"><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Level Name</label>
              <input type="text" value={levelForm.name} onChange={e => setLevelForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none" placeholder='e.g. "Level 1 - High Scorers"' /></div>
            <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Scoring Type</label>
              <select value={levelForm.scoring_type} onChange={e => setLevelForm(p => ({ ...p, scoring_type: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none">
                <option value="form_level">Form Level</option><option value="question_level">Question Level</option></select></div>
            <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Grade Scale (comma-separated)</label>
              <input type="text" value={levelForm.grade_scale} onChange={e => setLevelForm(p => ({ ...p, grade_scale: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none" /></div>
            <div><label className="text-xs font-semibold text-slate-500 mb-1.5 block">Reviewer IDs (comma-separated)</label>
              <input type="text" value={levelForm.reviewer_ids} onChange={e => setLevelForm(p => ({ ...p, reviewer_ids: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none" placeholder="e.g. 2,3,14" /></div>
            <div><label className="flex items-center gap-2 text-xs font-semibold text-slate-500"><input type="checkbox" checked={levelForm.blind_review} onChange={e => setLevelForm(p => ({ ...p, blind_review: e.target.checked }))} className="rounded accent-primary" /> Blind Review</label></div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowLevelModal(false)} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-100">Cancel</button>
            <button onClick={createLevel} className="px-6 py-2 bg-primary text-white text-sm rounded-xl font-semibold hover:bg-primary-hover">Create Level</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
