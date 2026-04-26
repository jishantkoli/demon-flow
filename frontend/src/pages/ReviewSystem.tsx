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
  Zap, FileText, Settings
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
  const [fieldFilters, setFieldFilters] = useState([{ field_id: '', field_value: '' }]);
  const [shortlistResult, setShortlistResult] = useState<any>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredResults, setFilteredResults] = useState<any[] | null>(null);

  // Reviewer modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [overallScore, setOverallScore] = useState(0);
  const [questionScores, setQuestionScores] = useState<Record<string, number>>({});
  const [grade, setGrade] = useState('');
  const [recommendation, setRecommendation] = useState('');

  // Profile detail
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Tab for reviewer
  const [reviewTab, setReviewTab] = useState<'pending' | 'completed'>('pending');

  useEffect(() => {
    Promise.all([
      api.get('/forms').catch(() => []),
      api.get('/users?role=reviewer').catch(() => []),
      api.get('/review-levels').catch(() => [])
    ])
      .then(([f, u, l]) => { 
        setForms(Array.isArray(f) ? f.filter((fm: any) => fm.status === 'active' || fm.status === 'expired') : []); 
        setReviewers(Array.isArray(u) ? u : []); 
        setLevels(Array.isArray(l) ? l : []); 
      })
      .catch(err => {
        console.error('Error initializing ReviewSystem:', err);
        setForms([]);
        setReviewers([]);
        setLevels([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Load reviews for reviewer
  useEffect(() => {
    if (user.role === 'reviewer') {
      api.get(`/reviews?reviewer_id=${user.id}`)
        .then(res => setReviews(Array.isArray(res) ? res : []))
        .catch(err => {
          console.error('Error fetching reviewer reviews:', err);
          setReviews([]);
        });
    }
  }, [user.id, user.role]);

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

  const getFormFilterFields = () => {
    const selectedFormObj = forms.find((f: any) => f.id === selectedFormId);
    let formFields: any[] = [];
    try {
      const schemaSource = selectedFormObj?.form_schema || selectedFormObj?.schema;
      if (schemaSource) {
        const parsed = typeof schemaSource === 'string' ? JSON.parse(schemaSource) : schemaSource;
        if (parsed?.sections) {
          formFields = parsed.sections.flatMap((s: any) => s.fields || []);
        }
      }
      if (formFields.length === 0) {
        formFields = typeof selectedFormObj?.fields === 'string' ? JSON.parse(selectedFormObj.fields) : (selectedFormObj?.fields || []);
      }
    } catch {}
    const flat: any[] = [];
    const walk = (list: any[]) => list.forEach((f: any) => { if (f.type !== 'section') flat.push(f); if (f.children) walk(f.children); });
    walk(formFields);
    return flat;
  };

  const getFieldOptionValues = (field: any) => {
    const raw = Array.isArray(field?.options) ? field.options : [];
    return raw
      .map((o: any) => typeof o === 'string' ? o : (o?.label || o?.value || ''))
      .map((o: string) => String(o).trim())
      .filter(Boolean);
  };

  const openProfile = async (submissionId: string) => {
    setProfileLoading(true); setShowProfile(true);
    try {
      // Get full history from shortlist endpoint (admin) OR basic data from submissions endpoint (reviewer)
      let data;
      if (user.role === 'admin') {
        data = await api.get(`/shortlist?submission_id=${submissionId}`);
      } else {
        const res = await api.get(`/submissions/${submissionId}`);
        if (res.success && res.data) {
          data = { submission: res.data, levels: [], highest_level: 0, total_levels: 0 };
        }
      }
      setProfileData(data);
    } catch (err) { console.error(err); }
    finally { setProfileLoading(false); }
  };

  const applyFilters = () => {
    if (!shortlistData?.submissions) return;
    setIsFiltering(true);
    let results = [...shortlistData.submissions];

    // Filter by Score
    if (shortlistFilter.filter_type === 'form_score_gte') {
      const val = parseFloat(shortlistFilter.filter_value);
      results = results.filter(s => {
        const scoreVal = typeof s.score === 'object' ? s.score?.percentage : s.score;
        return (scoreVal || 0) >= val;
      });
    }

    // Filter by Level Avg
    if (shortlistFilter.filter_type === 'review_avg_gte' && shortlistFilter.source_level_id) {
      const val = parseFloat(shortlistFilter.filter_value);
      const levelNum = levels.find(l => l.id === shortlistFilter.source_level_id)?.level_number;
      if (levelNum) {
        results = results.filter(s => (s.level_averages?.[`level_${levelNum}`] || 0) >= val);
      }
    }

    // Filter by Fields (AND logic)
    const activeFieldFilters = fieldFilters.filter(f => f.field_id && f.field_value);
    if (activeFieldFilters.length > 0) {
      results = results.filter(s => {
        let responseArray: any[] = [];
        try {
          responseArray = Array.isArray(s.responses) ? s.responses : (typeof s.responses === 'string' ? JSON.parse(s.responses) : []);
        } catch { return false; }
        
        return activeFieldFilters.every(f => {
          const fieldResp = responseArray.find((r: any) => String(r.fieldId) === String(f.field_id));
          const fieldValue = fieldResp ? fieldResp.value : null;
          
          if (Array.isArray(fieldValue)) {
            return fieldValue.some(v => String(v || '').toLowerCase().includes(String(f.field_value).toLowerCase()));
          }
          return String(fieldValue || '').toLowerCase().includes(String(f.field_value).toLowerCase());
        });
      });
    }

    setFilteredResults(results);
    setIsFiltering(false);
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

    // If we have filtered results locally, we can send their IDs directly if the backend supports it, 
    // or use the filter criteria. For now, let's stick to criteria but ensure they match what's on screen.
    const cleanedFieldFilters = fieldFilters.filter(f => f.field_id && String(f.field_value).trim() !== '');
    
    // NEW: If we have filteredResults, we can pass specific submission IDs
    const submissionIds = filteredResults ? filteredResults.map(s => s.id) : null;

    const result = await api.post('/shortlist', {
      action: 'create-shortlist', 
      form_id: selectedFormId, 
      level_id: levelId,
      submission_ids: submissionIds, // Backend should handle this
      filter_type: shortlistFilter.filter_type, 
      filter_value: shortlistFilter.filter_value, 
      field_id: shortlistFilter.field_id, 
      field_value: shortlistFilter.field_value,
      field_filters: cleanedFieldFilters,
      source_level_id: shortlistFilter.source_level_id, 
      reviewer_ids: levelForm.reviewer_ids
    });
    setShortlistResult(result);
    loadFormData(selectedFormId);
    setFilteredResults(null); // Clear after success
  };

  // Reviewer: open review
  const openReview = async (review: any) => {
    setSelectedReview(review);
    try {
      const res = await api.get(`/submissions/${review.submission_id}`);
      if (res.success && res.data) {
        setSelectedSub(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch submission:", err);
    }
    setReviewComment(review.comments || '');
    setOverallScore(review.overall_score || 0);
    const qs: Record<string, number> = {};
    (review.question_scores || []).forEach((s: any) => { qs[s.field_id] = s.score; });
    setQuestionScores(qs);
    setGrade(review.grade || '');
    setRecommendation(review.recommendation || '');
    setShowReviewModal(true);
  };

  const submitReview = async (action: 'approved' | 'rejected') => {
    if (!selectedReview) return;
    if (selectedReview.scoring_type === 'question_level') {
      const scoreError = validateQuestionScores();
      if (scoreError) return alert(scoreError);
    }
    await api.put('/reviews', { id: selectedReview.id, status: action, comments: reviewComment });
    await api.put('/submissions', { id: selectedReview.submission_id, status: action });
    // Find the level for this review
    const levelId = levels.find((l: any) => l.level_number === selectedReview.level)?.id;
    const qsArray = buildQuestionScoresPayload();
    await api.post('/review-scores', {
      review_id: selectedReview.id, submission_id: selectedReview.submission_id, reviewer_id: user.id,
      level_id: levelId, overall_score: overallScore, grade, comments: reviewComment,
      recommendation, is_draft: false, question_scores: qsArray
    });
    setShowReviewModal(false);
    if (user.role === 'reviewer') {
      setReviews(await api.get(`/reviews?reviewer_id=${user.id}`));
    }
    if (selectedFormId) loadFormData(selectedFormId);
  };

  const saveDraft = async () => {
    if (!selectedReview) return;
    if (selectedReview.scoring_type === 'question_level') {
      const scoreError = validateQuestionScores();
      if (scoreError) return alert(scoreError);
    }
    const levelId = levels.find((l: any) => l.level_number === selectedReview.level)?.id;
    const qsArray = buildQuestionScoresPayload();
    await api.post('/review-scores', {
      review_id: selectedReview.id, submission_id: selectedReview.submission_id, reviewer_id: user.id,
      level_id: levelId, overall_score: overallScore, grade, comments: reviewComment,
      recommendation, is_draft: true, question_scores: qsArray
    });
    alert('Draft saved!');
  };

  const reviewQuestions = (() => {
    if (!selectedSub?.responses) return [] as Array<{ fieldId: string; label: string; value: any; reviewerMaxMarks: number }>;
    let raw: any;
    try {
      raw = typeof selectedSub.responses === 'string' ? JSON.parse(selectedSub.responses) : selectedSub.responses;
    } catch {
      return [] as Array<{ fieldId: string; label: string; value: any; reviewerMaxMarks: number }>;
    }

    const formSchema = selectedSub.formId?.form_schema;
    const fieldMap: Record<string, { label: string; reviewerMaxMarks: number }> = {};
    if (formSchema?.sections) {
      formSchema.sections.forEach((s: any) => s.fields?.forEach((f: any) => {
        fieldMap[String(f.id)] = {
          label: f.label || String(f.id),
          reviewerMaxMarks: Math.max(0, Number(f.reviewer_max_marks) || 0),
        };
      }));
    }

    if (Array.isArray(raw)) {
      return raw.map((r: any, idx: number) => {
        const fieldId = String(r?.fieldId || `question_${idx + 1}`);
        const cfg = fieldMap[fieldId];
        return {
          fieldId,
          label: cfg?.label || fieldId,
          value: r?.value,
          reviewerMaxMarks: cfg?.reviewerMaxMarks || 0,
        };
      });
    }

    return Object.entries(raw || {}).map(([key, value]) => {
      const cfg = fieldMap[String(key)];
      return {
        fieldId: String(key),
        label: cfg?.label || String(key),
        value,
        reviewerMaxMarks: cfg?.reviewerMaxMarks || 0,
      };
    });
  })();

  const buildQuestionScoresPayload = () => {
    if (selectedReview?.scoring_type === 'question_level') {
      return reviewQuestions.map(q => {
        const score = Number(questionScores[q.fieldId] ?? questionScores[q.label] ?? 0) || 0;
        return { field_id: q.fieldId, score };
      });
    }
    return Object.entries(questionScores).map(([field_id, score]) => ({ field_id, score }));
  };

  const validateQuestionScores = () => {
    for (const q of reviewQuestions) {
      const score = Number(questionScores[q.fieldId] ?? questionScores[q.label] ?? 0) || 0;
      if (score < 0) return `Score cannot be negative for "${q.label}"`;
      if (q.reviewerMaxMarks > 0 && score > q.reviewerMaxMarks) {
        return `Score for "${q.label}" cannot be more than ${q.reviewerMaxMarks}`;
      }
    }
    return '';
  };

  // ═══════════ ADMIN VIEW ═══════════
  if (user.role === 'admin') {
    const subs = shortlistData?.submissions || [];
    const formLevels = shortlistData?.levels || [];

    const subColumns = [
      { key: 'user_name', label: 'Name', sortable: true, render: (v: string, r: any) => (
        <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{(v||'?')[0]}</div>
          <div><p className="text-sm font-medium">{v || 'Anonymous'}</p><p className="text-[10px] text-slate-500">{r.user_email}</p></div></div>) },
      { key: 'score', label: 'Form Score', sortable: true, render: (v: any) => v != null ? <span className="font-bold text-sm text-primary">{typeof v === 'object' ? v?.percentage : v}%</span> : <span className="text-slate-500">—</span> },
      ...formLevels.map((l: any) => ({
        key: `level_${l.level_number}`, label: `L{l.level_number} Avg`, sortable: true,
        render: (_: any, r: any) => {
          const avg = r.level_averages?.[`level_${l.level_number}`];
          return avg != null ? <span className="font-bold text-sm">{avg}</span> : <span className="text-slate-500 text-xs">—</span>;
        }
      })),
      { key: 'highest_level', label: 'Reached', sortable: true, render: (v: number) => v > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">L{v}</span> : <span className="text-slate-500 text-xs">—</span> },
      { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h1 className="text-xl font-bold font-heading">Review & Shortlisting</h1>
            <p className="text-sm text-slate-500">Select form → filter teachers → assign to level</p></div>
        </div>

        {/* 1. Form Selector */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <label className="text-xs font-semibold text-slate-500 mb-2 block">Step 1: Select Form to Review</label>
          <select value={selectedFormId} onChange={e => { const id = e.target.value; if (id) loadFormData(id); else { setSelectedFormId(''); setShortlistData(null); setFilteredResults(null); } }}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none focus:border-primary">
            <option value="">Choose a form...</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.title} ({f.form_type}) — {f.status}</option>)}
          </select>
        </div>

        {loadingSubs && <div className="flex justify-center py-8"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>}

        {selectedFormId && shortlistData && !loadingSubs && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Filters */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold font-heading mb-4 flex items-center gap-2"><Filter size={15} className="text-primary" /> Filter Submissions</h3>
                
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">1. Basic Filter</label>
                    <div className="space-y-3">
                      <select value={shortlistFilter.filter_type} onChange={e => setShortlistFilter(p => ({ ...p, filter_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-primary">
                        <option value="all">All Submissions</option>
                        <option value="form_score_gte">Form Auto-Score ≥</option>
                        <option value="review_avg_gte">Previous Level Avg ≥</option>
                      </select>

                      {(shortlistFilter.filter_type === 'form_score_gte' || shortlistFilter.filter_type === 'review_avg_gte') && (
                        <div className="flex gap-2">
                          <input type="number" value={shortlistFilter.filter_value} onChange={e => setShortlistFilter(p => ({ ...p, filter_value: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none" placeholder="Value (e.g. 80)" />
                          {shortlistFilter.filter_type === 'review_avg_gte' && (
                            <select value={shortlistFilter.source_level_id} onChange={e => setShortlistFilter(p => ({ ...p, source_level_id: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none">
                              <option value="">Source Level</option>
                              {(shortlistData?.levels || []).map((l: any) => <option key={l.id} value={l.id}>L{l.level_number}</option>)}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">2. Field-Specific Filters</label>
                    <div className="space-y-3">
                      {fieldFilters.map((row, idx) => {
                        const fields = getFormFilterFields();
                        const selectedField = fields.find(f => f.id === row.field_id);
                        const options = getFieldOptionValues(selectedField);
                        
                        return (
                          <div key={idx} className="p-2 rounded-lg bg-white border border-slate-200 space-y-2 relative group">
                            <button onClick={() => setFieldFilters(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors shadow-sm">
                              <XCircle size={12} />
                            </button>
                            <select value={row.field_id} onChange={e => setFieldFilters(prev => prev.map((r, i) => i === idx ? { ...r, field_id: e.target.value, field_value: '' } : r))}
                              className="w-full px-2 py-1.5 rounded-md border border-slate-100 bg-slate-50 text-[11px] outline-none">
                              <option value="">Select field...</option>
                              {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                            </select>
                            
                            {options.length > 0 ? (
                              <select value={row.field_value} onChange={e => setFieldFilters(prev => prev.map((r, i) => i === idx ? { ...r, field_value: e.target.value } : r))}
                                className="w-full px-2 py-1.5 rounded-md border border-slate-100 bg-slate-50 text-[11px] outline-none">
                                <option value="">Select value...</option>
                                {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input value={row.field_value} onChange={e => setFieldFilters(prev => prev.map((r, i) => i === idx ? { ...r, field_value: e.target.value } : r))}
                                className="w-full px-2 py-1.5 rounded-md border border-slate-100 bg-slate-50 text-[11px] outline-none" placeholder="Value to match..." />
                            )}
                          </div>
                        );
                      })}
                      <button onClick={() => setFieldFilters(prev => [...prev, { field_id: '', field_value: '' }])} className="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-white hover:border-primary transition-all flex items-center justify-center gap-1">
                        <Zap size={10} /> Add Field Condition
                      </button>
                    </div>
                  </div>

                  <button onClick={applyFilters} disabled={isFiltering}
                    className="w-full py-3 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light shadow-lg shadow-navy/10 flex items-center justify-center gap-2 transition-all active:scale-95">
                    {isFiltering ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Filter size={16} />}
                    Show Filtered Teachers
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Pipeline & Table */}
            <div className="lg:col-span-2 space-y-6">
              {/* Filter Results Action Bar (NEW) */}
              {filteredResults && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-200 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{filteredResults.length} Teachers Found</p>
                      <p className="text-[10px] text-emerald-100">Ready to be assigned to a review level</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button onClick={() => setFilteredResults(null)} className="flex-1 md:flex-none px-4 py-2 text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                      Clear
                    </button>
                    <button onClick={() => { setLevelForm(p => ({ ...p, level_number: formLevels.length + 1, name: `Level ${formLevels.length + 1}` })); setShowShortlist(true); }}
                      className="flex-1 md:flex-none px-6 py-2.5 bg-white text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-50 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                      <Layers size={16} /> Shortlist Now
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Level pipeline */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold font-heading mb-4 flex items-center gap-2"><Layers size={15} className="text-primary" /> Review Pipeline</h3>
                {formLevels.length === 0 ? (
                  <div className="text-center py-4 text-slate-400"><p className="text-xs italic">No levels created yet. Filter and shortlist to start.</p></div>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <div className="flex-shrink-0 p-3 rounded-xl bg-blue-50 border border-blue-200 text-center min-w-[100px]">
                      <p className="text-lg font-bold text-blue-700">{subs.length}</p>
                      <p className="text-[9px] text-blue-600 font-bold uppercase">Submissions</p>
                    </div>
                    {formLevels.map((l: any) => {
                      const atLevel = subs.filter((s: any) => s.highest_level >= l.level_number).length;
                      return (<React.Fragment key={l.id}>
                        <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />
                        <div className="flex-shrink-0 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[120px]">
                          <p className="text-[9px] font-bold text-primary uppercase">L{l.level_number}</p>
                          <p className="text-[11px] font-bold truncate max-w-[100px]">{l.name}</p>
                          <p className="text-lg font-bold">{atLevel}</p>
                        </div>
                      </React.Fragment>);
                    })}
                  </div>
                )}
              </div>

              {/* Submissions table */}
              <DataTable
                title={filteredResults ? "Filtered Teachers" : "All Submissions"}
                subtitle={filteredResults 
                  ? `${filteredResults.length} teachers selected for shortlisting` 
                  : "Use the filters on the left to shortlist teachers for review"}
                columns={subColumns}
                data={filteredResults || subs}
                searchPlaceholder="Search by name, email..."
                onRowClick={(row: any) => openProfile(row.id)}
                actions={(row: any) => (
                  <button onClick={e => { e.stopPropagation(); openProfile(row.id); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary" title="View Profile"><Eye size={14} /></button>
                )}
              />
            </div>
          </div>
        )}

        {/* Create Shortlist Modal */}
        <Modal open={showShortlist} onClose={() => setShowShortlist(false)} title="Create New Review Level" size="xl">
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <UserCheck size={24} />
              </div>
              <div>
                <p className="text-base font-bold text-emerald-900">{filteredResults ? filteredResults.length : subs.length} Teachers Selected</p>
                <p className="text-xs text-emerald-700">These teachers will be moved to <span className="font-bold">Level {levelForm.level_number}</span> for review.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Side: Level Config */}
              <div className="space-y-5">
                <div>
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><Settings size={16} className="text-primary" /> 1. Level Settings</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Level Name</label>
                      <input value={levelForm.name} onChange={e => setLevelForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-primary" placeholder='e.g. "Initial Screening"' />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Scoring Type</label>
                        <select value={levelForm.scoring_type} onChange={e => setLevelForm(p => ({ ...p, scoring_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none">
                          <option value="form_level">Overall</option>
                          <option value="question_level">By Question</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Grades</label>
                        <input value={levelForm.grade_scale} onChange={e => setLevelForm(p => ({ ...p, grade_scale: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none" placeholder="A,B,C" />
                      </div>
                    </div>
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 cursor-pointer group">
                      <input type="checkbox" checked={levelForm.blind_review} onChange={e => setLevelForm(p => ({ ...p, blind_review: e.target.checked }))} className="w-4 h-4 rounded accent-primary" />
                      <div>
                        <p className="text-xs font-bold text-slate-700">Blind Review</p>
                        <p className="text-[10px] text-slate-500">Hide teacher names from reviewers</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Side: Reviewers */}
              <div>
                <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><Users size={16} className="text-primary" /> 2. Assign Reviewers</h4>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                  {reviewers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-xl">No reviewers found in system</p>
                  ) : reviewers.map(r => (
                    <label key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${levelForm.reviewer_ids.includes(r.id) ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                      <input type="checkbox" checked={levelForm.reviewer_ids.includes(r.id)}
                        onChange={e => setLevelForm(p => ({ ...p, reviewer_ids: e.target.checked ? [...p.reviewer_ids, r.id] : p.reviewer_ids.filter(id => id !== r.id) }))}
                        className="w-4 h-4 rounded accent-primary" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">{r.name}</p>
                        <p className="text-[10px] text-slate-500">{r.email}</p>
                      </div>
                      {levelForm.reviewer_ids.includes(r.id) && <CheckCircle size={14} className="text-primary" />}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {shortlistResult && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Award size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800">Process Completed Successfully!</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    {shortlistResult.shortlisted} teachers have been assigned to <span className="font-bold">{levelForm.name}</span>. 
                    {shortlistResult.reviews_created} review tasks generated for {shortlistResult.reviewers} reviewers.
                  </p>
                </div>
              </motion.div>
            )}

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
              <button onClick={() => { setShowShortlist(false); setShortlistResult(null); }} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={createShortlist} disabled={levelForm.reviewer_ids.length === 0 || !levelForm.name}
                className="px-8 py-3 bg-navy text-white text-sm rounded-xl font-bold hover:bg-navy-light flex items-center gap-2 shadow-lg shadow-navy/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95">
                <Zap size={16} /> Assign {filteredResults?.length || subs.length} Teachers to Level {levelForm.level_number}
              </button>
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
                        {sub.score != null && <span className="bg-emerald-500/30 px-2 py-0.5 rounded-full">Form Score: {typeof sub.score === 'object' ? sub.score?.percentage : sub.score}%</span>}
                        <span className="bg-white/15 px-2 py-0.5 rounded-full">Level {profileData.highest_level}/{profileData.total_levels}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Level-wise scores */}
                <div>
                  <h3 className="text-sm font-bold font-heading mb-3 flex items-center gap-2"><BarChart3 size={15} className="text-primary" /> Level-wise Review Scores</h3>
                  {profileData.levels.length === 0 ? <p className="text-sm text-slate-500">No review levels configured yet.</p> : (
                    <div className="space-y-3">
                      {profileData.levels.map((lvl: any) => (
                        <div key={lvl.level_id} className={`p-4 rounded-xl border ${lvl.total_reviewers > 0 ? 'border-primary/30 bg-primary/[0.02]' : 'border-slate-200 bg-slate-100'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">L{lvl.level_number}</span>
                              <span className="text-sm font-bold">{lvl.level_name}</span>
                              <span className="text-[9px] text-slate-500">{lvl.scoring_type?.replace('_', ' ')} · {lvl.blind_review ? 'Blind' : 'Open'}</span>
                            </div>
                            {lvl.average_score != null && (
                              <div className="text-right">
                                <p className="text-2xl font-bold text-primary">{lvl.average_score}</p>
                                <p className="text-[10px] text-slate-500">avg score</p>
                              </div>
                            )}
                          </div>
                          {lvl.total_reviewers > 0 ? (
                            <div className="space-y-2">
                              {lvl.scores.map((s: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 p-2 bg-slate-100 rounded-lg border border-slate-200">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">R{i+1}</div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold">{s.overall_score}</span>
                                      {s.grade && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-slate-200 font-bold">{s.grade}</span>}
                                      {s.recommendation && <span className="text-[10px] text-slate-500 capitalize">{s.recommendation?.replace('_', ' ')}</span>}
                                    </div>
                                    {s.comments && <p className="text-xs text-slate-500 mt-0.5">{s.comments}</p>}
                                  </div>
                                  <span className="text-[9px] text-slate-500">{new Date(s.created_at).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          ) : <p className="text-xs text-slate-500">Not yet reviewed at this level</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Responses */}
                <div>
                  <h3 className="text-sm font-bold font-heading mb-3">Form Responses</h3>
                  <div className="bg-slate-100 rounded-xl p-4 space-y-2">
                    {Object.keys(responses).length === 0 ? <p className="text-sm text-slate-500">No responses</p> :
                      Object.entries(responses).map(([k, v]) => (
                        <div key={k} className="flex flex-col sm:flex-row gap-1 py-1.5 border-b border-slate-200 last:border-0">
                          <span className="text-xs font-semibold text-slate-500 min-w-[150px]">{k}:</span>
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
                        <div key={c.id} className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold">{c.user_name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white border border-slate-200 capitalize">{c.user_role}</span>
                            <span className="text-[10px] text-slate-500 ml-auto">{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm">{c.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => navigate(`/forms/view?submission=${sub.id}`)} className="w-full py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-white flex items-center justify-center gap-2">
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
        <p className="text-sm text-slate-500">Score submissions assigned to you</p></div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
          <Clock size={20} className="mx-auto text-amber-500 mb-1" /><p className="text-xl font-bold">{myPending.length}</p><p className="text-xs text-amber-600">Pending</p></div>
        <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
          <CheckCircle size={20} className="mx-auto text-emerald-500 mb-1" /><p className="text-xl font-bold">{myCompleted.length}</p><p className="text-xs text-emerald-600">Completed</p></div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['pending', 'completed'] as const).map(t => (
          <button key={t} onClick={() => setReviewTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize ${reviewTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {t} ({t === 'pending' ? myPending.length : myCompleted.length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayed.length === 0 ? <div className="col-span-full text-center py-12 text-slate-500 text-sm">No {reviewTab} reviews</div> :
          displayed.map(r => (
            <div key={r.id} onClick={() => r.status === 'pending' ? openReview(r) : openProfile(r.submission_id)}
              className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer relative overflow-hidden flex flex-col gap-4">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 transition-all group-hover:bg-primary/10 group-hover:scale-110" />
              
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shadow-inner">
                    <FileText size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Level {r.level}</p>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-1">Review #{r.id.slice(-6)}</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Sub ID: {r.submission_id.slice(-8)}</p>
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 relative z-10">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-bold">U</div>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Assigned To</p>
                  <p className="text-xs text-slate-700 font-semibold">{r.reviewer_name || 'Assigned Reviewer'}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Review Modal */}
      <Modal open={showReviewModal} onClose={() => setShowReviewModal(false)} title={`Review Submission #${selectedReview?.submission_id || ''}`} size="xl">
        {selectedReview && (
          <div className="space-y-6">
            {selectedSub && reviewQuestions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold flex items-center gap-2"><FileText size={16} className="text-primary" /> Form Responses</h4>
                  {selectedReview.scoring_type === 'question_level' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 uppercase">Question Level Marking Enabled</span>
                  )}
                </div>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    {reviewQuestions.map((q, idx) => (
                      <div key={q.fieldId} className={`p-4 flex flex-col md:flex-row md:items-center gap-4 ${idx !== reviewQuestions.length - 1 ? 'border-b border-slate-100' : ''}`}>
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Question {idx + 1}</span>
                          <p className="text-xs font-semibold text-slate-700 mb-1">{q.label}</p>
                          <p className="text-sm text-slate-900 bg-white p-2 rounded-lg border border-slate-100 inline-block min-w-[100px]">
                            {Array.isArray(q.value) ? (q.value as any[]).join(', ') : String(q.value)}
                          </p>
                        </div>
                        {selectedReview.scoring_type === 'question_level' && (
                          <div className="flex-shrink-0 w-full md:w-32">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Score</label>
                            <input 
                              type="number" 
                              min={0}
                              max={q.reviewerMaxMarks > 0 ? q.reviewerMaxMarks : undefined}
                              value={questionScores[q.fieldId] ?? questionScores[q.label] ?? 0}
                              onChange={e => {
                                const rawVal = parseFloat(e.target.value);
                                const normalizedVal = Number.isFinite(rawVal) ? Math.max(0, rawVal) : 0;
                                const cappedVal = q.reviewerMaxMarks > 0 ? Math.min(normalizedVal, q.reviewerMaxMarks) : normalizedVal;
                                const newScores = { ...questionScores, [q.fieldId]: cappedVal };
                                setQuestionScores(newScores);
                                // Auto-calculate overall score
                                const total = reviewQuestions.reduce((sum, item) => {
                                  const score = Number(newScores[item.fieldId] ?? newScores[item.label] ?? 0) || 0;
                                  return sum + score;
                                }, 0);
                                setOverallScore(total);
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-primary outline-none focus:border-primary shadow-sm"
                              placeholder="0"
                            />
                            {q.reviewerMaxMarks > 0 && (
                              <p className="text-[10px] mt-1 font-semibold text-amber-700">Max: {q.reviewerMaxMarks}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">
                  Overall Score {selectedReview.scoring_type === 'question_level' ? '(Sum of questions)' : '(0-100)'}
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    min={0} 
                    value={overallScore} 
                    onChange={e => !selectedReview.scoring_type?.includes('question') && setOverallScore(parseInt(e.target.value) || 0)} 
                    readOnly={selectedReview.scoring_type === 'question_level'}
                    className={`w-full px-4 py-2.5 rounded-xl border font-bold text-lg outline-none transition-all ${selectedReview.scoring_type === 'question_level' ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-300 text-primary focus:border-primary focus:ring-2 focus:ring-primary/10'}`} 
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Star size={18} />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Grade Assigned</label>
                <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
                  <option value="">Select Grade</option>
                  <option value="A">Grade A (Excellent)</option>
                  <option value="B">Grade B (Very Good)</option>
                  <option value="C">Grade C (Good)</option>
                  <option value="D">Grade D (Average)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Final Recommendation</label>
                <select value={recommendation} onChange={e => setRecommendation(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
                  <option value="">Choose action...</option>
                  <option value="approve">Approve Submission</option>
                  <option value="reject">Reject Submission</option>
                  <option value="next_level">Recommend for Next Level</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block text-center md:text-left">Reviewer Comments & Feedback</label>
              <textarea 
                value={reviewComment} 
                onChange={e => setReviewComment(e.target.value)} 
                placeholder="Enter detailed feedback here..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-white text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 h-32 resize-none transition-all" 
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={saveDraft} className="px-6 py-3 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2">
                <Save size={18} /> Save as Draft
              </button>
              <div className="flex-1 flex gap-3">
                <button onClick={() => submitReview('rejected')} className="flex-1 py-3 bg-red-50 text-red-600 border-2 border-red-100 rounded-2xl font-bold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                  <XCircle size={18} /> Reject
                </button>
                <button onClick={() => submitReview('approved')} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <CheckCircle size={18} /> Submit Review
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Profile from reviewer */}
      <Modal open={showProfile} onClose={() => { setShowProfile(false); setProfileData(null); }} title="Submission Profile" size="2xl">
        {profileLoading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div> :
        profileData && (() => {
          const sub = profileData.submission;
          
          // Calculate responses for this specific profile view
          let profileResponses: Record<string, any> = {};
          if (sub?.responses) {
            const raw = typeof sub.responses === 'string' ? JSON.parse(sub.responses) : sub.responses;
            if (Array.isArray(raw)) {
              const formSchema = sub.formId?.form_schema;
              const fieldMap: Record<string, string> = {};
              if (formSchema?.sections) {
                formSchema.sections.forEach((s: any) => s.fields?.forEach((f: any) => { fieldMap[f.id] = f.label; }));
              }
              raw.forEach((r: any) => {
                const label = fieldMap[r.fieldId] || r.fieldId;
                profileResponses[label] = r.value;
              });
            } else {
              profileResponses = raw;
            }
          }

          return (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                    {(sub.user_name || 'U')[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{sub.user_name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{sub.user_email} · {sub.form_title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={sub.status} />
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                    Level {profileData.highest_level || 0} / {profileData.total_levels || 0}
                  </span>
                </div>
              </div>

              {/* Form Responses Section */}
              {Object.keys(profileResponses).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold flex items-center gap-2 px-1">
                    <FileText size={16} className="text-primary" /> 
                    Teacher's Responses
                  </h4>
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                      {Object.entries(profileResponses).map(([k, v], idx) => (
                        <div key={k} className={`p-4 ${idx !== Object.keys(profileResponses).length - 1 ? 'border-b border-slate-50' : ''}`}>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Question {idx + 1}</p>
                          <p className="text-xs font-bold text-slate-700 mb-2">{k}</p>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm text-slate-900">
                            {Array.isArray(v) ? (v as any[]).join(', ') : String(v || 'No answer')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Review History */}
              {profileData.levels && profileData.levels.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold flex items-center gap-2 px-1">
                    <Star size={16} className="text-amber-500" /> 
                    Review History
                  </h4>
                  <div className="space-y-4">
                    {profileData.levels.map((lvl: any) => (
                      <div key={lvl.level_id} className="p-4 rounded-2xl border border-slate-200 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-slate-800">L{lvl.level_number}: {lvl.level_name}</span>
                          {lvl.average_score != null && (
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-bold text-primary">{lvl.average_score}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Avg Score</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {lvl.scores.map((s: any, i: number) => (
                            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-600">Score: {s.overall_score}</span>
                                {s.grade && <span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-full text-primary uppercase">{s.grade}</span>}
                              </div>
                              {s.comments && <p className="text-xs text-slate-500 italic">"{s.comments}"</p>}
                            </div>
                          ))}
                          {lvl.total_reviewers === 0 && <p className="text-xs text-slate-400 text-center py-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">Not reviewed yet at this level</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
