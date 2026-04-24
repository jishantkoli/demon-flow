import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { motion } from 'framer-motion';
import {
  CheckCircle, XCircle, Clock, Filter, Layers, Save, Star, BarChart3,
  Users, ChevronRight, Eye, ArrowRight, Award, TrendingUp, UserCheck,
  Zap, FileText
} from 'lucide-react';

export default function ReviewSystem({ user }: { user: User }) {
  const navigate = useNavigate();
  const [forms, setForms] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [shortlistData, setShortlistData] = useState<any>(null);
  const [levels, setLevels] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Shortlist creation
  const [showCreateLevel, setShowCreateLevel] = useState(false);
  const [showShortlist, setShowShortlist] = useState(false);
  const [levelForm, setLevelForm] = useState({ name: '', level_number: 1, scoring_type: 'form_level', grade_scale: 'A,B,C,D', blind_review: false, reviewer_ids: [] as string[] });
  const [shortlistFilter, setShortlistFilter] = useState({ filter_type: 'all', filter_value: '0', source_level_id: '', field_id: '', field_value: '' });
  const [shortlistResult, setShortlistResult] = useState<any>(null);

  // Reviewer modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [overallScore, setOverallScore] = useState(0);
  const [grade, setGrade] = useState('');
  const [recommendation, setRecommendation] = useState('');

  // Profile detail
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Tab for reviewer
  const [reviewTab, setReviewTab] = useState<'pending' | 'completed'>('pending');

  useEffect(() => {
    Promise.all([api.get('/forms'), api.get('/users?role=reviewer'), api.get('/review-levels')])
      .then(([f, u, l]) => { setForms(f.filter((fm: any) => fm.status === 'active' || fm.status === 'expired')); setReviewers(u); setLevels(l); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  // Load reviews for reviewer
  useEffect(() => {
    if (user.role === 'reviewer') {
      api.get(`/reviews?reviewer_id=${user.id}`).then(setReviews).catch(console.error);
    }
  }, [user]);

  const loadFormData = async (formId: string) => {
    setSelectedFormId(formId);
    setLoadingSubs(true);
    try {
      const data = await api.get(`/shortlist?form_id=${formId}`);
      setShortlistData(data);
      const lvls = await api.get(`/review-levels?form_id=${formId}`);
      setLevels(lvls);
    } catch (err) { console.error(err); }
    finally { setLoadingSubs(false); }
  };

  const openProfile = async (submissionId: string) => {
    setProfileLoading(true); setShowProfile(true);
    try {
      const data = await api.get(`/shortlist?submission_id=${submissionId}`);
      setProfileData(data);
    } catch (err) { console.error(err); }
    finally { setProfileLoading(false); }
  };

  const createLevel = async () => {
    if (!selectedFormId || !levelForm.name) return alert('Fill all fields');
    await api.post('/review-levels', {
      form_id: selectedFormId, level_number: levelForm.level_number, name: levelForm.name,
      scoring_type: levelForm.scoring_type, blind_review: levelForm.blind_review,
      grade_scale: levelForm.grade_scale.split(',').map((s: string) => s.trim()),
      reviewer_ids: levelForm.reviewer_ids
    });
    setShowCreateLevel(false);
    loadFormData(selectedFormId);
  };

  const createShortlist = async () => {
    if (!selectedFormId || levelForm.reviewer_ids.length === 0) return alert('Select reviewers');
    // Find or create the level
    let levelId = levels.find((l: any) => l.level_number === levelForm.level_number)?.id;
    if (!levelId) {
      const newLevel = await api.post('/review-levels', {
        form_id: selectedFormId, level_number: levelForm.level_number, name: levelForm.name || `Level ${levelForm.level_number}`,
        scoring_type: levelForm.scoring_type, blind_review: levelForm.blind_review,
        grade_scale: levelForm.grade_scale.split(',').map((s: string) => s.trim()),
        reviewer_ids: levelForm.reviewer_ids
      });
      levelId = newLevel.id;
    }
    const result = await api.post('/shortlist', {
      action: 'create-shortlist', form_id: selectedFormId, level_id: levelId,
      filter_type: shortlistFilter.filter_type, filter_value: shortlistFilter.filter_value, field_id: shortlistFilter.field_id, field_value: shortlistFilter.field_value,
      source_level_id: shortlistFilter.source_level_id, reviewer_ids: levelForm.reviewer_ids
    });
    setShortlistResult(result);
    loadFormData(selectedFormId);
  };

  // Reviewer: open review
  const openReview = async (review: any) => {
    setSelectedReview(review);
    try {
      const sub = await api.get(`/submissions?id=${review.submission_id}`);
      setSelectedSub(sub);
    } catch {}
    setReviewComment(review.comments || '');
    setOverallScore(0); setGrade(''); setRecommendation('');
    setShowReviewModal(true);
  };

  const submitReview = async (action: 'approved' | 'rejected') => {
    if (!selectedReview) return;
    await api.put('/reviews', { id: selectedReview.id, status: action, comments: reviewComment });
    await api.put('/submissions', { id: selectedReview.submission_id, status: action });
    // Find the level for this review
    const levelId = levels.find((l: any) => l.level_number === selectedReview.level)?.id;
    await api.post('/review-scores', {
      review_id: selectedReview.id, submission_id: selectedReview.submission_id, reviewer_id: user.id,
      level_id: levelId, overall_score: overallScore, grade, comments: reviewComment,
      recommendation, is_draft: false
    });
    setShowReviewModal(false);
    if (user.role === 'reviewer') {
      setReviews(await api.get(`/reviews?reviewer_id=${user.id}`));
    }
    if (selectedFormId) loadFormData(selectedFormId);
  };

  const saveDraft = async () => {
    if (!selectedReview) return;
    const levelId = levels.find((l: any) => l.level_number === selectedReview.level)?.id;
    await api.post('/review-scores', {
      review_id: selectedReview.id, submission_id: selectedReview.submission_id, reviewer_id: user.id,
      level_id: levelId, overall_score: overallScore, grade, comments: reviewComment,
      recommendation, is_draft: true
    });
    alert('Draft saved!');
  };

  let subResponses: Record<string, any> = {};
  if (selectedSub?.responses) { try { subResponses = typeof selectedSub.responses === 'string' ? JSON.parse(selectedSub.responses) : selectedSub.responses; } catch {} }

  // ═══════════ ADMIN VIEW ═══════════
  if (user.role === 'admin') {
    const subs = shortlistData?.submissions || [];
    const formLevels = shortlistData?.levels || [];

    const subColumns = [
      { key: 'user_name', label: 'Name', sortable: true, render: (v: string, r: any) => (
        <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{(v||'?')[0]}</div>
          <div><p className="text-sm font-medium">{v || 'Anonymous'}</p><p className="text-[10px] text-slate-500 dark:text-slate-400">{r.user_email}</p></div></div>) },
      { key: 'score', label: 'Form Score', sortable: true, render: (v: any) => v != null ? <span className="font-bold text-sm text-primary">{v}%</span> : <span className="text-slate-500 dark:text-slate-400">—</span> },
      ...formLevels.map((l: any) => ({
        key: `level_${l.level_number}`, label: `L${l.level_number} Avg`, sortable: true,
        render: (_: any, r: any) => {
          const avg = r.level_averages?.[`level_${l.level_number}`];
          return avg != null ? <span className="font-bold text-sm">{avg}</span> : <span className="text-slate-500 dark:text-slate-400 text-xs">—</span>;
        }
      })),
      { key: 'highest_level', label: 'Reached', sortable: true, render: (v: number) => v > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">L{v}</span> : <span className="text-slate-500 dark:text-slate-400 text-xs">—</span> },
      { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h1 className="text-xl font-bold font-heading">Review & Shortlisting</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Select form → view submissions → shortlist → assign reviewers → next levels</p></div>
        </div>

        {/* Form selector */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Select Form to Review</label>
          <div className="flex gap-3 items-end">
            <select value={selectedFormId} onChange={e => { const id = e.target.value; if (id) loadFormData(id); else { setSelectedFormId(''); setShortlistData(null); } }}
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none focus:border-primary">
              <option value="">Choose a form...</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title} ({f.form_type}) — {f.status}</option>)}
            </select>
          </div>
        </div>

        {loadingSubs && <div className="flex justify-center py-8"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>}

        {selectedFormId && shortlistData && !loadingSubs && (
          <>
            {/* Level pipeline */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold font-heading flex items-center gap-2"><Layers size={15} className="text-primary" /> Review Pipeline</h3>
                <button onClick={() => { setLevelForm(p => ({ ...p, level_number: formLevels.length + 1, name: `Level ${formLevels.length + 1}`, reviewer_ids: [] })); setShortlistFilter({ filter_type: formLevels.length > 0 ? 'review_avg_gte' : 'all', filter_value: '0', source_level_id: formLevels.length > 0 ? formLevels[formLevels.length - 1].id : '', field_id: '', field_value: '' }); setShortlistResult(null); setShowShortlist(true); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-hover min-h-[40px]"><Zap size={14} /> Create Shortlist / Next Level</button>
              </div>

              {formLevels.length === 0 ? (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400"><p className="text-sm">No review levels yet. Create a shortlist to start the pipeline.</p></div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <div className="flex-shrink-0 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-center min-w-[120px]">
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{subs.length}</p>
                    <p className="text-[10px] text-blue-600 font-semibold">Total Submissions</p>
                  </div>
                  {formLevels.map((l: any, i: number) => {
                    const atLevel = subs.filter((s: any) => s.highest_level >= l.level_number).length;
                    return (<React.Fragment key={l.id}>
                      <ArrowRight size={16} className="text-slate-500 dark:text-slate-400 flex-shrink-0" />
                      <div className="flex-shrink-0 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center min-w-[140px]">
                        <p className="text-[10px] font-bold text-primary uppercase">L{l.level_number}</p>
                        <p className="text-xs font-bold mt-0.5">{l.name}</p>
                        <p className="text-lg font-bold mt-1">{atLevel}</p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400">{l.scoring_type?.replace('_', ' ')} · {l.blind_review ? 'Blind' : 'Open'}</p>
                      </div>
                    </React.Fragment>);
                  })}
                </div>
              )}
            </div>

            {/* Submissions table */}
            <DataTable
              title={`Submissions (${subs.length})`}
              subtitle="Click any row to view full profile with all level scores"
              columns={subColumns}
              data={subs}
              searchPlaceholder="Search by name, email..."
              onRowClick={(row: any) => openProfile(row.id)}
              actions={(row: any) => (
                <button onClick={e => { e.stopPropagation(); openProfile(row.id); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-primary" title="View Profile"><Eye size={14} /></button>
              )}
            />
          </>
        )}

        {/* Create Shortlist Modal */}
        <Modal open={showShortlist} onClose={() => setShowShortlist(false)} title={`Create Shortlist — Level ${levelForm.level_number}`} size="xl">
          <div className="space-y-5">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">This will filter submissions and assign them to reviewers for Level {levelForm.level_number}.</p>
            </div>

            {/* Step 1: Filter */}
            <div>
              <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</span> Filter Submissions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Filter Type</label>
                  <select value={shortlistFilter.filter_type} onChange={e => setShortlistFilter(p => ({ ...p, filter_type: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                    <option value="all">All Submissions</option>
                    <option value="form_score_gte">Form Auto-Score ≥ value</option>
                    <option value="review_avg_gte">Previous Level Avg ≥ value</option>
                    <option value="field_value">Filter by Field Value</option>
                  </select></div>
                {(shortlistFilter.filter_type === 'form_score_gte' || shortlistFilter.filter_type === 'review_avg_gte') && (
                  <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Minimum Score</label>
                    <input type="number" value={shortlistFilter.filter_value} onChange={e => setShortlistFilter(p => ({ ...p, filter_value: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" placeholder="e.g. 80" /></div>
                )}
                {shortlistFilter.filter_type === 'review_avg_gte' && (
                  <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">From Level</label>
                    <select value={shortlistFilter.source_level_id} onChange={e => setShortlistFilter(p => ({ ...p, source_level_id: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                      <option value="">Select source level</option>
                      {(shortlistData?.levels || []).map((l: any) => <option key={l.id} value={l.id}>L{l.level_number}: {l.name}</option>)}
                    </select></div>
                )}
                {shortlistFilter.filter_type === 'field_value' && (() => {
                  // Parse form fields to show as filter options
                  const selectedFormObj = forms.find((f: any) => f.id === selectedFormId);
                  let formFields: any[] = [];
                  try { formFields = typeof selectedFormObj?.fields === 'string' ? JSON.parse(selectedFormObj.fields) : (selectedFormObj?.fields || []); } catch {}
                  // Flatten: include children of sections
                  const flat: any[] = [];
                  const walk = (list: any[]) => list.forEach((f: any) => { if (f.type !== 'section') flat.push(f); if (f.children) walk(f.children); });
                  walk(formFields);
                  const selectedField = flat.find((f: any) => f.id === shortlistFilter.field_id);
                  return (<>
                    <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Field to Filter</label>
                      <select value={shortlistFilter.field_id} onChange={e => setShortlistFilter(p => ({ ...p, field_id: e.target.value, field_value: '' }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                        <option value="">Select field</option>
                        {flat.map((f: any) => <option key={f.id} value={f.id}>{f.label} ({f.type})</option>)}
                      </select></div>
                    <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Equals Value</label>
                      {selectedField?.options ? (
                        <select value={shortlistFilter.field_value} onChange={e => setShortlistFilter(p => ({ ...p, field_value: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                          <option value="">Select value</option>
                          {selectedField.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input value={shortlistFilter.field_value} onChange={e => setShortlistFilter(p => ({ ...p, field_value: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" placeholder="Enter value to match" />
                      )}</div>
                  </>);
                })()}
              </div>
            </div>

            {/* Step 2: Level config */}
            <div>
              <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</span> Level Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Level Name</label>
                  <input value={levelForm.name} onChange={e => setLevelForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" placeholder='e.g. "Level 1 - High Scorers"' /></div>
                <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Scoring Type</label>
                  <select value={levelForm.scoring_type} onChange={e => setLevelForm(p => ({ ...p, scoring_type: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                    <option value="form_level">Form Level (overall score)</option><option value="question_level">Question Level (per-question)</option></select></div>
                <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Grade Scale</label>
                  <input value={levelForm.grade_scale} onChange={e => setLevelForm(p => ({ ...p, grade_scale: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none" placeholder="A,B,C,D" /></div>
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><input type="checkbox" checked={levelForm.blind_review} onChange={e => setLevelForm(p => ({ ...p, blind_review: e.target.checked }))} className="rounded accent-primary" /> Blind Review (hide submitter name)</label></div>
              </div>
            </div>

            {/* Step 3: Assign reviewers */}
            <div>
              <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">3</span> Assign Reviewers</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {reviewers.map(r => (
                  <label key={r.id} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all min-h-[44px] ${levelForm.reviewer_ids.includes(r.id) ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-slate-200 dark:border-slate-700 hover:border-muted'}`}>
                    <input type="checkbox" checked={levelForm.reviewer_ids.includes(r.id)}
                      onChange={e => setLevelForm(p => ({ ...p, reviewer_ids: e.target.checked ? [...p.reviewer_ids, r.id] : p.reviewer_ids.filter(id => id !== r.id) }))}
                      className="accent-primary rounded" />
                    <div><p className="text-xs font-semibold">{r.name}</p><p className="text-[9px] text-slate-500 dark:text-slate-400">{r.email}</p></div>
                  </label>
                ))}
              </div>
            </div>

            {shortlistResult && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2"><CheckCircle size={16} /> Shortlist created!</p>
                <p className="text-xs text-emerald-600 mt-1">{shortlistResult.shortlisted} submissions shortlisted → {shortlistResult.reviews_created} review tasks created for {shortlistResult.reviewers} reviewers</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowShortlist(false)} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-900">Close</button>
              <button onClick={createShortlist} className="px-6 py-2 bg-primary text-white text-sm rounded-xl font-bold hover:bg-primary-hover flex items-center gap-2"><Zap size={14} /> Create Shortlist</button>
            </div>
          </div>
        </Modal>

        {/* Profile Detail Modal */}
        <Modal open={showProfile} onClose={() => { setShowProfile(false); setProfileData(null); }} title="Submission Profile" size="2xl">
          {profileLoading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div> :
          profileData && (() => {
            const sub = profileData.submission;
            let responses: Record<string, any> = {};
            try { responses = typeof sub.responses === 'string' ? JSON.parse(sub.responses) : (sub.responses || {}); } catch {}
            return (
              <div className="space-y-5">
                {/* Header */}
                <div className="bg-gradient-to-r from-navy to-navy-light rounded-xl p-5 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-bold">{(sub.user_name || '?')[0]}</div>
                    <div>
                      <h2 className="text-lg font-bold">{sub.user_name || 'Anonymous'}</h2>
                      <p className="text-sm text-blue-200">{sub.user_email}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px]">
                        <span className="bg-white/15 px-2 py-0.5 rounded-full">{sub.form_title}</span>
                        <StatusBadge status={sub.status} size="xs" />
                        {sub.score != null && <span className="bg-emerald-500/30 px-2 py-0.5 rounded-full">Form Score: {sub.score}%</span>}
                        <span className="bg-white/15 px-2 py-0.5 rounded-full">Level {profileData.highest_level}/{profileData.total_levels}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Level-wise scores */}
                <div>
                  <h3 className="text-sm font-bold font-heading mb-3 flex items-center gap-2"><BarChart3 size={15} className="text-primary" /> Level-wise Review Scores</h3>
                  {profileData.levels.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No review levels configured yet.</p> : (
                    <div className="space-y-3">
                      {profileData.levels.map((lvl: any) => (
                        <div key={lvl.level_id} className={`p-4 rounded-xl border ${lvl.total_reviewers > 0 ? 'border-primary/30 bg-primary/[0.02]' : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">L{lvl.level_number}</span>
                              <span className="text-sm font-bold">{lvl.level_name}</span>
                              <span className="text-[9px] text-slate-500 dark:text-slate-400">{lvl.scoring_type?.replace('_', ' ')} · {lvl.blind_review ? 'Blind' : 'Open'}</span>
                            </div>
                            {lvl.average_score != null && (
                              <div className="text-right">
                                <p className="text-2xl font-bold text-primary">{lvl.average_score}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">avg score</p>
                              </div>
                            )}
                          </div>
                          {lvl.total_reviewers > 0 ? (
                            <div className="space-y-2">
                              {lvl.scores.map((s: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">R{i+1}</div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold">{s.overall_score}</span>
                                      {s.grade && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold">{s.grade}</span>}
                                      {s.recommendation && <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{s.recommendation?.replace('_', ' ')}</span>}
                                    </div>
                                    {s.comments && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.comments}</p>}
                                  </div>
                                  <span className="text-[9px] text-slate-500 dark:text-slate-400">{new Date(s.created_at).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          ) : <p className="text-xs text-slate-500 dark:text-slate-400">Not yet reviewed at this level</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Responses */}
                <div>
                  <h3 className="text-sm font-bold font-heading mb-3">Form Responses</h3>
                  <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 space-y-2">
                    {Object.keys(responses).length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No responses</p> :
                      Object.entries(responses).map(([k, v]) => (
                        <div key={k} className="flex flex-col sm:flex-row gap-1 py-1.5 border-b border-slate-200 dark:border-slate-700/30 last:border-0">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-[150px]">{k}:</span>
                          <span className="text-sm">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Comments timeline */}
                {profileData.comments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold font-heading mb-3">Comments Timeline</h3>
                    <div className="space-y-2">
                      {profileData.comments.map((c: any) => (
                        <div key={c.id} className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold">{c.user_name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 capitalize">{c.user_role}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-auto">{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm">{c.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => navigate(`/forms/view?submission=${sub.id}`)} className="w-full py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-white dark:bg-slate-800 flex items-center justify-center gap-2">
                  <Eye size={14} /> View Full Form Response (with form layout)
                </button>
              </div>
            );
          })()}
        </Modal>
      </div>
    );
  }

  // ═══════════ REVIEWER VIEW ═══════════
  const myPending = reviews.filter(r => r.status === 'pending');
  const myCompleted = reviews.filter(r => r.status !== 'pending');
  const displayed = reviewTab === 'pending' ? myPending : myCompleted;

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold font-heading">My Reviews</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Score submissions assigned to you</p></div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center border border-amber-100 dark:border-amber-800">
          <Clock size={20} className="mx-auto text-amber-500 mb-1" /><p className="text-xl font-bold">{myPending.length}</p><p className="text-xs text-amber-600">Pending</p></div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center border border-emerald-100 dark:border-emerald-800">
          <CheckCircle size={20} className="mx-auto text-emerald-500 mb-1" /><p className="text-xl font-bold">{myCompleted.length}</p><p className="text-xs text-emerald-600">Completed</p></div>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-1 w-fit">
        {(['pending', 'completed'] as const).map(t => (
          <button key={t} onClick={() => setReviewTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize ${reviewTab === t ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
            {t} ({t === 'pending' ? myPending.length : myCompleted.length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {displayed.length === 0 ? <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">No {reviewTab} reviews</div> :
          displayed.map(r => (
            <div key={r.id} onClick={() => r.status === 'pending' ? openReview(r) : openProfile(r.submission_id)}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">#{r.submission_id}</div>
              <div className="flex-1">
                <p className="text-sm font-bold">Review #{r.id}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Level {r.level} · {r.reviewer_name}</p>
              </div>
              <StatusBadge status={r.status} />
              <ChevronRight size={16} className="text-slate-500 dark:text-slate-400" />
            </div>
          ))}
      </div>

      {/* Review Modal */}
      <Modal open={showReviewModal} onClose={() => setShowReviewModal(false)} title={`Review Submission #${selectedReview?.submission_id || ''}`} size="xl">
        {selectedReview && (
          <div className="space-y-5">
            {selectedSub && Object.keys(subResponses).length > 0 && (
              <div><h4 className="text-sm font-bold mb-2">Responses</h4>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(subResponses).map(([k, v]) => (
                    <div key={k} className="flex flex-col sm:flex-row gap-1 py-1 border-b border-slate-200 dark:border-slate-700/30 last:border-0">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-[140px]">{k}:</span>
                      <span className="text-sm">{Array.isArray(v) ? (v as any[]).join(', ') : String(v)}</span>
                    </div>))}
                </div>
              </div>)}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Score (0-100)</label>
                <input type="number" min={0} max={100} value={overallScore} onChange={e => setOverallScore(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none focus:border-primary" /></div>
              <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Grade</label>
                <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                  <option value="">Select</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div>
              <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Recommendation</label>
                <select value={recommendation} onChange={e => setRecommendation(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none">
                  <option value="">Select</option><option value="approve">Approve</option><option value="reject">Reject</option><option value="next_level">Next Level</option></select></div>
            </div>
            <div><label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Comments</label>
              <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm outline-none h-24 resize-none" /></div>
            <div className="flex gap-3">
              <button onClick={saveDraft} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-white dark:bg-slate-800 flex items-center gap-2 min-h-[44px]"><Save size={14} /> Draft</button>
              <button onClick={() => submitReview('approved')} className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 flex items-center justify-center gap-2 min-h-[44px]"><CheckCircle size={16} /> Approve</button>
              <button onClick={() => submitReview('rejected')} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 flex items-center justify-center gap-2 min-h-[44px]"><XCircle size={16} /> Reject</button>
            </div>
          </div>)}
      </Modal>

      {/* Profile from reviewer */}
      <Modal open={showProfile} onClose={() => { setShowProfile(false); setProfileData(null); }} title="Submission Profile" size="2xl">
        {profileLoading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div> :
        profileData && (() => {
          const sub = profileData.submission;
          return (
            <div className="space-y-5">
              <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4">
                <h3 className="font-bold">{sub.user_name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{sub.user_email} · {sub.form_title}</p>
                <div className="flex items-center gap-2 mt-2"><StatusBadge status={sub.status} /><span className="text-xs text-slate-500 dark:text-slate-400">Level {profileData.highest_level}/{profileData.total_levels}</span></div>
              </div>
              {profileData.levels.map((lvl: any) => (
                <div key={lvl.level_id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">L{lvl.level_number}: {lvl.level_name}</span>
                    {lvl.average_score != null && <span className="text-xl font-bold text-primary">{lvl.average_score} avg</span>}
                  </div>
                  {lvl.scores.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-900 rounded-lg mt-1">
                      <span className="text-xs font-bold">Score: {s.overall_score}</span>
                      {s.grade && <span className="text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-full">{s.grade}</span>}
                      {s.comments && <span className="text-xs text-slate-500 dark:text-slate-400 flex-1 truncate">{s.comments}</span>}
                    </div>
                  ))}
                  {lvl.total_reviewers === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Not reviewed</p>}
                </div>
              ))}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
