import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { Eye, MessageSquare, Filter, Send, FileDown, Inbox, ExternalLink, Archive, User as UserIcon, Mail, Hash, School, Fingerprint, Search, X, SlidersHorizontal, Info, ChevronDown, CheckCircle } from 'lucide-react';

export default function Submissions({ user }: { user: User }) {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [selectedFormObj, setSelectedFormObj] = useState<any>(null);
  const [selectedNomination, setSelectedNomination] = useState<any>(null);
  const [showNomProfile, setShowNomProfile] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [forms, setForms] = useState<any[]>([]);
  const [formFilter, setFormFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [includeReviews, setIncludeReviews] = useState(false);
  const [search, setSearch] = useState('');
  const [showExportConfig, setShowExportConfig] = useState(false);
  const [showCsvConfig, setShowCsvConfig] = useState(false);
  const [csvSelectedFields, setCsvSelectedFields] = useState<string[]>([]);
  const [exportNamingStrategy, setExportNamingStrategy] = useState('email');
  const [exportSubNamingStrategy, setExportSubNamingStrategy] = useState('name');
  const [includeNominationData, setIncludeNominationData] = useState(true);
  const [zipSelectedFields, setZipSelectedFields] = useState<string[]>([]);
  const [visibleFields, setVisibleFields] = useState<string[]>([]);

  const canSeeScore = user.role === 'admin' || user.role === 'reviewer' || user.role === 'functionary';
  const norm = (v: any) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const emailLocal = (v: any) => norm(v).split('@')[0];
  const compact = (v: any) => norm(v).replace(/[^a-z0-9]/g, '');
  
  const parseObject = (raw: any): Record<string, any> => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    return typeof raw === 'object' ? raw : {};
  };

  const parseResponses = (raw: any): Record<string, any> => {
    if (!raw) return {};
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        const out: Record<string, any> = {};
        parsed.forEach((r: any) => {
          if (r?.fieldId) out[r.fieldId] = r.value;
        });
        return out;
      }
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const getFormForSubmission = (row: any) => {
    const rawFormId = typeof row?.form_id === 'object' ? (row.form_id?._id || row.form_id?.id) : row?.form_id;
    const target = String(rawFormId || '');
    return forms.find((f: any) => String(f?.id || f?._id || '') === target) || null;
  };

  const isNominationSubmission = (row: any) => {
    if (!row) return false;
    if (row.nomination_id || row.nominationId || row.unique_token || row.nomination_token || row.nominationToken) return true;
    const f = getFormForSubmission(row);
    const formType = f?.form_type || f?.formType || row?.form_type || row?.formType;
    return formType === 'nomination';
  };

  const isAnonymousDirectForm = (row: any) => {
    const f = getFormForSubmission(row);
    const settings = parseObject(f?.settings);
    return settings.auth_mode === 'anonymous' || settings.login_type === 'direct' || settings.teacher_login === 'direct';
  };

  const extractNameEmailFromSubmission = (row: any) => {
    const responses = parseResponses(row?.responses);
    const f = getFormForSubmission(row);
    const schemaSource = f?.form_schema || f?.schema;
    let schemaObj: any = null;
    if (schemaSource) {
      schemaObj = typeof schemaSource === 'string'
        ? (() => { try { return JSON.parse(schemaSource); } catch { return null; } })()
        : schemaSource;
    }

    const fieldList: any[] = [];
    const collectFields = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach((x: any) => {
        if (!x || typeof x !== 'object') return;
        fieldList.push(x);
        if (Array.isArray(x.children)) collectFields(x.children);
      });
    };
    if (Array.isArray(schemaObj?.sections)) schemaObj.sections.forEach((s: any) => collectFields(s?.fields || []));

    const findById = (matcher: (fld: any) => boolean) => fieldList.find(matcher)?.id;
    const nameFieldId = findById((fld: any) => /name/i.test(String(fld?.label || '')));
    const emailFieldId = findById((fld: any) => fld?.type === 'email' || /email/i.test(String(fld?.label || '')));

    let name = row?.user_name;
    let email = row?.user_email;

    if (!name || norm(name) === 'anonymous') {
      if (nameFieldId && responses[nameFieldId]) name = responses[nameFieldId];
      if ((!name || norm(name) === 'anonymous') && responses['name']) name = responses['name'];
      if ((!name || norm(name) === 'anonymous') && responses['full_name']) name = responses['full_name'];
    }

    if (!email) {
      if (emailFieldId && responses[emailFieldId]) email = responses[emailFieldId];
      if (!email && responses['email']) email = responses['email'];
      if (!email && responses['user_email']) email = responses['user_email'];
    }

    return { name, email };
  };

  const pickBestNomination = (nominations: any[], sub: any, nominationIdParam?: any) => {
    if (!Array.isArray(nominations) || nominations.length === 0) return null;

    const userEmail = norm(sub?.user_email);
    const userName = norm(sub?.user_name);
    const schoolCode = norm(sub?.school_code);
    const subNomId = norm(nominationIdParam);
    const userEmailLocal = emailLocal(userEmail);
    const userNameCompact = compact(userName);

    // 1) Strong exact matching first
    let matched = subNomId
      ? nominations.find((n: any) => norm(n?.id || n?._id) === subNomId)
      : undefined;
    if (!matched) matched = nominations.find((n: any) => norm(n.teacher_email) === userEmail);
    if (!matched && userEmail) matched = nominations.find((n: any) => emailLocal(n.teacher_email) === userEmailLocal);
    if (!matched && userName) matched = nominations.find((n: any) => norm(n.teacher_name) === userName);
    if (matched) return matched;

    // 2) Score-based best candidate fallback (for minor typos/case/format issues)
    const scored = nominations.map((n: any) => {
      const nEmail = norm(n.teacher_email);
      const nEmailLocal = emailLocal(n.teacher_email);
      const nName = norm(n.teacher_name);
      const nNameCompact = compact(n.teacher_name);
      const nSchool = norm(n.school_code);

      let score = 0;
      if (schoolCode && nSchool === schoolCode) score += 30;
      if (userEmailLocal && nEmailLocal === userEmailLocal) score += 40;
      if (userNameCompact && nNameCompact === userNameCompact) score += 35;
      if (userNameCompact && nNameCompact && (nNameCompact.includes(userNameCompact) || userNameCompact.includes(nNameCompact))) score += 20;
      if (userEmail && nEmail && (nEmail.includes(userEmail) || userEmail.includes(nEmail))) score += 15;

      return { n, score };
    }).sort((a, b) => b.score - a.score);

    if (scored[0]?.score > 0) return scored[0].n;
    return null;
  };

  const fetchData = async () => {
    try {
      let url = '/submissions?';
      if (user.role === 'teacher') url += `user_id=${user.id}&`;
      if (statusFilter) url += `status=${statusFilter}&`;
      if (formFilter) url += `form_id=${formFilter}&`;
      if (schoolFilter) url += `school_code=${encodeURIComponent(schoolFilter)}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      
      const [subs, f] = await Promise.all([
        api.get(url).catch(() => []),
        api.get('/forms').catch(() => [])
      ]);
      
      const mappedSubs = (Array.isArray(subs) ? subs : []).map((s: any) => ({
        ...s,
        id: s._id || s.id,
        form_id: s.formId || s.form_id,
        nomination_id: s.nominationId || s.nomination_id,
        nomination_token: s.unique_token || s.nominationToken || s.nomination_token,
        unique_token: s.unique_token || s.nominationToken || s.nomination_token,
        user_email: s.userEmail || s.user_email,
        user_name: s.userName || s.user_name,
        school_code: s.schoolCode || s.school_code,
        form_title: s.formTitle || s.form_title,
        submitted_at: s.createdAt || s.submitted_at
      }));
      
      setSubmissions(mappedSubs);
      setForms(Array.isArray(f) ? f : []);
    } catch (err) { 
      console.error('Error fetching submissions:', err);
      setSubmissions([]);
      setForms([]);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    const timer = setTimeout(() => {
      fetchData(); 
    }, 300);
    return () => clearTimeout(timer);
  }, [statusFilter, formFilter, schoolFilter, search]);

  const getFilterableFields = () => {
    if (!formFilter) return [];
    const f = forms.find(x => (x.id || x._id) === formFilter);
    if (!f) return [];
    
    const schemaSource = f.form_schema || f.schema;
    let schemaObj: any = null;
    if (schemaSource) {
      schemaObj = typeof schemaSource === 'string' ? (() => { try { return JSON.parse(schemaSource); } catch { return null; } })() : schemaSource;
    }

    const fields: any[] = [];
    const walk = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach((field: any) => {
        const layoutTypes = ['heading', 'paragraph', 'divider', 'spacer', 'info'];
        if (field.id && !layoutTypes.includes(field.type)) {
          fields.push(field);
        }
        if (Array.isArray(field.children)) walk(field.children);
      });
    };

    if (schemaObj?.sections) {
      schemaObj.sections.forEach((s: any) => walk(s.fields || []));
    } else if (schemaObj?.fields) {
      walk(schemaObj.fields);
    } else if (Array.isArray(schemaObj)) {
      walk(schemaObj);
    }

    return fields;
  };

  const filterableFields = getFilterableFields();
  const filterableFieldMap = Object.fromEntries(filterableFields.map((f: any) => [f.id, f]));

  const formatResponseValue = (fieldId: string, val: any) => {
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

  const openDetail = async (sub: any) => {
    setSelected(sub);
    setComments([]);
    setSelectedNomination(null);
    setSelectedFormObj(null);
    try {
      const formIdParam = sub.form_id || sub.formId;
      const nominationIdParamRaw = sub.nomination_id || sub.nominationId;
      const nominationIdParam = typeof nominationIdParamRaw === 'object'
        ? (nominationIdParamRaw?._id || nominationIdParamRaw?.id || '')
        : nominationIdParamRaw;
      const nominationTokenParam = sub.nomination_token || sub.nominationToken;

      const [comms, formRes, nomsRes, fallbackRes, schoolRes, nameRes, tokenRes] = await Promise.allSettled([
        api.get(`/comments?submission_id=${sub.id}`).catch(() => []),
        formIdParam ? api.get(`/forms?id=${formIdParam}`) : Promise.resolve(null),
        nominationIdParam ? api.get(`/nominations?id=${nominationIdParam}`) : Promise.resolve([]),
        sub.user_email ? api.get(`/nominations?teacher_email=${encodeURIComponent(sub.user_email)}&form_id=${formIdParam}`) : Promise.resolve([]),
        sub.school_code ? api.get(`/nominations?school_code=${encodeURIComponent(sub.school_code)}&form_id=${formIdParam}`) : Promise.resolve([]),
        sub.user_name && String(sub.user_name).toLowerCase() !== 'anonymous' ? api.get(`/nominations?teacher_name=${encodeURIComponent(sub.user_name)}&form_id=${formIdParam}`) : Promise.resolve([]),
        nominationTokenParam ? api.get(`/nominations/token/${encodeURIComponent(nominationTokenParam)}`) : Promise.resolve(null)
      ]);

      if (comms.status === 'fulfilled') setComments(comms.value || []);
      if (formRes.status === 'fulfilled') setSelectedFormObj(formRes.value);

      const allPossibleNoms: any[] = [];
      [nomsRes, fallbackRes, schoolRes, nameRes, tokenRes].forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
          const payload: any = res.value;
          const data = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : payload?.data
                ? [payload.data]
                : [payload];
          allPossibleNoms.push(...data.filter(Boolean));
        }
      });

      if (allPossibleNoms.length > 0) {
        const nomMap = new Map<string, any>();
        allPossibleNoms.forEach((n: any) => {
          const key = String(n?.id || n?._id || `${n?.teacher_email || ''}-${n?.createdAt || ''}`);
          if (key) nomMap.set(key, n);
        });
        const uniqueNoms = Array.from(nomMap.values());
        const matched = pickBestNomination(uniqueNoms, sub, nominationIdParam);
        if (matched) setSelectedNomination(matched);
      }
    } catch (err: any) {
      const msg = String(err?.message || err || "").toLowerCase();
      if (!msg.includes('404') && !msg.includes('comments') && !msg.includes('not found')) {
        console.error("Error loading submission details:", err);
      }
      setComments([]);
    }
  };

  const openNominationOnly = async (sub: any) => {
    setSelected(sub);
    setSelectedNomination(null);
    try {
      const nominationIdParamRaw = sub.nomination_id || sub.nominationId;
      const nominationIdParam = typeof nominationIdParamRaw === 'object'
        ? (nominationIdParamRaw?._id || nominationIdParamRaw?.id || '')
        : nominationIdParamRaw;
      const nominationTokenParam = sub.nomination_token || sub.nominationToken;

      const [byEmailRaw, byIdRaw, byTokenRaw] = await Promise.all([
        sub.user_email ? api.get(`/nominations?form_id=${sub.form_id}&teacher_email=${encodeURIComponent(sub.user_email)}`).catch(() => []) : Promise.resolve([]),
        nominationIdParam ? api.get(`/nominations?id=${nominationIdParam}`).catch(() => []) : Promise.resolve([]),
        nominationTokenParam ? api.get(`/nominations/token/${encodeURIComponent(nominationTokenParam)}`).catch(() => null) : Promise.resolve(null)
      ]);
      const byEmailNoms = Array.isArray(byEmailRaw) ? byEmailRaw : [];
      const byIdNoms = Array.isArray(byIdRaw) ? byIdRaw : [];
      const byTokenNoms = (byTokenRaw as any)?.data
        ? [ (byTokenRaw as any).data ]
        : Array.isArray((byTokenRaw as any)) ? (byTokenRaw as any) : [];
         
      const nomMap = new Map<string, any>();
      [...byTokenNoms, ...byIdNoms, ...byEmailNoms].forEach((n: any) => {
        const key = String(n?.id || n?._id || `${n?.teacher_email || ''}-${n?.createdAt || ''}`);
        if (key) nomMap.set(key, n);
      });
      const allNoms = Array.from(nomMap.values());
      if (allNoms.length > 0) {
        const matched = pickBestNomination(allNoms, sub, nominationIdParam);
        if (matched) setSelectedNomination(matched);
      }
      const formRes = await api.get(`/forms?id=${sub.form_id}`);
      if (formRes) setSelectedFormObj(formRes);
      setShowNomProfile(true);
    } catch (err) {
      console.error("Error loading nomination:", err);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selected) return;
    setNewComment('');
  };

  const exportCSV = async () => {
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
    
    // Extract unique nomination additional data keys
    const nominationKeys = new Set<string>();
    submissions.forEach(s => {
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

    const allFields = [...baseFields, ...dynamicFields, ...functionaryFields, dateField];
    setCsvSelectedFields(allFields.map(f => f.id));
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

    const dataToExport = submissions;
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
    submissions.forEach(s => {
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
    
    const rows = dataToExport.map(s => {
      const resps = parseResponses(s.responses);
      const nom = s.nomination_id || s.nominationId;
      const nomData = nom && typeof nom === 'object' ? parseObject(nom.additional_data) : {};

      return activeFields.map(f => {
        if (f.id === 'id') return isNominationSubmission(s) ? (s.unique_token || s.nomination_token || s.id) : s.id;
        if (f.id === 'form_title') return s.form_title || '';
        if (f.id === 'user_name') return s.user_name || 'Anonymous';
        if (f.id === 'user_email') return s.user_email || '';
        if (f.id === 'school_code') return s.school_code || '';
        if (f.id === 'status') return s.status;
        if (f.id === 'score') return typeof s.score === 'object' ? s.score?.percentage ?? '' : (s.score ?? '');
        if (f.id === 'submitted_at') return formatDate(s.submitted_at || '');
        
        if (f.id.startsWith('nom_')) {
          const key = f.id.replace('nom_', '');
          const val = nomData[key];
          if (val === undefined || val === null) return '';
          return String(val).includes(',') ? `"${val}"` : val;
        }

        const val = formatResponseValue(f.id, resps[f.id]);
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
    a.download = `submissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowCsvConfig(false);
  };

  const exportZIP = async () => {
    if (!formFilter) {
      alert('Please select a form to export as ZIP');
      return;
    }
    
    // Set default fields for ZIP export (similar to CSV)
    const base = ['id', 'form_title', 'user_name', 'user_email', 'school_code', 'status', 'score'];
    const dynamic = filterableFields.map(f => f.id);
    const nomKeys = new Set<string>();
    submissions.forEach(s => {
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
      
      if (statusFilter) params.append('status', statusFilter);
      if (schoolFilter) params.append('school_code', schoolFilter);
      if (search) params.append('search', search);
      
      const blob = await (api as any).download(`/forms/${formFilter}/export/zip?${params.toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const formTitle = forms.find(f => f.id === formFilter)?.title || 'form';
      a.download = `${formTitle.replace(/[^a-z0-9]/gi, '_')}_export.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export ZIP: ' + err.message);
    }
  };

  let responses: Record<string, any> = {};
  if (selected?.responses) { 
    try { 
      const respSource = selected.responses;
      const parsed = typeof respSource === 'string' ? JSON.parse(respSource) : respSource;
      if (Array.isArray(parsed)) {
        parsed.forEach((r: any) => {
          if (r.fieldId) responses[r.fieldId] = r.value;
        });
      } else {
        responses = parsed || {};
      }
    } catch { 
      responses = {}; 
    } 
  }

  const nominationAdditionalData = parseObject(selectedNomination?.additional_data);
  const nominationSettings = parseObject(selectedFormObj?.settings);

  const getFieldMap = () => {
    const out: Record<string, any> = {};
    const walk = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach((f: any) => {
        if (!f || typeof f !== 'object') return;
        if (f.id) out[f.id] = f;
        if (Array.isArray(f.children)) walk(f.children);
      });
    };
    const schemaSource = selectedFormObj?.form_schema || selectedFormObj?.schema;
    let schemaObj: any = null;
    if (schemaSource) {
      schemaObj = typeof schemaSource === 'string' ? (() => { try { return JSON.parse(schemaSource); } catch { return null; } })() : schemaSource;
    }
    if (Array.isArray(schemaObj)) walk(schemaObj);
    else if (schemaObj?.sections && Array.isArray(schemaObj.sections)) schemaObj.sections.forEach((s: any) => walk(s?.fields || []));
    else if (schemaObj?.fields && Array.isArray(schemaObj.fields)) walk(schemaObj.fields);

    return out;
  };
  const fieldMap = getFieldMap();

  const columns = [
    {
      key: 'id',
      label: 'Reference ID',
      sortable: true,
      render: (_v: string, row: any) => {
        const isNom = isNominationSubmission(row);
        const refId = isNom ? (row.unique_token || row.nomination_token || row.id) : row.id;
        return <span className="text-xs font-mono text-muted">{refId || '—'}</span>;
      }
    },
    { key: 'form_title', label: 'Form', sortable: true, render: (v: string) => <span className="font-medium text-sm">{v || 'Untitled'}</span> },
    { 
      key: 'user_name', 
      label: 'Submitted By', 
      sortable: true, 
      render: (v: string, row: any) => (
        <div className={`p-1 -m-1 rounded-lg transition-colors group ${isNominationSubmission(row) ? 'cursor-pointer hover:bg-primary/5' : ''}`}
          onClick={(e) => { if (!isNominationSubmission(row)) return; e.stopPropagation(); openNominationOnly(row); }}>
          <p className="text-sm font-medium group-hover:text-primary">
            {(() => {
              const { name } = extractNameEmailFromSubmission(row);
              if (isAnonymousDirectForm(row)) return name || 'Anonymous';
              return v || name || 'Anonymous';
            })()}
          </p>
          <p className="text-[10px] text-muted">
            {(() => {
              const { email } = extractNameEmailFromSubmission(row);
              return row.user_email || email || '';
            })()}
          </p>
        </div>
      ) 
    },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'score', label: 'Score', sortable: true, hidden: !canSeeScore, render: (v: any) => v != null ? <span className="font-bold text-sm text-primary">{Number(typeof v === 'object' ? v?.percentage : v).toFixed(2)}%</span> : <span className="text-muted">—</span> },
    ...visibleFields.map(fieldId => {
      const field = fieldMap[fieldId];
      return {
        key: `field_${fieldId}`,
        label: field?.label || fieldId,
        render: (_v: any, row: any) => {
          const resps = parseResponses(row.responses);
          const val = resps[fieldId];
          if (val === undefined || val === null) return <span className="text-muted">—</span>;
          const isFile = typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val);
          if (isFile) {
            const fileUrl = val.startsWith('http') ? val : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(val)}`;
            return <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs"><ExternalLink size={10} /> View</a>;
          }
          if (Array.isArray(val)) return val.join(', ');
          const options = Array.isArray(field?.options) ? field.options : [];
          if (options.length > 0) {
            const idx = Number(String(val));
            if (!Number.isNaN(idx) && options[idx] !== undefined) return String(options[idx]);
          }
          return <span className="text-xs">{String(val)}</span>;
        }
      };
    }),
    { key: 'submitted_at', label: 'Date', sortable: true, render: (v: string) => v ? <span className="text-xs text-muted">{new Date(v).toLocaleDateString()}</span> : '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-heading">Submissions</h1>
          <p className="text-sm text-muted">
            {user.role === 'admin' 
              ? 'Comprehensive view of all form entries and documentation' 
              : 'Review and manage your submitted form entries'}
          </p>
        </div>
        {user.role === 'admin' && (
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 bg-surface-card border border-border rounded-xl text-sm font-medium hover:bg-surface shadow-sm"><FileDown size={16} /> Export CSV</button>
            <button onClick={exportZIP} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover shadow-sm"><Archive size={16} /> Export ZIP</button>
          </div>
        )}
      </div>

      <DataTable columns={columns} data={submissions} loading={loading} 
        searchPlaceholder="Search anything (Name, Email, Responses...)"
        searchValue={search} onSearch={setSearch}
        onRowClick={openDetail} emptyMessage="No submissions found" emptyIcon={<Inbox size={40} />}
        filters={
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-xl shadow-sm">
              <SlidersHorizontal size={14} className="text-primary" />
              <select value={formFilter} onChange={e => { setFormFilter(e.target.value); setVisibleFields([]); }} className="text-xs bg-transparent outline-none font-bold text-slate-700 min-w-[150px] cursor-pointer">
                <option value="">All Forms</option>
                {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
            </div>

            {formFilter && filterableFields.length > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="h-6 w-px bg-border mx-1" />
                <div className="relative group">
                  <select className="text-[10px] bg-primary text-white rounded-xl px-4 py-2 outline-none font-bold uppercase tracking-widest cursor-pointer hover:bg-primary-hover transition-all shadow-md appearance-none pr-8"
                    value="" onChange={e => { const val = e.target.value; if (val && !visibleFields.includes(val)) setVisibleFields(prev => [...prev, val]); }}>
                    <option value="">+ Add Column</option>
                    {filterableFields.filter(f => !visibleFields.includes(f.id)).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/80"><ChevronDown size={14} /></div>
                </div>
                {visibleFields.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-[300px] scrollbar-hide py-1 px-1">
                    {visibleFields.map(id => (
                      <div key={id} className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-xl px-3 py-1.5 text-[10px] font-bold whitespace-nowrap animate-in zoom-in-95">
                        <span>{filterableFieldMap[id]?.label || id}</span>
                        <button onClick={() => setVisibleFields(prev => prev.filter(x => x !== id))} className="p-0.5 hover:bg-primary/20 rounded-md"><X size={10} /></button>
                      </div>
                    ))}
                    <button onClick={() => setVisibleFields([])} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"><X size={14} /></button>
                  </div>
                )}
              </div>
            )}
          </div>
        }
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={isNominationSubmission(selected) ? `Token: ${selected?.unique_token || selected?.nomination_token || selected?.id || ''}` : `Submission #${selected?.id || ''}`} size="xl">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-surface rounded-xl p-3">
                <p className="text-[10px] text-muted uppercase font-semibold">
                  {isNominationSubmission(selected) ? 'Reference ID' : 'Submission ID'}
                </p>
                <p className="text-sm font-bold mt-0.5 text-primary">
                  {isNominationSubmission(selected) 
                    ? (selected.unique_token || selected.nomination_token || selected.nominationToken || selected.id || 'N/A') 
                    : (selected.id || 'N/A')}
                </p>
              </div>
              <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Form</p><p className="text-sm font-bold mt-0.5 truncate">{selected.form_title || `#${selected.form_id}`}</p></div>
              <div className="bg-surface rounded-xl p-3">
                <p className="text-[10px] text-muted uppercase font-semibold">{isNominationSubmission(selected) ? 'Nominated Teacher' : 'Submitted By'}</p>
                <p className="text-sm font-bold mt-0.5 truncate">{selected.user_name || 'Anonymous'}</p>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <p className="text-[10px] text-muted uppercase font-semibold">School Code</p>
                <p className="text-sm font-bold mt-0.5">{selected.school_code || 'N/A'}</p>
              </div>
              <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Status</p><div className="mt-0.5"><StatusBadge status={selected.status} /></div></div>
              {canSeeScore && <div className="bg-surface rounded-xl p-3"><p className="text-[10px] text-muted uppercase font-semibold">Score</p><p className="text-sm font-bold mt-0.5 text-emerald-600">{selected.score != null ? `${Number(typeof selected.score === 'object' ? selected.score?.percentage : selected.score).toFixed(2)}%` : 'N/A'}</p></div>}
            </div>
            {canSeeScore && <button onClick={() => { setSelected(null); navigate(`/forms/view?submission=${selected.id}`); }} className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20 flex items-center gap-1.5 w-fit"><ExternalLink size={13} /> View Full Response</button>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedNomination && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold flex items-center gap-2 text-primary border-b border-primary/10 pb-2"><Inbox size={14} /> 1. School Functionary Details</h4>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1"><p className="text-[10px] text-muted uppercase font-bold">Nominated Name</p><p className="text-sm font-semibold">{selectedNomination.teacher_name}</p></div>
                      <div className="space-y-1"><p className="text-[10px] text-muted uppercase font-bold">Nominated Email</p><p className="text-sm font-semibold">{selectedNomination.teacher_email}</p></div>
                      <div className="space-y-1"><p className="text-[10px] text-muted uppercase font-bold">School Code</p><p className="text-sm font-semibold font-mono">{selectedNomination.school_code}</p></div>
                      {Object.entries(nominationAdditionalData).map(([key, val]) => (
                        <div key={key} className="space-y-1">
                          <p className="text-[10px] text-muted uppercase font-bold">{key.replace(/_/g, ' ')}</p>
                          <p className="text-sm font-semibold">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {canSeeScore && (
                <div className={`space-y-4 ${!selectedNomination ? 'col-span-full' : ''}`}>
                  <h4 className="text-sm font-bold flex items-center gap-2 text-slate-700 border-b border-slate-200 pb-2"><Send size={14} /> {selectedNomination ? '2. Teacher Form Responses' : 'Form Responses'}</h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 max-h-[400px] overflow-y-auto">
                    {Object.keys(responses).length > 0 ? Object.entries(responses).map(([key, val]) => {
                      const isFile = typeof val === 'string' && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(val);
                      const fileUrl = isFile ? (val.startsWith('http') ? val : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(val)}`) : '';
                      return (
                        <div key={key} className="space-y-1 pb-2 border-b border-slate-200 last:border-0">
                          <p className="text-[10px] text-muted font-bold uppercase">{fieldMap[key]?.label || key}</p>
                          <div className="text-sm font-semibold">{isFile ? <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"><ExternalLink size={10} /> View File</a> : String(formatResponseValue(key, val))}</div>
                        </div>
                      );
                    }) : <p className="text-sm text-muted py-4 text-center italic">No responses found for this submission.</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

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
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase">Current Hierarchy</h4>
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
                        submissions.forEach(s => {
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
                    submissions.forEach(s => {
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
                  submissions.forEach(s => {
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
              submissions.forEach(s => {
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

      <Modal open={showNomProfile} onClose={() => setShowNomProfile(false)} title="Teacher Nomination Profile" size="lg">
        {selectedNomination && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-primary text-2xl font-bold">{selectedNomination.teacher_name?.charAt(0)}</div>
              <div><h3 className="text-lg font-bold">{selectedNomination.teacher_name}</h3><p className="text-sm text-muted">{selectedNomination.teacher_email}</p></div>
            </div>
            <div className="pt-4 border-t flex justify-end"><button onClick={() => setShowNomProfile(false)} className="px-6 py-2 bg-slate-100 rounded-xl text-sm font-bold">Close Profile</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
