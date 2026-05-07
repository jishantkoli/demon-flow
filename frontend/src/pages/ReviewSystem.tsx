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
  Users, ChevronRight, Eye, Printer, ArrowRight, Award, TrendingUp, UserCheck,
  Zap, FileText, Settings, History, Plus, FileDown, Archive, Mail, User as UserIcon, School, Fingerprint, Info, ExternalLink
} from 'lucide-react';

export default function ReviewSystem({ user }: { user: User }) {
  type FieldFilterRow = {
    field_id: string;
    operator: 'contains' | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
    field_value: string;
  };

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
  const [levelForm, setLevelForm] = useState({ 
    name: '', 
    level_number: 1, 
    scoring_type: 'form_level', 
    assignment_type: 'all', // 'all' or 'divide_sections'
    section_id: null as string | null, // NEW: Specific section filter
    blind_review: false, 
    show_previous_reviews: false,
    reviewer_ids: [] as string[] 
  });
  const [shortlistFilter, setShortlistFilter] = useState({ filter_type: 'all', filter_value: '0', source_level_id: '', field_id: '', field_value: '' });
  const [fieldFilters, setFieldFilters] = useState<FieldFilterRow[]>([{ field_id: '', operator: 'contains', field_value: '' }]);
  const [shortlistResult, setShortlistResult] = useState<any>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredResults, setFilteredResults] = useState<any[] | null>(null);
  const [activeFilterLevel, setActiveFilterLevel] = useState(1); // Track which level we are currently filtering for
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLevelColumn, setSelectedLevelColumn] = useState<string>('all');

  useEffect(() => {
    // Default to current stage level whenever stage changes.
    if (activeFilterLevel > 1) {
      setSelectedLevelColumn(String(activeFilterLevel - 1));
      return;
    }
    // Total pool: keep all levels visible by default.
    setSelectedLevelColumn('all');
  }, [activeFilterLevel]);

  // Reviewer modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [reviewHistory, setReviewHistory] = useState<any[]>([]);
  const [reviewComment, setReviewComment] = useState('');
  const [overallScore, setOverallScore] = useState(0);
  const [questionScores, setQuestionScores] = useState<Record<string, number>>({});

  const [grade, setGrade] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [selectedFormObj, setSelectedFormObj] = useState<any>(null);

  // Profile detail
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Tab for reviewer
  const [reviewTab, setReviewTab] = useState<'pending' | 'completed'>('pending');

  // Export states
  const [showExportConfig, setShowExportConfig] = useState(false);
  const [showCsvConfig, setShowCsvConfig] = useState(false);
  const [csvSelectedFields, setCsvSelectedFields] = useState<string[]>([]);
  const [exportNamingStrategy, setExportNamingStrategy] = useState('email');
  const [exportSubNamingStrategy, setExportSubNamingStrategy] = useState('name');
  const [includeNominationData, setIncludeNominationData] = useState(true);
  const [zipSelectedFields, setZipSelectedFields] = useState<string[]>([]);
  const [nominationFieldMap, setNominationFieldMap] = useState<Record<string, string>>({});

  const getExportData = () => {
    const subs = shortlistData?.submissions || [];
    if (activeFilterLevel === 1) {
      return Array.isArray(filteredResults) ? filteredResults : subs;
    }
    const currentStageNumber = activeFilterLevel - 1;
    const stageSubs = subs.filter((s: any) => 
      (s.level_reviews || []).some((r: any) => r.level === currentStageNumber)
    );
    return Array.isArray(filteredResults) ? filteredResults : stageSubs;
  };

  const getFilterableFields = () => {
    const fields: any[] = [];
    const walk = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach(f => {
        if (f.id && f.label && f.type !== 'section') fields.push(f);
        if (f.children) walk(f.children);
      });
    };

    const schemaSource = selectedFormObj?.form_schema || selectedFormObj?.schema;
    if (schemaSource) {
      try {
        const schema = typeof schemaSource === 'string' ? JSON.parse(schemaSource) : schemaSource;
        if (schema?.sections) {
          schema.sections.forEach((s: any) => walk(s.fields || []));
        } else if (schema?.fields) {
          walk(schema.fields);
        } else if (Array.isArray(schema)) {
          walk(schema);
        }
      } catch (err) {
        console.error('Error parsing form schema for export:', err);
      }
    }
    return fields;
  };

  const filterableFields = getFilterableFields();
  const filterableFieldMap = Object.fromEntries(filterableFields.map((f: any) => [f.id, f]));

  const formatResponseLabelValue = (fieldId: string, val: any) => {
    const field = filterableFieldMap[fieldId];
    if (field?.options && Array.isArray(field.options)) {
      if (Array.isArray(val)) {
        return val.map(v => {
          const opt = field.options.find((o: any) => String(o.value) === String(v));
          return opt ? opt.label : v;
        }).join(', ');
      }
      const opt = field.options.find((o: any) => String(o.value) === String(val));
      return opt ? opt.label : val;
    }
    return val;
  };

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
      const [data, lvls, formObj] = await Promise.all([
        api.get(`/shortlist?form_id=${formId}`),
        api.get(`/review-levels?form_id=${formId}`),
        api.get(`/forms?id=${formId}`)
      ]);
      setShortlistData(data);
      setLevels(lvls);
      setSelectedFormObj(formObj);

      // Identify and load unique nomination forms
      const nomFormIds = new Set<string>();
      (data?.submissions || []).forEach((s: any) => {
        const nom = s.nomination_id || s.nominationId;
        if (nom && typeof nom === 'object' && nom.form_id) {
          nomFormIds.add(String(nom.form_id));
        }
      });

      if (nomFormIds.size > 0) {
        const nomForms = await Promise.all(
          Array.from(nomFormIds).map(id => api.get(`/forms?id=${id}`).catch(() => null))
        );
        
        const newFieldMap: Record<string, string> = { ...nominationFieldMap };
        nomForms.forEach(nf => {
          if (!nf) return;
          const schema = nf.form_schema || nf.schema;
          if (schema) {
            const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
            const walk = (list: any[]) => {
              if (!Array.isArray(list)) return;
              list.forEach(f => {
                if (f.id && f.label) newFieldMap[f.id] = f.label;
                if (f.children) walk(f.children);
              });
            };
            if (parsed.sections) {
              parsed.sections.forEach((s: any) => walk(s.fields || []));
            } else if (parsed.fields) {
              walk(parsed.fields);
            } else if (Array.isArray(parsed)) {
              walk(parsed);
            }
          }
        });
        setNominationFieldMap(newFieldMap);
      }
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
    const walk = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach((f: any) => { 
        if (f.type !== 'section') flat.push(f); 
        if (f.children) walk(f.children); 
      });
    };
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

  const getDefaultOperator = (field: any): FieldFilterRow['operator'] => {
    if (!field) return 'contains';
    if (field.type === 'number') return 'gte';
    if (Array.isArray(field.options) && field.options.length > 0) return 'eq';
    return 'contains';
  };

  const [processedNomFormIds, setProcessedNomFormIds] = useState<Set<string>>(new Set());

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

      // Ensure nomination schema is loaded for this profile
      const nom = data?.submission?.nominationId || data?.submission?.nomination_id;
      const nomFormId = nom && typeof nom === 'object' ? String(nom.form_id?._id || nom.form_id?.id || nom.form_id || '') : undefined;
      
      if (nomFormId && nomFormId !== 'undefined' && !processedNomFormIds.has(nomFormId)) {
        const nf = await api.get(`/forms?id=${nomFormId}`).catch(() => null);
        if (nf) {
          const schema = nf.form_schema || nf.schema;
          const newFieldMap: Record<string, string> = { ...nominationFieldMap };
          if (schema) {
            const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
            const walk = (list: any[]) => {
              if (!Array.isArray(list)) return;
              list.forEach((f: any) => {
                if (f.id && f.label) newFieldMap[f.id] = f.label;
                if (f.children) walk(f.children);
              });
            };
            if (parsed.sections) parsed.sections.forEach((s: any) => walk(s.fields || []));
            else if (parsed.fields) walk(parsed.fields);
            else if (Array.isArray(parsed)) walk(parsed);
          }
          setNominationFieldMap(newFieldMap);
          setProcessedNomFormIds(prev => new Set(prev).add(nomFormId));
        }
      }
    } catch (err) { console.error(err); }
    finally { setProfileLoading(false); }
  };

  const isFinalizedReview = (status: any) =>
    ['approved', 'rejected', 'completed'].includes(String(status));

  const isNominationSubmission = (row: any) => {
    if (!row) return false;
    if (row.nomination_id || row.nominationId || row.unique_token || row.nomination_token || row.nominationToken) return true;
    const formType = row.formId?.form_type || row.formId?.formType || row?.form_type || row?.formType;
    return formType === 'nomination';
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

    // Filter by Recommendation
    if (shortlistFilter.filter_type === 'next_level_only') {
      results = results.filter(s => {
        const reviews = s.level_reviews || [];
        if (shortlistFilter.source_level_id) {
          const sourceLevelNumber = levels.find(l => l.id === shortlistFilter.source_level_id)?.level_number;
          const sourceLevelReviews = reviews.filter((r: any) =>
            (r.level_id === shortlistFilter.source_level_id || r.level === sourceLevelNumber)
          );
          if (sourceLevelReviews.length === 0) return false;
          const allReviewed = sourceLevelReviews.every((r: any) => isFinalizedReview(r.status));
          const hasNextLevelRecommendation = sourceLevelReviews.some((r: any) => r.recommendation === 'next_level');
          return allReviewed && hasNextLevelRecommendation;
        }
        const allReviewed = reviews.every((r: any) => isFinalizedReview(r.status));
        return allReviewed && reviews.some((r: any) => r.recommendation === 'next_level');
      });
    }

    // Filter by Fields (AND logic)
    const activeFieldFilters = fieldFilters.filter(f => f.field_id && String(f.field_value).trim() !== '');
    const formFieldMap = new Map(
      getFormFilterFields().map((f: any) => [String(f.id), f])
    );
    if (activeFieldFilters.length > 0) {
      results = results.filter(s => {
        let responseArray: any[] = [];
        try {
          responseArray = Array.isArray(s.responses) ? s.responses : (typeof s.responses === 'string' ? JSON.parse(s.responses) : []);
        } catch { return false; }
        
        return activeFieldFilters.every(f => {
          const fieldResp = responseArray.find((r: any) => String(r.fieldId) === String(f.field_id));
          const fieldValue = fieldResp ? fieldResp.value : null;

          const actualValues = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
          const expectedText = String(f.field_value).trim().toLowerCase();
          const selectedField = formFieldMap.get(String(f.field_id));

          if (['gt', 'gte', 'lt', 'lte'].includes(f.operator) || selectedField?.type === 'number') {
            const expectedNum = Number(f.field_value);
            if (Number.isNaN(expectedNum)) return false;
            const numericVals = actualValues.map((v: any) => Number(v)).filter((n: number) => !Number.isNaN(n));
            if (numericVals.length === 0) return false;
            if (f.operator === 'gt') return numericVals.some((n: number) => n > expectedNum);
            if (f.operator === 'gte') return numericVals.some((n: number) => n >= expectedNum);
            if (f.operator === 'lt') return numericVals.some((n: number) => n < expectedNum);
            return numericVals.some((n: number) => n <= expectedNum);
          }

          if (f.operator === 'eq') {
            return actualValues.some((v: any) => String(v || '').trim().toLowerCase() === expectedText);
          }
          if (f.operator === 'neq') {
            return actualValues.every((v: any) => String(v || '').trim().toLowerCase() !== expectedText);
          }
          return actualValues.some((v: any) => String(v || '').toLowerCase().includes(expectedText));
        });
      });
    }

    setFilteredResults(results);
    setIsFiltering(false);
  };

  const createLevel = async () => {
    if (!selectedFormId || !levelForm.name) return alert('Fill all fields');
    await api.post('/review-levels', {
      form_id: selectedFormId, 
      level_number: levelForm.level_number, 
      name: levelForm.name,
      scoring_type: levelForm.scoring_type, 
      assignment_type: levelForm.assignment_type,
      blind_review: levelForm.blind_review,
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
        form_id: selectedFormId, 
        level_number: levelForm.level_number, 
        name: levelForm.name || `Level ${levelForm.level_number}`,
        scoring_type: levelForm.scoring_type, 
        assignment_type: levelForm.assignment_type,
        section_id: levelForm.section_id, // Pass section filter
        blind_review: levelForm.blind_review,
        show_previous_reviews: levelForm.show_previous_reviews,
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
      reviewer_ids: levelForm.reviewer_ids,
      show_previous_reviews: levelForm.show_previous_reviews
    });
    setShortlistResult(result);
    loadFormData(selectedFormId);
    setFilteredResults(null); // Clear after success
    setShowFilters(false); // Hide filters after assignment
  };

  // Reviewer: open review
  const openReview = async (review: any) => {
    setSelectedReview(review);
    setReviewHistory([]);
    try {
      const res = await api.get(`/submissions/${review.submission_id}`);
      if (res.success && res.data) {
        setSelectedSub(res.data);
      }
      
      // Respect level setting: only show previous reviewer marks when explicitly enabled.
      if (review.show_previous_reviews && Number(review.level) > 1) {
        const historyRes = await api.get(`/reviews?submission_id=${review.submission_id}`);
        if (Array.isArray(historyRes)) {
          const isFinalized = (r: any) => ['approved', 'rejected', 'completed'].includes(String(r?.status));
          const immediatePreviousLevel = Number(review.level) - 1;
          // Show only immediate previous level reviews (all reviewers from that level)
          setReviewHistory(
            historyRes.filter(r => isFinalized(r) && r.id !== review.id && Number(r.level) === immediatePreviousLevel)
          );
        }
      }
    } catch (err) {
      console.error("Failed to fetch review data:", err);
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

  const submitReview = async () => {
    if (!selectedReview) return;
    if (!recommendation) return alert('Please select a final recommendation');

    if (selectedReview.scoring_type === 'question_level') {
      const scoreError = validateQuestionScores();
      if (scoreError) return alert(scoreError);
    }

    // Decision logic: Reviewer can only Reject or move to Next Level
    const submissionStatus = recommendation === 'reject' ? 'rejected' : 'under_review';
    const reviewStatus = 'completed'; // Review itself is done

    await api.put('/reviews', { id: selectedReview.id, status: reviewStatus, comments: reviewComment });
    await api.put('/submissions', { id: selectedReview.submission_id, status: submissionStatus });
    
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

  // Auto-sync overall score with question scores when in question mode
  useEffect(() => {
    if (selectedReview?.scoring_type === 'question_level' && reviewQuestions.length > 0) {
      const total = reviewQuestions.reduce((sum, item) => {
        const score = Number(questionScores[item.fieldId] ?? questionScores[item.label] ?? 0) || 0;
        return sum + score;
      }, 0);
      if (total !== overallScore) {
        setOverallScore(total);
      }
    }
  }, [questionScores, reviewQuestions, selectedReview?.scoring_type, overallScore]);

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

  const parseObject = (raw: any): Record<string, any> => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch { return {}; }
    }
    return typeof raw === 'object' ? raw : {};
  };

  const parseResponseRecord = (raw: any): Record<string, any> => {
    if (!raw) return {};
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        const out: Record<string, any> = {};
        parsed.forEach((r: any) => {
          if (r?.fieldId) out[String(r.fieldId)] = r.value;
        });
        return out;
      }
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const getSubmissionDisplayName = (submission: any, fallbackName?: string) => {
    if (fallbackName && String(fallbackName).trim() && String(fallbackName).trim().toLowerCase() !== 'anonymous') {
      return toTitleCase(String(fallbackName).trim());
    }

    const responseMap = parseResponseRecord(submission?.responses);
    const schema =
      submission?.formId?.form_schema ||
      selectedFormObj?.form_schema ||
      forms.find((f: any) => String(f.id) === String(selectedFormId))?.form_schema;

    const fields = (schema?.sections || []).flatMap((s: any) => s?.fields || []);
    const nameField = fields.find((f: any) => /name/i.test(String(f?.label || '')));

    const candidateName =
      (nameField?.id ? responseMap[String(nameField.id)] : undefined) ||
      responseMap.name ||
      responseMap.full_name ||
      responseMap.teacher_name;

    if (candidateName == null) return 'Anonymous';
    const normalized = String(candidateName).trim();
    return normalized ? toTitleCase(normalized) : 'Anonymous';
  };

  const escapeHtml = (value: any) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatResponseValue = (value: any) => {
    if (Array.isArray(value)) return value.join(', ');
    if (value == null) return '';
    return String(value);
  };

  const exportCSV = async () => {
    if (!selectedFormId) return;
    
    // Collect all possible fields
    const baseFields = [
      { id: 'id', label: 'Reference ID' },
      { id: 'form_title', label: 'Form Title' },
      { id: 'user_name', label: 'Submitted By' },
      { id: 'user_email', label: 'Email' },
      { id: 'school_code', label: 'School Code' },
      { id: 'status', label: 'Status' },
      { id: 'score', label: 'Score' }
    ];
    const dynamicFields = filterableFields.map(f => ({ id: f.id, label: f.label || f.id }));
    
    const nominationKeys = new Set<string>();
    const subs = getExportData();
    subs.forEach((s: any) => {
      const nom = s.nomination_id || s.nominationId;
      if (nom && typeof nom === 'object') {
        const addData = parseObject(nom.additional_data);
        Object.keys(addData).forEach(k => nominationKeys.add(k));
      }
    });

    const functionaryFields = Array.from(nominationKeys).map(k => ({
      id: `nom_${k}`,
      label: `Nomination: ${k.replace(/_/g, ' ')}`
    }));

    const dateField = { id: 'submitted_at', label: 'Submission Date' };

    const allPossibleFields = [...baseFields, ...dynamicFields, ...functionaryFields, dateField];
    setCsvSelectedFields(allPossibleFields.map(f => f.id));
    setShowCsvConfig(true);
  };

  const handleCsvDownload = () => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${minutes}`;
    };

    const dataToExport = getExportData();
    const baseFields = [
      { id: 'id', label: 'Reference ID' },
      { id: 'form_title', label: 'Form Title' },
      { id: 'user_name', label: 'Submitted By' },
      { id: 'user_email', label: 'Email' },
      { id: 'school_code', label: 'School Code' },
      { id: 'status', label: 'Status' },
      { id: 'score', label: 'Score' }
    ];
    const dynamicFields = filterableFields.map(f => ({ id: f.id, label: f.label || f.id }));
    
    const nominationKeys = new Set<string>();
    dataToExport.forEach((s: any) => {
      const nom = s.nomination_id || s.nominationId;
      if (nom && typeof nom === 'object') {
        const addData = parseObject(nom.additional_data);
        Object.keys(addData).forEach(k => nominationKeys.add(k));
      }
    });

    const functionaryFields = Array.from(nominationKeys).map(k => ({
      id: `nom_${k}`,
      label: `Nomination: ${k.replace(/_/g, ' ')}`
    }));

    const dateField = { id: 'submitted_at', label: 'Submission Date' };

    const allPossibleFields = [...baseFields, ...dynamicFields, ...functionaryFields, dateField];
    const activeFields = allPossibleFields.filter(f => csvSelectedFields.includes(f.id));
    
    const headers = activeFields.map(f => f.label);
    
    const rows = dataToExport.map((s: any) => {
      const resps = parseResponseRecord(s.responses);
      const nom = s.nomination_id || s.nominationId;
      const nomData = nom && typeof nom === 'object' ? parseObject(nom.additional_data) : {};

      return activeFields.map(f => {
        if (f.id === 'id') return isNominationSubmission(s) ? (s.unique_token || s.nomination_token || s.id) : s.id;
        if (f.id === 'form_title') return s.form_title || selectedFormObj?.title || '';
        if (f.id === 'user_name') return s.user_name || 'Anonymous';
        if (f.id === 'user_email') return s.user_email || '';
        if (f.id === 'school_code') return s.school_code || '';
        if (f.id === 'status') return s.status;
        if (f.id === 'score') return typeof s.score === 'object' ? s.score?.percentage ?? '' : (s.score ?? '');
        if (f.id === 'submitted_at') return formatDate(s.submitted_at || s.createdAt || '');
        
        if (f.id.startsWith('nom_')) {
          const key = f.id.replace('nom_', '');
          const val = nomData[key];
          if (val === undefined || val === null) return '';
          return String(val).includes(',') ? `"${val}"` : val;
        }

        const val = formatResponseLabelValue(f.id, resps[f.id]);
        if (val === undefined || val === null) return '';
        if (Array.isArray(val)) return `"${val.join(', ')}"`;
        const strVal = String(val);
        return strVal.includes(',') || strVal.includes('"') || strVal.includes('\n') ? `"${strVal.replace(/"/g, '""')}"` : strVal;
      });
    });

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `review-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowCsvConfig(false);
  };

  const exportZIP = async () => {
    if (!selectedFormId) return;
    
    // Set default fields for ZIP export
    const base = ['id', 'form_title', 'user_name', 'user_email', 'school_code', 'status', 'score'];
    const dynamic = filterableFields.map(f => f.id);
    const nomKeys = new Set<string>();
    const subs = getExportData();
    subs.forEach((s: any) => {
      const nom = s.nomination_id || s.nominationId;
      if (nom && typeof nom === 'object') {
        const addData = parseObject(nom.additional_data);
        Object.keys(addData).forEach(k => nomKeys.add(k));
      }
    });
    const noms = Array.from(nomKeys).map(k => `nom_${k}`);
    setZipSelectedFields([...base, ...dynamic, ...noms, 'submitted_at']);
    
    setShowExportConfig(true);
  };

  const handleZipDownload = async () => {
    try {
      setShowExportConfig(false);
      const params = new URLSearchParams();
      params.append('namingStrategy', exportNamingStrategy);
      if (exportNamingStrategy === 'school') {
        params.append('subNamingStrategy', exportSubNamingStrategy);
      }
      if (includeNominationData) {
        params.append('include_nomination', 'true');
      }
      if (zipSelectedFields.length > 0) {
        params.append('fields', JSON.stringify(zipSelectedFields));
      }
      
      // If we have an active stage level filter, pass it
      if (activeFilterLevel > 1) {
        params.append('level', String(activeFilterLevel - 1));
        // If "Shortlisted Only" is implicitly what we want when viewing a level
        params.append('shortlisted_only', 'true');
      }
      
      const blob = await (api as any).download(`/forms/${selectedFormId}/export/zip?${params.toString()}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedFormObj?.title || 'export'}_package.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('ZIP Export Error:', err);
      alert('Failed to generate ZIP package: ' + err.message);
    }
  };

  const printSubmissionProfile = ({
    profile,
    submission,
    responseRows
  }: {
    profile: any;
    submission: any;
    responseRows: Array<{ label: string; value: any }>;
  }) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      alert('Popup blocked. Please allow popups to print the profile.');
      return;
    }

    const name = getSubmissionDisplayName(submission, submission?.user_name);
    const formScore =
      submission?.score != null
        ? `${Number(typeof submission.score === 'object' ? submission.score?.percentage : submission.score).toFixed(2)}%`
        : 'N/A';

    const levels = Array.isArray(profile?.levels) ? profile.levels : [];
    const comments = Array.isArray(profile?.comments) ? profile.comments : [];
    const statusText = String(submission?.status || 'N/A').replace(/_/g, ' ');

    const responsesHtml = responseRows.length
      ? responseRows.map((row, idx) => {
          const val = row.value;
          let displayValue = '';
          
          if (Array.isArray(val)) {
            displayValue = val.join(', ');
          } else if (val == null) {
            displayValue = '—';
          } else {
            const sVal = String(val);
            const isFile = (/\.(pdf|docx|xlsx|pptx|txt|jpg|jpeg|png|gif|webp)$/i.test(sVal) || sVal.includes('res.cloudinary.com'));
            if (isFile) {
              const fileUrl = sVal.startsWith('http') ? sVal : `${(import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(sVal)}`;
              displayValue = `<a href="${fileUrl}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: bold;">View File</a>`;
            } else {
              displayValue = escapeHtml(sVal);
            }
          }

          return `
            <tr>
              <td>${idx + 1}</td>
              <td>${escapeHtml(row.label)}</td>
              <td>${displayValue}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="3">No responses available.</td></tr>';

    const levelsHtml = levels.length
      ? levels.map((lvl: any) => {
          const scoreRows = Array.isArray(lvl?.scores) ? lvl.scores : [];
          const scoreHtml = scoreRows.length
            ? scoreRows.map((s: any, i: number) => `
                <tr>
                  <td>R${i + 1}</td>
                  <td>${escapeHtml(s?.overall_score ?? 'N/A')}</td>
                  <td>${escapeHtml(String(s?.recommendation || '').replace(/_/g, ' ') || 'N/A')}</td>
                  <td>${escapeHtml(s?.comments || '-')}</td>
                </tr>
              `).join('')
            : '<tr><td colspan="4">No reviews recorded at this level.</td></tr>';

          return `
            <section class="card">
              <h3>Level ${escapeHtml(lvl?.level_number || '-')} - ${escapeHtml(lvl?.level_name || 'Unnamed')}</h3>
              <p class="muted">Scoring: ${escapeHtml(String(lvl?.scoring_type || '').replace(/_/g, ' '))} | Review Mode: ${lvl?.blind_review ? 'Blind' : 'Open'}</p>
              <table>
                <thead><tr><th>Reviewer</th><th>Score</th><th>Recommendation</th><th>Comments</th></tr></thead>
                <tbody>${scoreHtml}</tbody>
              </table>
            </section>
          `;
        }).join('')
      : '<section class="card"><p>No level-wise review data available.</p></section>';

    const commentsHtml = comments.length
      ? `
        <section class="card">
          <h3>Comments Timeline</h3>
          ${comments.map((c: any) => `
            <div class="comment">
              <div><strong>${escapeHtml(c?.user_name || 'User')}</strong> (${escapeHtml(c?.user_role || '-')})</div>
              <div class="muted">${escapeHtml(c?.created_at ? new Date(c.created_at).toLocaleString() : '-')}</div>
              <div>${escapeHtml(c?.content || '')}</div>
            </div>
          `).join('')}
        </section>
      `
      : '';

    const nom = submission.nominationId || submission.nomination_id;
    const addData = nom ? parseObject(nom.additional_data) : {};
    const nominationHtml = nom && Object.keys(addData).length > 0
      ? `
        <section class="card">
          <h2>School Functionary Details</h2>
          <div class="meta">
            <div><strong>Nominated Teacher:</strong> ${escapeHtml(nom.teacher_name)}</div>
            <div><strong>School Code:</strong> ${escapeHtml(nom.school_code)}</div>
            ${Object.entries(addData).map(([key, val]) => `
              <div><strong>${escapeHtml(nominationFieldMap[key] || key.replace(/_/g, ' '))}:</strong> ${escapeHtml(String(val))}</div>
            `).join('')}
          </div>
        </section>
      `
      : '';

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Submission Profile - ${escapeHtml(name)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; line-height: 1.45; }
          .header { border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
          .title { font-size: 22px; font-weight: 700; margin: 0; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; font-size: 13px; }
          .muted { color: #475569; font-size: 12px; }
          .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 12px 0; page-break-inside: avoid; }
          h2 { margin: 0 0 10px 0; font-size: 18px; }
          h3 { margin: 0 0 6px 0; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; font-size: 12px; }
          th { background: #f8fafc; font-weight: 700; }
          .comment { border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 8px; white-space: pre-wrap; }
          @media print {
            body { margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <section class="header">
          <h1 class="title">${escapeHtml(name)}</h1>
          <div class="muted">${escapeHtml(submission?.user_email || '')}</div>
          <div class="meta">
            <div><strong>Form:</strong> ${escapeHtml(submission?.form_title || '-')}</div>
            <div><strong>Status:</strong> ${escapeHtml(statusText)}</div>
            <div><strong>Form Score:</strong> ${escapeHtml(formScore)}</div>
            <div><strong>Level Progress:</strong> ${escapeHtml(`${profile?.highest_level || 0}/${profile?.total_levels || 0}`)}</div>
          </div>
        </section>

        ${nominationHtml}

        <section class="card">
          <h2>Form Responses</h2>
          <table>
            <thead><tr><th>#</th><th>Field</th><th>Response</th></tr></thead>
            <tbody>${responsesHtml}</tbody>
          </table>
        </section>

        <section>
          <h2>Level-wise Review Scores</h2>
          ${levelsHtml}
        </section>

        ${commentsHtml}
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    // Give the new document a moment to render before triggering browser print.
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        alert('Unable to start printing automatically. Please use Ctrl+P in the print window.');
      }
    }, 250);
  };

  // ═══════════ ADMIN VIEW ═══════════
  if (user.role === 'admin') {
    const subs = shortlistData?.submissions || [];
    const formLevels = shortlistData?.levels || [];
    const currentStageNumber = activeFilterLevel > 1 ? activeFilterLevel - 1 : null;
    const stageDefaultSubmissions = currentStageNumber
      ? subs.filter((s: any) => (s.level_reviews || []).some((r: any) => r.level === currentStageNumber))
      : subs;
    const actionCandidates = filteredResults !== null
      ? filteredResults
      : (activeFilterLevel > 1 ? stageDefaultSubmissions : null);
    const getLevelReviews = (levelNumber: number) =>
      subs.flatMap((s: any) => (s.level_reviews || []).filter((r: any) => r.level === levelNumber));
    const getReviewerKey = (review: any) => {
      const reviewer = review?.reviewer_id;
      if (reviewer && typeof reviewer === 'object') return String(reviewer._id || reviewer.id || '');
      return String(reviewer || '');
    };
    const isSubmissionPendingAtLevel = (submission: any, levelNumber: number) => {
      const reviewsAtLevel = (submission?.level_reviews || []).filter((r: any) => r.level === levelNumber);
      if (reviewsAtLevel.length === 0) return false;

      // Reviewer-wise completion: if a reviewer has any finalized row, that reviewer is considered done.
      const reviewerState = new Map<string, { done: boolean }>();
      for (const review of reviewsAtLevel) {
        const key = getReviewerKey(review) || `review-${review?.id || Math.random()}`;
        const prev = reviewerState.get(key) || { done: false };
        reviewerState.set(key, { done: prev.done || isFinalizedReview(review?.status) });
      }

      return Array.from(reviewerState.values()).some((state) => !state.done);
    };
    const isLevelFullyReviewed = (levelNumber: number) => {
      const reviewsAtLevel = getLevelReviews(levelNumber);
      if (reviewsAtLevel.length === 0) return false;
      return !subs.some((s: any) => isSubmissionPendingAtLevel(s, levelNumber));
    };
    const isCurrentStageAssigned = formLevels.some((l: any) => {
      if (l.level_number !== activeFilterLevel) return false;
      const atLevel = subs.filter((s: any) => s.highest_level >= l.level_number).length;
      return atLevel > 0;
    });
    const sourceLevelNumberForNext = activeFilterLevel > 1 ? activeFilterLevel - 1 : null;
    const sourceLevelReviewsForNext = sourceLevelNumberForNext ? getLevelReviews(sourceLevelNumberForNext) : [];
    const sourceLevelHasAnyReviewsForNext = sourceLevelReviewsForNext.length > 0;
    const sourceLevelPendingFormsForNext = sourceLevelNumberForNext
      ? subs.filter((s: any) => isSubmissionPendingAtLevel(s, sourceLevelNumberForNext)).length
      : 0;
    const isNextShortlistBlocked = activeFilterLevel > 1 && (!sourceLevelHasAnyReviewsForNext || sourceLevelPendingFormsForNext > 0);
    const selectableLevels = !currentStageNumber
      ? formLevels
      : formLevels.filter((l: any) => l.level_number <= currentStageNumber);
    const selectedLevelNumber = selectedLevelColumn === 'all' ? null : Number(selectedLevelColumn);
    const hasSelectedLevel = selectedLevelNumber != null && selectableLevels.some((l: any) => l.level_number === selectedLevelNumber);
    const visibleLevelColumns = selectedLevelColumn === 'all'
      ? selectableLevels
      : (hasSelectedLevel ? selectableLevels.filter((l: any) => l.level_number === selectedLevelNumber) : selectableLevels);

    const subColumns = [
      { key: 'id', label: 'Reference ID', sortable: true, render: (_v: string, row: any) => {
        const isNom = isNominationSubmission(row);
        const refId = isNom ? (row.unique_token || row.nomination_token || row.id) : row.id;
        return <span className="text-[10px] font-mono text-slate-500">{refId || '—'}</span>;
      }},
      { key: 'user_name', label: 'Name', sortable: true, render: (v: string, r: any) => (
        <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{(v||'?')[0]}</div>
          <div><p className="text-sm font-medium">{getSubmissionDisplayName(r, v)}</p><p className="text-[10px] text-slate-500">{r.user_email}</p></div></div>) },
      { key: 'score', label: 'Form Score', sortable: true, render: (v: any) => v != null ? <span className="font-bold text-sm text-primary">{Number(typeof v === 'object' ? v?.percentage : v).toFixed(2)}%</span> : <span className="text-slate-500">—</span> },
      ...visibleLevelColumns.map((l: any) => ({
        key: `level_${l.level_number}`, label: `L${l.level_number}`, sortable: true,
        render: (_: any, r: any) => {
          const reviews = (r.level_reviews || []).filter((rv: any) => rv.level === l.level_number);
          if (reviews.length === 0) return <span className="text-slate-400 text-[10px]">—</span>;
          
          const completedReviews = reviews.filter((rv: any) => ['approved', 'rejected', 'completed'].includes(String(rv.status)));
          const scores = completedReviews.map((rv: any) => rv.overall_score || 0);
          const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1">
                {reviews.map((rv: any, idx: number) => (
                  <div key={idx} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                    rv.status === 'pending' ? 'bg-slate-50 border-slate-200 text-slate-400 border-dashed' :
                    rv.recommendation === 'reject' ? 'bg-red-50 border-red-200 text-red-600' :
                    rv.recommendation === 'next_level' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                    'bg-slate-50 border-slate-200 text-slate-600'
                  }`} title={`${rv.reviewer_name || 'Reviewer'}: ${rv.status === 'pending' ? 'Pending' : rv.recommendation}`}>
                    {rv.status === 'pending' ? '...' : rv.overall_score}
                  </div>
                ))}
              </div>
              {completedReviews.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="h-px flex-1 bg-primary/10" />
                  <div className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 shadow-sm">
                    AVG: {avg.toFixed(1)}
                  </div>
                </div>
              )}
            </div>
          );
        }
      })),
      { key: 'highest_level', label: 'Reached', sortable: true, render: (v: number) => v > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">L{v}</span> : <span className="text-slate-500 text-xs">—</span> },
      {
        key: 'status',
        label: 'Status',
        render: (v: string, r: any) => {
          if (currentStageNumber) {
            const stageReviews = (r.level_reviews || []).filter((rv: any) => rv.level === currentStageNumber);
            const hasFinalizedStageReview = stageReviews.some((rv: any) => isFinalizedReview(rv.status));
            if (!hasFinalizedStageReview) {
              return <span className="text-slate-400 text-xs">—</span>;
            }
          }
          return <StatusBadge status={v} />;
        }
      },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold font-heading">Review & Shortlisting</h1>
            <p className="text-sm text-slate-500">Manage teacher selection process in 3 simple steps</p>
          </div>
          {selectedFormId && (
            <div className="flex items-center gap-2">
              <button 
                onClick={exportCSV}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 shadow-sm transition-all"
              >
                <FileDown size={16} /> Export CSV
              </button>
              <button 
                onClick={exportZIP}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover shadow-sm transition-all"
              >
                <Archive size={16} /> Export ZIP
              </button>
            </div>
          )}
        </div>

        {/* STEP 1: Form Selection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</span>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Select Form</h2>
            </div>
            <select 
              value={selectedFormId} 
              onChange={e => { const id = e.target.value; if (id) loadFormData(id); else { setSelectedFormId(''); setShortlistData(null); setFilteredResults(null); } }}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            >
              <option value="">Choose a form to start review process...</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title} ({f.form_type}) — {f.status}</option>)}
            </select>
          </div>
        </div>

        {loadingSubs && <div className="flex justify-center py-12"><div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>}

        {selectedFormId && shortlistData && !loadingSubs && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* STEP 2: Filters (Left Column) - Only for Level 1 */}
            <div className="lg:col-span-1 space-y-6">
              {activeFilterLevel === 1 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-6 overflow-hidden">
                  {isCurrentStageAssigned && (
                    <div className="absolute inset-0 bg-slate-50/40 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-amber-500 mb-3 border border-amber-100">
                        <Settings className="animate-spin" size={24} style={{ animationDuration: '3s' }} />
                      </div>
                      <p className="text-sm font-bold text-slate-800">Stage 1 Assigned</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-medium">Candidates have already been assigned to Stage 1 review.</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">2</span>
                      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Filter Teachers</h2>
                    </div>
                    <button 
                      onClick={() => setShowFilters(!showFilters)}
                      disabled={isCurrentStageAssigned}
                      className={`p-2 rounded-xl transition-all ${showFilters ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} ${isCurrentStageAssigned ? 'opacity-0' : ''}`}
                    >
                      <Filter size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {showFilters ? (
                      <>
                        {/* Section 2: Filter Logic */}
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filter Logic</label>
                            <select value={shortlistFilter.filter_type} onChange={e => setShortlistFilter(p => ({ ...p, filter_type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium outline-none focus:border-primary">
                              <option value="all">View All Submissions</option>
                              <option value="form_score_gte">Score Based Filter</option>
                              <option value="next_level_only">Next Level Recommendations</option>
                            </select>

                            {(shortlistFilter.filter_type === 'form_score_gte' || shortlistFilter.filter_type === 'next_level_only') && (
                              <div className="grid grid-cols-1 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                {shortlistFilter.filter_type === 'form_score_gte' && (
                                  <div>
                                    <p className="text-[9px] font-bold text-slate-400 mb-1">Minimum Score %</p>
                                    <input type="number" value={shortlistFilter.filter_value} onChange={e => setShortlistFilter(p => ({ ...p, filter_value: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none" placeholder="e.g. 80" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-[9px] font-bold text-slate-400 mb-1">{shortlistFilter.filter_type === 'next_level_only' ? 'Filter From Level' : 'Specific Level (Optional)'}</p>
                                  <select value={shortlistFilter.source_level_id} onChange={e => setShortlistFilter(p => ({ ...p, source_level_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none">
                                    <option value="">Any Level</option>
                                    {(shortlistData?.levels || []).map((l: any) => <option key={l.id} value={l.id}>L{l.level_number}: {l.name}</option>)}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Advanced Filters */}
                          <div className="space-y-3 pt-4 border-t border-slate-100">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Advanced Field Filters</label>
                            <div className="space-y-3">
                              {fieldFilters.map((row, idx) => {
                                const fields = getFormFilterFields();
                                const selectedField = fields.find(f => f.id === row.field_id);
                                const options = getFieldOptionValues(selectedField);
                                const isNumber = selectedField?.type === 'number';
                                
                                return (
                                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3 relative">
                                    <button onClick={() => setFieldFilters(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-md">
                                      <XCircle size={14} />
                                    </button>
                                    <select value={row.field_id} onChange={e => setFieldFilters(prev => prev.map((r, i) => {
                                      if (i !== idx) return r;
                                      const nextField = fields.find((fld: any) => String(fld.id) === e.target.value);
                                      return { ...r, field_id: e.target.value, operator: getDefaultOperator(nextField), field_value: '' };
                                    }))}
                                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none font-medium">
                                      <option value="">Select specific field...</option>
                                      {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                    </select>

                                    <div className="grid grid-cols-2 gap-2">
                                      <select
                                        value={row.operator}
                                        onChange={e => setFieldFilters(prev => prev.map((r, i) => i === idx ? { ...r, operator: e.target.value as FieldFilterRow['operator'] } : r))}
                                        className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] outline-none font-bold text-slate-600"
                                      >
                                        {isNumber ? (
                                          <>
                                            <option value="gt">Greater (&gt;)</option>
                                            <option value="gte">Gte (&gt;=)</option>
                                            <option value="lt">Less (&lt;)</option>
                                            <option value="lte">Lte (&lt;=)</option>
                                            <option value="eq">Equals</option>
                                          </>
                                        ) : (
                                          <>
                                            <option value="contains">Contains</option>
                                            <option value="eq">Exactly</option>
                                          </>
                                        )}
                                      </select>

                                      {options.length > 0 ? (
                                        <select value={row.field_value} onChange={e => setFieldFilters(prev => prev.map((r, i) => i === idx ? { ...r, field_value: e.target.value } : r))}
                                          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] outline-none font-medium">
                                          <option value="">Value...</option>
                                          {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      ) : (
                                        <input type={isNumber ? 'number' : 'text'} value={row.field_value} onChange={e => setFieldFilters(prev => prev.map((r, i) => i === idx ? { ...r, field_value: e.target.value } : r))}
                                          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] outline-none font-medium" placeholder="Match..." />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              <button onClick={() => setFieldFilters(prev => [...prev, { field_id: '', operator: 'contains', field_value: '' }])} className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-[11px] font-bold text-slate-400 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2">
                                <Zap size={12} /> Add New Condition
                              </button>
                            </div>
                          </div>

                          <button onClick={applyFilters} disabled={isFiltering}
                            className="w-full py-4 bg-primary text-white rounded-2xl text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all active:scale-95">
                            {isFiltering ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Filter size={18} />}
                            Apply Filters
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Filter size={20} />
                        </div>
                        <p className="text-xs text-slate-500 font-medium mb-4 px-4">
                          Click filter to shortlist candidates for the next stage.
                        </p>
                        <button 
                          onClick={() => setShowFilters(true)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-xl transition-all"
                        >
                          Open Filters
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* STEP 3: Pipeline & Action (Right Column) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Shortlist Action Bar */}
              {actionCandidates !== null && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden transition-all ${isCurrentStageAssigned ? 'bg-slate-800 shadow-slate-900/20' : 'bg-navy shadow-navy/20'}`}>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isCurrentStageAssigned ? 'bg-white/5 text-slate-400' : 'bg-white/10 text-white'}`}>
                      {isCurrentStageAssigned ? <History size={24} /> : <UserCheck size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${isCurrentStageAssigned ? 'bg-slate-700 text-slate-400' : 'bg-white text-navy'}`}>{activeFilterLevel === 1 ? '3' : '2'}</span>
                        <h2 className="text-base font-bold">
                          {isCurrentStageAssigned 
                            ? `Stage ${activeFilterLevel === 1 ? '1' : activeFilterLevel - 1} Assignment Locked` 
                            : activeFilterLevel === 1 
                              ? "Assign to Review Level" 
                              : `Move to Stage ${activeFilterLevel - 1}`}
                        </h2>
                      </div>
                      <p className={`text-xs mt-0.5 ${isCurrentStageAssigned ? 'text-slate-500' : 'text-blue-200'}`}>
                        {isCurrentStageAssigned 
                          ? "This stage has already been finalized and assigned."
                          : activeFilterLevel === 1 
                            ? `${actionCandidates.length} teachers match your filters` 
                            : `${actionCandidates.length} recommended candidates ready for next stage`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
                    <button onClick={() => setFilteredResults(null)} className={`flex-1 md:flex-none px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${isCurrentStageAssigned ? 'text-slate-500 hover:bg-white/5' : 'text-blue-100 hover:text-white hover:bg-white/10'}`}>
                      {isCurrentStageAssigned ? 'Close' : 'Cancel'}
                    </button>
                    {!isCurrentStageAssigned && (
                      <button onClick={() => { 
                          if (isNextShortlistBlocked) {
                            const lockReason = sourceLevelHasAnyReviewsForNext
                              ? `${sourceLevelPendingFormsForNext} forms are still pending in Stage ${sourceLevelNumberForNext}.`
                              : `No reviews have started in Stage ${sourceLevelNumberForNext} yet.`;
                            alert(`Next level shortlisting is disabled. ${lockReason} Please wait until all reviewers complete their reviews.`);
                            return;
                          }
                          // Total Pool (activeFilterLevel=1) should always feed Level 1.
                          const nextLvlNum = activeFilterLevel === 1 ? 1 : activeFilterLevel;
                          setLevelForm(p => ({ ...p, level_number: nextLvlNum, name: `Level ${nextLvlNum}` })); 
                          setShowShortlist(true); 
                        }}
                        disabled={isNextShortlistBlocked}
                        className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2 transition-all ${isNextShortlistBlocked ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none' : 'bg-white text-navy hover:bg-blue-50 active:scale-95'}`}>
                        <Layers size={18} /> {activeFilterLevel === 1 ? "Shortlist Now" : "Confirm Assignment"}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Visual Pipeline */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                      <TrendingUp size={16} className="text-primary" /> Selection Pipeline
                    </h3>
                    {formLevels.length > 0 && (
                      <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full border border-primary/20">
                        {formLevels.length} Stages Active
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg uppercase">Visual Flow</p>
                </div>
                {formLevels.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Layers size={32} className="mx-auto text-slate-300 mb-2 opacity-50" />
                    <p className="text-xs text-slate-500 italic font-medium">No levels created yet. Start by filtering and shortlisting teachers.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 overflow-x-auto pb-6 pt-2 custom-scrollbar snap-x snap-mandatory">
                    <button 
                      onClick={() => {
                        setActiveFilterLevel(1);
                        setFilteredResults(null);
                        setShortlistFilter(p => ({ ...p, filter_type: 'all', source_level_id: '' }));
                      }}
                      className={`flex-shrink-0 p-4 rounded-2xl border-2 text-center min-w-[120px] shadow-sm snap-start transition-all ${activeFilterLevel === 1 ? 'bg-primary/10 border-primary' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}
                    >
                      <p className={`text-2xl font-black ${activeFilterLevel === 1 ? 'text-primary' : 'text-slate-400'}`}>{subs.length}</p>
                      <p className={`text-[10px] font-bold uppercase mt-1 ${activeFilterLevel === 1 ? 'text-primary' : 'text-slate-500'}`}>Total Pool</p>
                    </button>
                    {formLevels.map((l: any, idx: number) => {
                      const atLevel = subs.filter((s: any) => s.highest_level >= l.level_number).length;
                      const isActive = activeFilterLevel === idx + 2;
                      const sourceLevelReviews = getLevelReviews(l.level_number);
                      // Pending should be counted per submission, not per reviewer row.
                      const pendingSubmissionCount = subs.filter((s: any) => isSubmissionPendingAtLevel(s, l.level_number)).length;
                      const hasAnyReviews = sourceLevelReviews.length > 0;
                      const isStageLocked = !hasAnyReviews || pendingSubmissionCount > 0;
                      return (<React.Fragment key={l.id}>
                        <div className="flex flex-col items-center gap-1 opacity-40 flex-shrink-0">
                          <ChevronRight size={20} className="text-slate-400" />
                        </div>
                        <button 
                          onClick={() => {
                            setActiveFilterLevel(idx + 2);
                            setFilteredResults(null);
                            setShortlistFilter(p => ({ ...p, filter_type: 'next_level_only', source_level_id: l.id }));
                          }}
                          className={`flex-shrink-0 p-4 rounded-2xl border-2 text-center min-w-[150px] shadow-md relative group transition-all snap-center ${isStageLocked ? 'bg-slate-50 border-slate-200 opacity-70 cursor-pointer' : isActive ? 'bg-white border-primary ring-2 ring-primary/10' : 'bg-white border-primary/20 hover:border-primary/50'}`}
                        >
                          <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase shadow-lg z-10 whitespace-nowrap transition-colors ${isStageLocked ? 'bg-slate-500' : isActive ? 'bg-primary' : 'bg-slate-400 group-hover:bg-primary/70'}`}>Stage {idx + 1}</div>
                          <p className={`text-[10px] font-black uppercase mb-1 tracking-tighter truncate px-2 ${isStageLocked ? 'text-slate-500' : isActive ? 'text-primary' : 'text-slate-400 group-hover:text-primary/70'}`}>{l.name}</p>
                          <p className={`text-2xl font-black ${isActive ? 'text-slate-900' : 'text-slate-800'}`}>{atLevel}</p>
                          <p className={`text-[9px] font-bold uppercase mt-1 ${isStageLocked ? 'text-amber-600' : isActive ? 'text-primary/60' : 'text-slate-400'}`}>
                            {isStageLocked ? (hasAnyReviews ? `${pendingSubmissionCount} Pending` : 'No Reviews Yet') : 'Shortlisted'}
                          </p>
                        </button>
                      </React.Fragment>);
                    })}
                    {/* Next Stage Placeholder / Add Level */}
                    {(() => {
                      const latestLevel = formLevels[formLevels.length - 1];
                      const latestLevelNumber = latestLevel?.level_number || 1;
                      const canAddNextLevel = latestLevel ? isLevelFullyReviewed(latestLevelNumber) : true;
                      return (
                        <>
                    <div className="flex flex-col items-center gap-1 opacity-20 flex-shrink-0">
                      <ChevronRight size={20} className="text-slate-400" />
                    </div>
                    <button 
                      onClick={() => {
                        if (!canAddNextLevel) {
                          alert(`Please complete all reviews for Stage ${latestLevelNumber} first. Then the next stage can be added.`);
                          return;
                        }
                        setLevelForm(p => ({ 
                          ...p, 
                          level_number: formLevels.length + 1, 
                          name: `Level ${formLevels.length + 1}`,
                          reviewer_ids: []
                        }));
                        setShowShortlist(true);
                      }}
                      className={`flex-shrink-0 p-4 rounded-2xl border-2 border-dashed text-center min-w-[140px] transition-all group snap-end ${canAddNextLevel ? 'border-slate-200 hover:border-primary hover:bg-primary/5 hover:opacity-100 opacity-40' : 'border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed'}`}
                    >
                      <p className="text-[10px] font-black text-slate-400 group-hover:text-primary uppercase mb-1">Stage {formLevels.length + 1}</p>
                      <div className="flex items-center justify-center gap-1 text-slate-400 group-hover:text-primary">
                        <Plus size={14} />
                        <p className="text-sm font-bold">Add Level</p>
                      </div>
                    </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Submissions table */}
              <DataTable
                title={filteredResults !== null ? "Filtered Teachers" : (currentStageNumber ? `Stage ${currentStageNumber} Submissions` : "All Submissions")}
                subtitle={filteredResults !== null 
                  ? `${filteredResults.length} teachers selected for shortlisting` 
                  : (currentStageNumber ? `Showing teachers currently in Stage ${currentStageNumber}` : "Use the filters on the left to shortlist teachers for review")}
                headerActions={selectableLevels.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Level</span>
                    <select
                      value={hasSelectedLevel || selectedLevelColumn === 'all' ? selectedLevelColumn : 'all'}
                      onChange={(e) => setSelectedLevelColumn(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold outline-none focus:border-primary"
                    >
                      <option value="all">All Levels</option>
                      {selectableLevels.map((l: any) => (
                        <option key={l.id} value={String(l.level_number)}>
                          L{l.level_number}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                columns={subColumns}
                data={filteredResults !== null ? filteredResults : stageDefaultSubmissions}
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
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-wider">Specific Form Section (Optional)</label>
                      <select 
                        value={levelForm.section_id || ''} 
                        onChange={e => setLevelForm(p => ({ ...p, section_id: e.target.value }))} 
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none focus:border-primary"
                      >
                        <option value="">Full Form (All Sections)</option>
                        {selectedFormObj?.form_schema?.sections?.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-400 mt-1 italic">If selected, reviewers will only see and grade this specific section.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-wider">Scoring Mode</label>
                        <select value={levelForm.scoring_type} onChange={e => setLevelForm(p => ({ ...p, scoring_type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none focus:border-primary">
                          <option value="form_level">Overall Scoring</option>
                          <option value="question_level">Question-wise Scoring</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-wider">Reviewer Workload</label>
                        <select value={levelForm.assignment_type} onChange={e => setLevelForm(p => ({ ...p, assignment_type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none focus:border-primary">
                          <option value="all">Assign Full Form to All</option>
                          <option value="divide_sections">Divide Forms Among Reviewers</option>
                        </select>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-500 leading-relaxed italic">
                        {levelForm.assignment_type === 'all' 
                          ? "Every reviewer will see every teacher's full form." 
                          : "Teachers will be split equally among the assigned reviewers."}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 cursor-pointer group">
                        <input type="checkbox" checked={levelForm.blind_review} onChange={e => setLevelForm(p => ({ ...p, blind_review: e.target.checked }))} className="w-4 h-4 rounded accent-primary" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Blind Review</p>
                          <p className="text-[10px] text-slate-500">Hide teacher names</p>
                        </div>
                      </label>
                      <label className={`flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 group ${levelForm.level_number === 1 ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={levelForm.level_number === 1 ? false : levelForm.show_previous_reviews}
                          disabled={levelForm.level_number === 1}
                          onChange={e => setLevelForm(p => ({ ...p, show_previous_reviews: e.target.checked }))}
                          className="w-4 h-4 rounded accent-primary disabled:opacity-60"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Show Previous Reviews</p>
                          <p className="text-[10px] text-slate-500">
                            {levelForm.level_number === 1 ? 'Level 1 me hamesha OFF rahega' : 'Reviewers can see marks'}
                          </p>
                        </div>
                      </label>
                    </div>
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
            const displayName = getSubmissionDisplayName(sub, sub.user_name);
            const formSchema = sub.formId?.form_schema || selectedFormObj?.form_schema;
            let responseList: { label: string, value: any }[] = [];
            
            try { 
              const raw = typeof sub.responses === 'string' ? JSON.parse(sub.responses) : (sub.responses || []);
              const responses = Array.isArray(raw) ? raw : Object.entries(raw).map(([k, v]) => ({ fieldId: k, value: v }));
              
              responseList = responses.map((r: any) => {
                const schemaObj = typeof formSchema === 'string' ? JSON.parse(formSchema) : formSchema;
                const fields = (schemaObj?.sections || []).flatMap((s: any) => s.fields || []);
                const field = fields.find((f: any) => String(f.id) === String(r.fieldId));
                return { label: field?.label || r.fieldId, value: r.value };
              });
            } catch {}

            const renderValue = (val: any) => {
              if (Array.isArray(val)) return val.join(', ');
              if (val == null) return '—';
              
              const sVal = String(val);
              const isFile = (/\.(pdf|docx|xlsx|pptx|txt|jpg|jpeg|png|gif|webp)$/i.test(sVal) || sVal.includes('res.cloudinary.com'));
              
              if (isFile) {
                const fileUrl = sVal.startsWith('http') ? sVal : `${(import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(sVal)}`;
                return (
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1.5 font-bold">
                    <ExternalLink size={14} /> View File
                  </a>
                );
              }
              
              return sVal;
            };

            return (
              <div className="space-y-5">
                {/* Header */}
                <div className="bg-gradient-to-r from-navy to-navy-light rounded-xl p-5 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-bold">{displayName[0]}</div>
                    <div>
                      <h2 className="text-lg font-bold">{displayName}</h2>
                      <p className="text-sm text-blue-200">{sub.user_email}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px]">
                        <span className="bg-white/15 px-2 py-0.5 rounded-full">{sub.form_title}</span>
                        <StatusBadge status={sub.status} size="xs" />
                        {sub.score != null && <span className="bg-emerald-500/30 px-2 py-0.5 rounded-full">Form Score: {Number(typeof sub.score === 'object' ? sub.score?.percentage : sub.score).toFixed(2)}%</span>}
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

                {/* Nomination Details */}
                {(() => {
                  const nom = sub.nominationId || sub.nomination_id;
                  if (!nom) return null;
                  const addData = parseObject(nom.additional_data);
                  if (Object.keys(addData).length === 0) return null;

                  return (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                      <h3 className="text-sm font-bold font-heading mb-3 flex items-center gap-2 text-primary"><School size={15} /> School Functionary Details</h3>
                      <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted font-bold uppercase">Nominated Teacher</p>
                            <p className="text-sm font-semibold">{nom.teacher_name}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted font-bold uppercase">School Code</p>
                            <p className="text-sm font-semibold font-mono">{nom.school_code}</p>
                          </div>
                          {Object.entries(addData).map(([key, val]) => {
                            const strVal = typeof val === 'string' ? val.trim() : '';
                            const isUploadPath = /^https?:\/\/[^/\s]+\/uploads\//i.test(strVal) || /^\/?uploads\//i.test(strVal);
                            const isFile = typeof val === 'string' && (
                              /\.(pdf|docx|xlsx|pptx|txt|jpg|jpeg|png|gif|webp)$/i.test(strVal) ||
                              strVal.includes('res.cloudinary.com') ||
                              isUploadPath
                            );
                            const fileUrl = isFile
                              ? (strVal.startsWith('http')
                                ? strVal
                                : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(strVal)}`)
                              : '';

                            return (
                              <div key={key} className="space-y-1 border-t border-primary/5 pt-2 sm:border-t-0 sm:pt-0">
                                <p className="text-[10px] text-muted font-bold uppercase">{nominationFieldMap[key] || key.replace(/_/g, ' ').replace(/^cf\s+/i, '')}</p>
                                {isFile ? (
                                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm font-semibold">
                                    <ExternalLink size={12} /> View File
                                  </a>
                                ) : (
                                  <p className="text-sm font-semibold">{String(val)}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Responses */}
                <div>
                  <h3 className="text-sm font-bold font-heading mb-3">Form Responses</h3>
                  <div className="bg-slate-100 rounded-xl p-4 space-y-2">
                    {responseList.length === 0 ? <p className="text-sm text-slate-500">No responses</p> :
                      responseList.map((res, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-1 py-1.5 border-b border-slate-200 last:border-0">
                          <span className="text-xs font-semibold text-slate-500 min-w-[150px]">{res.label}:</span>
                          <span className="text-sm font-medium">{renderValue(res.value)}</span>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => printSubmissionProfile({ profile: profileData, submission: sub, responseRows: responseList })}
                    className="py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-2"
                  >
                    <Printer size={14} /> Print Profile
                  </button>
                  <button onClick={() => navigate(`/forms/view?submission=${sub.id}`)} className="py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-white flex items-center justify-center gap-2">
                    <Eye size={14} /> View Full Form Response
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* Export Modals */}
        <Modal open={showCsvConfig} onClose={() => setShowCsvConfig(false)} title="Export CSV Configuration" size="lg">
          <div className="space-y-6">
            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-primary">Select Columns to Export</h4>
                <p className="text-[11px] text-muted">Choose which fields you want in your Excel/CSV file</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const base = ['id', 'form_title', 'user_name', 'user_email', 'school_code', 'status', 'score'];
                    const dynamic = filterableFields.map(f => f.id);
                    const nomKeys = new Set<string>();
                    const subs = getExportData();
                    subs.forEach((s: any) => {
                      const nom = s.nomination_id || s.nominationId;
                      if (nom && typeof nom === 'object') {
                        const addData = parseObject(nom.additional_data);
                        Object.keys(addData).forEach(k => nomKeys.add(k));
                      }
                    });
                    const noms = Array.from(nomKeys).map(k => `nom_${k}`);
                    setCsvSelectedFields([...base, ...dynamic, ...noms, 'submitted_at']);
                  }}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setCsvSelectedFields([])} className="text-[10px] font-bold text-rose-500 hover:underline">Clear All</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
              {(() => {
                const nomKeys = new Set<string>();
                const subs = getExportData();
                subs.forEach((s: any) => {
                  const nom = s.nomination_id || s.nominationId;
                  if (nom && typeof nom === 'object') {
                    const addData = parseObject(nom.additional_data);
                    Object.keys(addData).forEach(k => nomKeys.add(k));
                  }
                });
                const nomFields = Array.from(nomKeys).map(k => ({ 
                  id: `nom_${k}`, 
                  label: nominationFieldMap[k] ? `Nomination: ${nominationFieldMap[k]}` : `Nomination: ${k.replace(/_/g, ' ').replace(/^cf\s+/i, '')}` 
                }));

                return [
                  { label: 'Basic Info', fields: [
                    { id: 'id', label: 'Reference ID' },
                    { id: 'form_title', label: 'Form Title' },
                    { id: 'user_name', label: 'Submitted By' },
                    { id: 'user_email', label: 'Email' },
                    { id: 'school_code', label: 'School Code' },
                    { id: 'status', label: 'Status' },
                    { id: 'score', label: 'Score' },
                    { id: 'submitted_at', label: 'Submission Date' }
                  ]},
                  ...(nomFields.length > 0 ? [{ label: 'School Functionary Data', fields: nomFields }] : []),
                  ...(filterableFields.length > 0 ? [{ label: 'Form Specific Fields', fields: filterableFields.map(f => ({ id: f.id, label: f.label || f.id })) }] : [])
                ].map((section, idx) => (
                  <div key={idx} className="space-y-3">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">{section.label}</h5>
                    <div className="space-y-2">
                      {section.fields.map(field => (
                        <label key={field.id} className="flex items-center gap-3 group cursor-pointer">
                          <div className="relative flex items-center">
                            <input 
                              type="checkbox" 
                              className="peer appearance-none w-5 h-5 rounded-md border-2 border-slate-200 checked:bg-primary checked:border-primary transition-all"
                              checked={csvSelectedFields.includes(field.id)}
                              onChange={e => {
                                if (e.target.checked) setCsvSelectedFields(prev => [...prev, field.id]);
                                else setCsvSelectedFields(prev => prev.filter(id => id !== field.id));
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none">
                              <CheckCircle size={12} strokeWidth={3} />
                            </div>
                          </div>
                          <span className="text-sm font-medium text-slate-700 group-hover:text-primary transition-colors">{field.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button onClick={() => setShowCsvConfig(false)} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleCsvDownload} className="flex-[2] py-3 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all">
                <FileDown size={18} /> Download Excel/CSV
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={showExportConfig} onClose={() => setShowExportConfig(false)} title="Export ZIP Package Configuration" size="xl">
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Settings */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Settings size={16} className="text-primary" /> Package Settings</h4>
                  <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">File Naming Convention</label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'email', label: 'By User Email', desc: 'example@email.pdf' },
                          { id: 'name', label: 'By Teacher Name', desc: 'john_doe.pdf' },
                          { id: 'school', label: 'By School Code', desc: 'KV001_john_doe.pdf' }
                        ].map(opt => (
                          <button key={opt.id} onClick={() => setExportNamingStrategy(opt.id)}
                            className={`flex flex-col p-3 rounded-xl border text-left transition-all ${exportNamingStrategy === opt.id ? 'border-primary bg-white ring-2 ring-primary/10' : 'border-slate-200 bg-white/50 hover:bg-white'}`}>
                            <span className={`text-xs font-bold ${exportNamingStrategy === opt.id ? 'text-primary' : 'text-slate-700'}`}>{opt.label}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                      <input type="checkbox" checked={includeNominationData} onChange={e => setIncludeNominationData(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                      <div>
                        <p className="text-xs font-bold text-slate-700">Include Nomination Data</p>
                        <p className="text-[10px] text-slate-400">Add CSV with school functionary details</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5"><History size={16} /></div>
                  <div>
                    <p className="text-[11px] font-bold text-amber-800">Large Export Notice</p>
                    <p className="text-[10px] text-amber-700/80 leading-relaxed mt-0.5">Generating ZIP packages with many attachments can take up to 2 minutes. Please keep this tab open.</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Column Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Layers size={16} className="text-primary" /> Data Columns</h4>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const base = ['id', 'form_title', 'user_name', 'user_email', 'school_code', 'status', 'score'];
                        const dynamic = filterableFields.map(f => f.id);
                        const nomKeys = new Set<string>();
                        const subs = getExportData();
                        subs.forEach((s: any) => {
                          const nom = s.nomination_id || s.nominationId;
                          if (nom && typeof nom === 'object') {
                            const addData = parseObject(nom.additional_data);
                            Object.keys(addData).forEach(k => nomKeys.add(k));
                          }
                        });
                        const noms = Array.from(nomKeys).map(k => `nom_${k}`);
                        setZipSelectedFields([...base, ...dynamic, ...noms, 'submitted_at']);
                      }}
                      className="text-[9px] font-black text-primary hover:underline uppercase tracking-tighter"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 text-[9px]">|</span>
                    <button onClick={() => setZipSelectedFields([])} className="text-[9px] font-black text-rose-500 hover:underline uppercase tracking-tighter">Clear All</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 max-h-[450px] overflow-y-auto px-1 custom-scrollbar">
                  {(() => {
                    const nomKeys = new Set<string>();
                    const subs = getExportData();
                    subs.forEach((s: any) => {
                      const nom = s.nomination_id || s.nominationId;
                      if (nom && typeof nom === 'object') {
                        const addData = parseObject(nom.additional_data);
                        Object.keys(addData).forEach(k => nomKeys.add(k));
                      }
                    });
                    const nomFields = Array.from(nomKeys).map(k => ({ 
                      id: `nom_${k}`, 
                      label: nominationFieldMap[k] ? `Nomination: ${nominationFieldMap[k]}` : `Nomination: ${k.replace(/_/g, ' ').replace(/^cf\s+/i, '')}` 
                    }));

                    return [
                      { label: 'Basic Identity', fields: [
                        { id: 'id', label: 'Reference ID' },
                        { id: 'form_title', label: 'Form Title' },
                        { id: 'user_name', label: 'Submitted By' },
                        { id: 'user_email', label: 'Email Address' },
                        { id: 'school_code', label: 'School Code' },
                        { id: 'status', label: 'Submission Status' },
                        { id: 'score', label: 'Evaluation Score' },
                        { id: 'submitted_at', label: 'Timestamp' }
                      ]},
                      ...(nomFields.length > 0 ? [{ label: 'School Functionary Data', fields: nomFields }] : []),
                      ...(filterableFields.length > 0 ? [{ label: 'Form Response Data', fields: filterableFields.map(f => ({ id: f.id, label: f.label || f.id })) }] : [])
                    ].map((section, idx) => (
                      <div key={idx} className="space-y-3">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 p-1 rounded">{section.label}</h5>
                        <div className="space-y-2.5">
                          {section.fields.map(field => (
                            <label key={field.id} className="flex items-center gap-3 group cursor-pointer">
                              <div className="relative flex items-center">
                                <input 
                                  type="checkbox" 
                                  className="peer appearance-none w-4.5 h-4.5 rounded border-2 border-slate-200 checked:bg-primary checked:border-primary transition-all"
                                  checked={zipSelectedFields.includes(field.id)}
                                  onChange={e => {
                                    if (e.target.checked) setZipSelectedFields(prev => [...prev, field.id]);
                                    else setZipSelectedFields(prev => prev.filter(id => id !== field.id));
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none">
                                  <CheckCircle size={10} strokeWidth={3} />
                                </div>
                              </div>
                              <span className="text-[12px] font-semibold text-slate-700 group-hover:text-primary transition-colors truncate max-w-[180px]">{field.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-100">
              <button onClick={() => setShowExportConfig(false)} className="flex-1 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleZipDownload} className="flex-[2] py-3.5 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary-hover transition-all transform active:scale-[0.98]">
                <Archive size={18} /> Generate Data Package
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ═══════════ REVIEWER VIEW ═══════════
  const myPending = reviews.filter(r => r.status === 'pending');
  const myCompleted = reviews.filter(r => r.status !== 'pending');
  
  // NEW: Filter reviews by selected form if one is chosen
  const filteredMyReviews = selectedFormId 
    ? reviews.filter(r => r.form_id === selectedFormId || r.formId === selectedFormId)
    : reviews;
    
  const myPendingFiltered = filteredMyReviews.filter(r => r.status === 'pending');
  const myCompletedFiltered = filteredMyReviews.filter(r => r.status !== 'pending');
  const displayed = reviewTab === 'pending' ? myPendingFiltered : myCompletedFiltered;

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold font-heading">My Reviews</h1>
        <p className="text-sm text-slate-500">Score submissions assigned to you</p></div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
          <Clock size={20} className="mx-auto text-amber-500 mb-1" /><p className="text-xl font-bold">{myPendingFiltered.length}</p><p className="text-xs text-amber-600">Pending</p></div>
        <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
          <CheckCircle size={20} className="mx-auto text-emerald-500 mb-1" /><p className="text-xl font-bold">{myCompletedFiltered.length}</p><p className="text-xs text-emerald-600">Completed</p></div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['pending', 'completed'] as const).map(t => (
          <button key={t} onClick={() => setReviewTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize ${reviewTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {t} ({t === 'pending' ? myPendingFiltered.length : myCompletedFiltered.length})
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
            {/* Previous Reviews History for Reviewer */}
            {selectedReview.show_previous_reviews && reviewHistory.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2 px-1 text-amber-600">
                  <History size={16} /> {selectedReview.show_previous_reviews ? 'Review History (Multiple Reviewers)' : 'Previous Level Reviews'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reviewHistory.map((prev, pIdx) => (
                    <div key={pIdx} className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">Level {prev.level}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(prev.updatedAt || prev.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-700">{prev.reviewer_name || 'Reviewer'}</p>
                        <p className="text-sm font-black text-primary">{prev.overall_score}<span className="text-[10px] text-slate-400 ml-0.5">pts</span></p>
                      </div>
                      {prev.comments && <p className="text-xs text-slate-500 italic line-clamp-2">"{prev.comments}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                      <div key={q.fieldId} className={`p-6 flex flex-col gap-4 ${idx !== reviewQuestions.length - 1 ? 'border-b border-slate-100' : ''}`}>
                        {/* Question & Answer Header */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">Q{idx + 1}</span>
                            <p className="text-xs font-bold text-slate-800">{q.label}</p>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-sm text-slate-900 leading-relaxed">
                              {Array.isArray(q.value) ? (q.value as any[]).join(', ') : String(q.value)}
                            </p>
                          </div>
                        </div>

                        {/* Question-wise scoring is only for question_level mode */}
                        {selectedReview.scoring_type === 'question_level' && (
                          <div className={`grid grid-cols-1 ${selectedReview.show_previous_reviews ? 'md:grid-cols-2' : ''} gap-4 mt-2`}>
                            {/* Left: Previous Reviews History */}
                            {selectedReview.show_previous_reviews && (
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Previous Level Scores</label>
                                <div className="bg-amber-50/50 rounded-xl border border-amber-100 p-2.5 min-h-[68px]">
                                  {reviewHistory.length > 0 ? (
                                    (() => {
                                      const scoresToShow = reviewHistory.map((prev, pIdx) => {
                                        const qScore = (prev.question_scores || []).find((qs: any) =>
                                          String(qs.field_id) === String(q.fieldId) || String(qs.field_id) === String(q.label)
                                        );
                                        if (qScore == null) return null;
                                        return (
                                          <div key={pIdx} className="grid grid-cols-[1.5fr_70px_70px] items-center bg-white border border-amber-200 px-2.5 py-2 rounded-lg text-[10px]">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[8px] font-black flex items-center justify-center flex-shrink-0">
                                                {(prev.reviewer_name || `R${pIdx + 1}`).charAt(0).toUpperCase()}
                                              </div>
                                              <p className="font-bold text-slate-700 truncate">{prev.reviewer_name || `Reviewer ${pIdx + 1}`}</p>
                                            </div>
                                            <div className="text-center">
                                              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-black text-[9px] uppercase">L{prev.level}</span>
                                            </div>
                                            <div className="text-right font-black text-primary">{qScore.score}<span className="text-[9px] text-slate-400 ml-0.5">pts</span></div>
                                          </div>
                                        );
                                      }).filter(Boolean);

                                      return scoresToShow.length > 0 ? scoresToShow : (
                                        <div className="w-full h-full flex items-center justify-center py-2">
                                          <p className="text-[10px] text-slate-400 italic font-medium">Previous level marks not available</p>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center py-2">
                                      <p className="text-[10px] text-slate-400 italic font-medium">No previous level history</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Right: Current Reviewer Input */}
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-primary uppercase tracking-widest block px-1">Your Score</label>
                              <div className="bg-primary/5 rounded-xl border border-primary/10 p-3 flex items-center gap-4">
                                <div className="flex-1">
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
                                    }}
                                    className="w-full bg-white px-4 py-2.5 rounded-lg border border-primary/20 text-lg font-black text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                                    placeholder="0"
                                  />
                                </div>
                                {q.reviewerMaxMarks > 0 && (
                                  <div className="text-right flex flex-col justify-center">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">Max Limit</span>
                                    <span className="text-xs font-black text-slate-600 leading-none">{q.reviewerMaxMarks}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">
                  {selectedReview.scoring_type === 'question_level' ? 'Total Calculated Score' : 'Overall Score (0-100)'}
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    min={0} 
                    max={100}
                    value={overallScore} 
                    onChange={e => {
                      if (selectedReview.scoring_type === 'question_level') return;
                      const val = parseInt(e.target.value) || 0;
                      setOverallScore(Math.min(100, Math.max(0, val)));
                    }} 
                    readOnly={selectedReview.scoring_type === 'question_level'}
                    className={`w-full px-4 py-2.5 rounded-xl border font-bold text-lg outline-none transition-all ${selectedReview.scoring_type === 'question_level' ? 'bg-primary/5 border-primary/20 text-primary cursor-default' : 'bg-white border-slate-300 text-primary focus:border-primary focus:ring-2 focus:ring-primary/10'}`} 
                  />
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${selectedReview.scoring_type === 'question_level' ? 'text-primary' : 'text-slate-400'}`}>
                    {selectedReview.scoring_type === 'question_level' ? <Zap size={18} /> : <Star size={18} />}
                  </div>
                </div>
                {selectedReview.scoring_type === 'question_level' && (
                  <p className="text-[9px] text-primary font-bold mt-1 uppercase">Auto-calculated from questions above</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Final Recommendation</label>
                <select value={recommendation} onChange={e => setRecommendation(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
                  <option value="">Choose action...</option>
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
              <button onClick={submitReview} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                <CheckCircle size={18} /> Submit Final Review
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Profile from reviewer */}
      <Modal open={showProfile} onClose={() => { setShowProfile(false); setProfileData(null); }} title="Submission Profile" size="2xl">
        {profileLoading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div> :
        profileData && (() => {
          const sub = profileData.submission;
          const displayName = getSubmissionDisplayName(sub, sub.user_name);
          
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
          const responseRows = Object.entries(profileResponses).map(([label, value]) => ({ label, value }));

          return (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                    {displayName[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{displayName}</h3>
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
                          {(lvl.scores || []).map((s: any, i: number) => (
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

              <button
                onClick={() => printSubmissionProfile({ profile: profileData, submission: sub, responseRows })}
                className="w-full py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <Printer size={14} /> Print Profile
              </button>
            </div>
          );
        })()}
      </Modal>

      {/* CSV Export Configuration Modal */}
      <Modal open={showCsvConfig} onClose={() => setShowCsvConfig(false)} title="Export CSV Configuration" size="lg">
        <div className="space-y-6">
          <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-primary">Select Columns to Export</h4>
              <p className="text-[11px] text-muted">Choose which fields you want in your Excel/CSV file</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const base = ['id', 'form_title', 'user_name', 'user_email', 'school_code', 'status', 'score'];
                  const dynamic = filterableFields.map(f => f.id);
                  const nomKeys = new Set<string>();
                  getExportData().forEach((s: any) => {
                    const nom = s.nomination_id || s.nominationId;
                    if (nom && typeof nom === 'object') {
                      const addData = parseObject(nom.additional_data);
                      Object.keys(addData).forEach(k => nomKeys.add(k));
                    }
                  });
                  const noms = Array.from(nomKeys).map(k => `nom_${k}`);
                  setCsvSelectedFields([...base, ...dynamic, ...noms, 'submitted_at']);
                }}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button onClick={() => setCsvSelectedFields([])} className="text-[10px] font-bold text-rose-500 hover:underline">Clear All</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-h-[400px] overflow-y-auto px-1">
            {(() => {
              const nomKeys = new Set<string>();
              getExportData().forEach((s: any) => {
                const nom = s.nomination_id || s.nominationId;
                if (nom && typeof nom === 'object') {
                  const addData = parseObject(nom.additional_data);
                  Object.keys(addData).forEach(k => nomKeys.add(k));
                }
              });
              const nomFields = Array.from(nomKeys).map(k => ({ id: `nom_${k}`, label: `Nomination: ${k.replace(/_/g, ' ')}` }));

              return [
                { label: 'Basic Info', fields: [
                  { id: 'id', label: 'Reference ID' },
                  { id: 'form_title', label: 'Form Title' },
                  { id: 'user_name', label: 'Submitted By' },
                  { id: 'user_email', label: 'Email' },
                  { id: 'school_code', label: 'School Code' },
                  { id: 'status', label: 'Status' },
                  { id: 'score', label: 'Score' },
                  { id: 'submitted_at', label: 'Submission Date' }
                ]},
                ...(nomFields.length > 0 ? [{ label: 'School Functionary Data', fields: nomFields }] : []),
                ...(filterableFields.length > 0 ? [{ label: 'Form Specific Fields', fields: filterableFields.map(f => ({ id: f.id, label: f.label || f.id })) }] : [])
              ].map((section, idx) => (
                <div key={idx} className="space-y-3">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">{section.label}</h5>
                  <div className="space-y-2">
                    {section.fields.map(field => (
                      <label key={field.id} className="flex items-center gap-3 group cursor-pointer">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            className="peer appearance-none w-5 h-5 rounded-md border-2 border-slate-200 checked:bg-primary checked:border-primary transition-all"
                            checked={csvSelectedFields.includes(field.id)}
                            onChange={e => {
                              if (e.target.checked) setCsvSelectedFields(prev => [...prev, field.id]);
                              else setCsvSelectedFields(prev => prev.filter(id => id !== field.id));
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none">
                            <CheckCircle size={12} strokeWidth={3} />
                          </div>
                        </div>
                        <span className="text-sm font-medium text-slate-700 group-hover:text-primary transition-colors">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button onClick={() => setShowCsvConfig(false)} className="flex-1 py-3 bg-surface border border-border rounded-xl text-sm font-bold">Cancel</button>
            <button onClick={handleCsvDownload} className="flex-[2] py-3 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              <FileDown size={18} /> Download Excel/CSV
            </button>
          </div>
        </div>
      </Modal>

      {/* ZIP Export Configuration Modal */}
      <Modal open={showExportConfig} onClose={() => setShowExportConfig(false)} title="Export Submissions Package" size="xl">
        <div className="space-y-6">
          <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-4">
            <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-inner">
              <Archive size={28} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Bulk Export (ZIP Format)</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Configure how your archive will be structured and select the specific data fields you wish to include in the submission reports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Column 1: Structure & Naming */}
            <div className="space-y-6 lg:col-span-1">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">1. Root Organization</h4>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'school', label: 'By School Code', desc: '📂 [School_Code] / 📂 [Teacher_ID]', icon: School },
                    { id: 'email', label: 'By Email', desc: '📂 [Teacher_Email]', icon: Mail },
                    { id: 'name', label: 'By Name', desc: '📂 [Teacher_Name]', icon: UserIcon },
                    { id: 'id', label: 'By ID', desc: '📂 [Submission_ID]', icon: Fingerprint },
                  ].map((strategy) => (
                    <button key={strategy.id} onClick={() => setExportNamingStrategy(strategy.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${exportNamingStrategy === strategy.id ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${exportNamingStrategy === strategy.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}><strategy.icon size={16} /></div>
                      <div className="flex-1">
                        <p className="text-xs font-bold">{strategy.label}</p>
                        <p className="text-[10px] text-slate-400">{strategy.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {exportNamingStrategy === 'school' && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">2. Sub-folder Naming</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'name', label: 'Name' },
                      { id: 'email', label: 'Email' },
                      { id: 'phone', label: 'Phone' },
                      { id: 'id', label: 'Sub. ID' },
                    ].map((sub) => (
                      <button key={sub.id} onClick={() => setExportSubNamingStrategy(sub.id)}
                        className={`px-3 py-2 rounded-lg border text-[11px] font-bold transition-all ${exportSubNamingStrategy === sub.id ? 'bg-primary text-white border-primary shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/50'}`}>
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {exportNamingStrategy === 'school' && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">3. Additional Data</h4>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between group hover:border-primary/30 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Include Nomination Data?</p>
                      <p className="text-[10px] text-slate-500">School functionary form & uploads</p>
                    </div>
                    <button onClick={() => setIncludeNominationData(!includeNominationData)} className={`w-10 h-5 rounded-full transition-all relative ${includeNominationData ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-slate-300'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${includeNominationData ? 'left-5.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={14} className="text-primary" />
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase">Archive Structure</h4>
                </div>
                <div className="font-mono text-[10px] space-y-2 text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600">📂 {exportNamingStrategy === 'school' ? '[School_Code]' : `[${exportNamingStrategy.toUpperCase()}_ID]`}</span>
                  </div>
                  {exportNamingStrategy === 'school' && (
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-blue-600">📂 [{exportSubNamingStrategy.toUpperCase()}_ID]</span>
                    </div>
                  )}
                  <div className={`${exportNamingStrategy === 'school' ? 'ml-8' : 'ml-4'} text-[9px] text-slate-400 italic space-y-1`}>
                    <p>📄 submission.csv (Teacher Data)</p>
                    <p>📂 uploads/ (Teacher Files)</p>
                    {exportNamingStrategy === 'school' && includeNominationData && (
                      <>
                        <p className="text-amber-500/70">📄 nomination.csv (Functionary Data)</p>
                        <p className="text-amber-500/70">📂 nomination_uploads/ (Functionary Files)</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Field Selection */}
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">3. Select Report Columns</h4>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const base = ['id', 'form_title', 'user_name', 'user_email', 'school_code', 'status', 'score'];
                        const dynamic = filterableFields.map(f => f.id);
                        const nomKeys = new Set<string>();
                        getExportData().forEach((s: any) => {
                          const nom = s.nomination_id || s.nominationId;
                          if (nom && typeof nom === 'object') {
                            const addData = parseObject(nom.additional_data);
                            Object.keys(addData).forEach(k => nomKeys.add(k));
                          }
                        });
                        const noms = Array.from(nomKeys).map(k => `nom_${k}`);
                        setZipSelectedFields([...base, ...dynamic, ...noms, 'submitted_at']);
                      }}
                      className="text-[9px] font-black text-primary hover:underline uppercase tracking-tighter"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 text-[9px]">|</span>
                    <button onClick={() => setZipSelectedFields([])} className="text-[9px] font-black text-rose-500 hover:underline uppercase tracking-tighter">Clear All</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 max-h-[450px] overflow-y-auto px-1 custom-scrollbar">
                  {(() => {
                    const nomKeys = new Set<string>();
                    getExportData().forEach((s: any) => {
                      const nom = s.nomination_id || s.nominationId;
                      if (nom && typeof nom === 'object') {
                        const addData = parseObject(nom.additional_data);
                        Object.keys(addData).forEach(k => nomKeys.add(k));
                      }
                    });
                    const nomFields = Array.from(nomKeys).map(k => ({ id: `nom_${k}`, label: `Nomination: ${k.replace(/_/g, ' ')}` }));

                    return [
                      { label: 'Basic Identity', fields: [
                        { id: 'id', label: 'Reference ID' },
                        { id: 'form_title', label: 'Form Title' },
                        { id: 'user_name', label: 'Submitted By' },
                        { id: 'user_email', label: 'Email Address' },
                        { id: 'school_code', label: 'School Code' },
                        { id: 'status', label: 'Submission Status' },
                        { id: 'score', label: 'Evaluation Score' },
                        { id: 'submitted_at', label: 'Timestamp' }
                      ]},
                      ...(nomFields.length > 0 ? [{ label: 'School Functionary Data', fields: nomFields }] : []),
                      ...(filterableFields.length > 0 ? [{ label: 'Form Response Data', fields: filterableFields.map(f => ({ id: f.id, label: f.label || f.id })) }] : [])
                    ].map((section, idx) => (
                      <div key={idx} className="space-y-3">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 p-1 rounded">{section.label}</h5>
                        <div className="space-y-2.5">
                          {section.fields.map(field => (
                            <label key={field.id} className="flex items-center gap-3 group cursor-pointer">
                              <div className="relative flex items-center">
                                <input 
                                  type="checkbox" 
                                  className="peer appearance-none w-4.5 h-4.5 rounded border-2 border-slate-200 checked:bg-primary checked:border-primary transition-all"
                                  checked={zipSelectedFields.includes(field.id)}
                                  onChange={e => {
                                    if (e.target.checked) setZipSelectedFields(prev => [...prev, field.id]);
                                    else setZipSelectedFields(prev => prev.filter(id => id !== field.id));
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none">
                                  <CheckCircle size={10} strokeWidth={3} />
                                </div>
                              </div>
                              <span className="text-[12px] font-semibold text-slate-700 group-hover:text-primary transition-colors truncate max-w-[180px]">{field.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button 
              onClick={() => setShowExportConfig(false)} 
              className="flex-1 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleZipDownload} 
              className="flex-[2] py-3.5 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary-hover transition-all transform active:scale-[0.98]"
            >
              <Archive size={18} />
              Generate Data Package
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
