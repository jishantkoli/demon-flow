import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../lib/auth';
import { api } from '../lib/api';
import { getCleanFileName } from '../lib/utils';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { Eye, MessageSquare, Filter, Send, FileDown, Inbox, ExternalLink, Archive, User as UserIcon, Mail, Hash, School, Fingerprint, Search, X, SlidersHorizontal, Info, ChevronDown, CheckCircle, Layers, Printer, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export default function Submissions({ user }: { user: User }) {
  const escapeHtml = (unsafe: any) => {
    return String(unsafe || '')
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

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
  const [levelFilter, setLevelFilter] = useState<number[]>([]);
  const [showLevelFilterDropdown, setShowLevelFilterDropdown] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [includeReviews, setIncludeReviews] = useState(false);
  const [search, setSearch] = useState('');
  const [showExportConfig, setShowExportConfig] = useState(false);
  const [showCsvConfig, setShowCsvConfig] = useState(false);
  const [csvSelectedFields, setCsvSelectedFields] = useState<string[]>([]);
  const [exportNamingStrategy, setExportNamingStrategy] = useState('email');
  const [exportSubNamingStrategy, setExportSubNamingStrategy] = useState('name');
  const [includeNominationData, setIncludeNominationData] = useState(true);
  const [isBulkZipping, setIsBulkZipping] = useState(false);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [zipSelectedFields, setZipSelectedFields] = useState<string[]>([]);
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [nominationFieldMap, setNominationFieldMap] = useState<Record<string, string>>({});
  const [processedNomFormIds, setProcessedNomFormIds] = useState<Set<string>>(new Set());

  const norm = (v: any) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const emailLocal = (v: any) => norm(v).split('@')[0];
  const compact = (v: any) => norm(v).replace(/[^a-z0-9]/g, '');

  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

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

  const effectiveForm = (formFilter ? forms.find(f => String(f.id || f._id) === String(formFilter)) : null) || (Array.isArray(selectedFormObj) ? selectedFormObj[0] : selectedFormObj);
  const isNominationForm = !!formFilter && (effectiveForm?.form_type === 'nomination' || effectiveForm?.formType === 'nomination');

  const canSeeScore = user.role === 'admin' || user.role === 'reviewer' || user.role === 'functionary';
  const canViewNominationDetails = user.role !== 'teacher';
  const showNominationDetails = canViewNominationDetails && !!selectedNomination;

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
      if (levelFilter.length > 0) url += `level=${levelFilter.join(',')}&`;
      if (schoolFilter) url += `school_code=${encodeURIComponent(schoolFilter)}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (user.role === 'reviewer') url += `reviewed_by_me=true&`;

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

      // Identify and load nomination forms
      const nomFormIds = new Set<string>();
      mappedSubs.forEach((s: any) => {
        const nom = s.nomination_id || s.nominationId;
        if (nom && typeof nom === 'object' && nom.form_id) {
          const fid = String(nom.form_id?._id || nom.form_id?.id || nom.form_id);
          if (fid && fid !== 'undefined') nomFormIds.add(fid);
        }
      });

      // Clear previous nomination field map to prevent pollution across forms
      const newFieldMap: Record<string, string> = {};
      const newProcessed = new Set<string>();

      if (nomFormIds.size > 0) {
        const idsToFetch = Array.from(nomFormIds);
        if (idsToFetch.length > 0) {
          const nomForms = await Promise.all(
            idsToFetch.map(id => api.get(`/forms?id=${id}`).catch(() => null))
          );

          nomForms.forEach(rawNf => {
            const nf = Array.isArray(rawNf) ? rawNf[0] : rawNf;
            if (!nf) return;
            const formId = nf.id || nf._id;
            if (formId) newProcessed.add(String(formId));

            const schema = nf.form_schema || nf.schema;
            if (schema) {
              const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
              const walk = (list: any[]) => {
                if (!Array.isArray(list)) return;
                list.forEach(fld => {
                  if (fld.id || fld.name) {
                    const label = fld.label || fld.title || fld.name || fld.id;
                    if (fld.id) newFieldMap[fld.id] = label;
                    if (fld.name) newFieldMap[fld.name] = label;
                  }
                  if (fld.children) walk(fld.children);
                });
              };
              if (parsed.sections) parsed.sections.forEach((s: any) => walk(s.fields || []));
              else if (parsed.fields) walk(parsed.fields);
              else if (Array.isArray(parsed)) walk(parsed);
            }

            // Also check settings for nomination_custom_fields
            const settings = typeof nf.settings === 'string' ? JSON.parse(nf.settings) : nf.settings;
            if (settings?.nomination_custom_fields && Array.isArray(settings.nomination_custom_fields)) {
              settings.nomination_custom_fields.forEach((cf: any) => {
                if (cf.id && cf.label) {
                  newFieldMap[cf.id] = cf.label;
                  // Also map without cf_ prefix if it exists
                  const cleanId = cf.id.replace(/^cf_/i, '');
                  if (cleanId !== cf.id) newFieldMap[cleanId] = cf.label;
                }
              });
            }
          });
          setNominationFieldMap(newFieldMap);
          setProcessedNomFormIds(newProcessed);
        }
      }
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
  }, [statusFilter, formFilter, levelFilter, schoolFilter, search]);

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

  const formatResponseValue = (fieldId: string, val: any, customFieldMap?: Record<string, any>) => {
    const field = (customFieldMap && customFieldMap[fieldId]) || filterableFieldMap[fieldId];
    if (field?.options && Array.isArray(field.options)) {
      const getLabel = (v: any) => {
        if (v === undefined || v === null) return '';
        const vStr = String(v).trim();

        // Find by value (exact or string match)
        const opt = field.options.find((o: any) => String(o.value) === vStr);
        if (opt) return opt.label || opt.value;

        // If the value is a number (common in MCQs), try finding by index if values are not explicit
        const idx = parseInt(vStr);
        if (!isNaN(idx) && field.options[idx]) {
          const o = field.options[idx];
          return typeof o === 'string' ? o : (o.label || o.value);
        }

        // Fallback: try finding by label match
        const optByLabel = field.options.find((o: any) => String(o.label) === vStr);
        return optByLabel ? optByLabel.label : v;
      };

      if (Array.isArray(val)) {
        return val.map(getLabel).join(', ');
      }
      return getLabel(val);
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
        if (matched) {
          setSelectedNomination(matched);

          // Load nomination schema if missing
          const nomFormId = String(matched.form_id?._id || matched.form_id?.id || matched.form_id || '');
          if (nomFormId && nomFormId !== 'undefined' && !processedNomFormIds.has(nomFormId)) {
            const rawNf = await api.get(`/forms?id=${nomFormId}`).catch(() => null);
            const nf = Array.isArray(rawNf) ? rawNf[0] : rawNf;
            if (nf) {
              const schema = nf.form_schema || nf.schema;
              const newFieldMap: Record<string, string> = { ...nominationFieldMap };
              if (schema) {
                const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
                const walk = (list: any[]) => {
                  if (!Array.isArray(list)) return;
                  list.forEach((f: any) => {
                    if (f.id || f.name) {
                      const label = f.label || f.title || f.name || f.id;
                      if (f.id) newFieldMap[f.id] = label;
                      if (f.name) newFieldMap[f.name] = label;
                    }
                    if (f.children) walk(f.children);
                  });
                };
                if (parsed.sections) parsed.sections.forEach((s: any) => walk(s.fields || []));
                else if (parsed.fields) walk(parsed.fields);
                else if (Array.isArray(parsed)) walk(parsed);
              }

              // Also check settings for nomination_custom_fields
              const settings = typeof nf.settings === 'string' ? JSON.parse(nf.settings) : nf.settings;
              if (settings?.nomination_custom_fields && Array.isArray(settings.nomination_custom_fields)) {
                settings.nomination_custom_fields.forEach((cf: any) => {
                  if (cf.id && cf.label) {
                    newFieldMap[cf.id] = cf.label;
                    const cleanId = cf.id.replace(/^cf_/i, '');
                    if (cleanId !== cf.id) newFieldMap[cleanId] = cf.label;
                  }
                });
              }

              setNominationFieldMap(newFieldMap);
              setProcessedNomFormIds(prev => new Set(prev).add(nomFormId));
            }
          }
        }
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
        ? [(byTokenRaw as any).data]
        : Array.isArray((byTokenRaw as any)) ? (byTokenRaw as any) : [];

      const nomMap = new Map<string, any>();
      [...byTokenNoms, ...byIdNoms, ...byEmailNoms].forEach((n: any) => {
        const key = String(n?.id || n?._id || `${n?.teacher_email || ''}-${n?.createdAt || ''}`);
        if (key) nomMap.set(key, n);
      });
      const allNoms = Array.from(nomMap.values());
      if (allNoms.length > 0) {
        const matched = pickBestNomination(allNoms, sub, nominationIdParam);
        if (matched) {
          setSelectedNomination(matched);

          // Load nomination schema if missing
          const nomFormId = String(matched.form_id?._id || matched.form_id?.id || matched.form_id || '');
          if (nomFormId && nomFormId !== 'undefined' && !processedNomFormIds.has(nomFormId)) {
            const rawNf = await api.get(`/forms?id=${nomFormId}`).catch(() => null);
            const nf = Array.isArray(rawNf) ? rawNf[0] : rawNf;
            if (nf) {
              const schema = nf.form_schema || nf.schema;
              const newFieldMap: Record<string, string> = { ...nominationFieldMap };
              if (schema) {
                const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
                const walk = (list: any[]) => {
                  if (!Array.isArray(list)) return;
                  list.forEach((f: any) => {
                    if (f.id || f.name) {
                      const label = f.label || f.title || f.name || f.id;
                      if (f.id) newFieldMap[f.id] = label;
                      if (f.name) newFieldMap[f.name] = label;
                    }
                    if (f.children) walk(f.children);
                  });
                };
                if (parsed.sections) parsed.sections.forEach((s: any) => walk(s.fields || []));
                else if (parsed.fields) walk(parsed.fields);
                else if (Array.isArray(parsed)) walk(parsed);
              }

              // Also check settings for nomination_custom_fields
              const settings = typeof nf.settings === 'string' ? JSON.parse(nf.settings) : nf.settings;
              if (settings?.nomination_custom_fields && Array.isArray(settings.nomination_custom_fields)) {
                settings.nomination_custom_fields.forEach((cf: any) => {
                  if (cf.id && cf.label) {
                    newFieldMap[cf.id] = cf.label;
                    const cleanId = cf.id.replace(/^cf_/i, '');
                    if (cleanId !== cf.id) newFieldMap[cleanId] = cf.label;
                  }
                });
              }

              setNominationFieldMap(newFieldMap);
              setProcessedNomFormIds(prev => new Set(prev).add(nomFormId));
            }
          }
        }
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

  const buildNominationExportFields = (nomKeys: Set<string>) => {
    const staticFields = [
      { id: 'nom_teacher_name', label: 'Nomination: Nominated Name' },
      { id: 'nom_teacher_email', label: 'Nomination: Nominated Email' },
      { id: 'nom_nom_school_code', label: 'Nomination: School Code' },
    ];
    const dynamicFields = Array.from(nomKeys).map(k => ({
      id: `nom_${k}`,
      label: nominationFieldMap[k]
        ? `Nomination: ${nominationFieldMap[k]}`
        : `Nomination: ${k.replace(/_/g, ' ').replace(/^cf\s+/i, '').replace(/^cf_/i, '')}`
    }));
    const seenIds = new Set<string>();
    const seenLabels = new Set<string>();

    return [...staticFields, ...dynamicFields].filter(f => {
      if (seenIds.has(f.id)) return false;
      if (seenLabels.has(f.label)) return false; // Prevent duplicate labels

      // Skip redundant IDs if they match static fields
      const cleanKey = f.id.replace('nom_', '');
      if (['teacher_name', 'teacher_email', 'school_code', 'nom_school_code'].includes(cleanKey)) {
        if (f.id !== 'nom_teacher_name' && f.id !== 'nom_teacher_email' && f.id !== 'nom_nom_school_code') return false;
      }

      seenIds.add(f.id);
      seenLabels.add(f.label);
      return true;
    });
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

    const functionaryFields = buildNominationExportFields(nominationKeys);

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

    const functionaryFields = buildNominationExportFields(nominationKeys);

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
          if (f.id === 'nom_teacher_name') return nom?.teacher_name || '';
          if (f.id === 'nom_teacher_email') return nom?.teacher_email || '';
          if (f.id === 'nom_nom_school_code') return nom?.school_code || '';
          const key = f.id.replace('nom_', '');
          const val = nomData[key];
          if (val === undefined || val === null) return '';
          return String(val);
        }

        const val = formatResponseValue(f.id, resps[f.id]);
        if (val === undefined || val === null) return '';
        if (Array.isArray(val)) return val.join(', ');
        return String(val);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions');
    const xlsxArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions-${new Date().toISOString().split('T')[0]}.xlsx`;
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
    const noms = buildNominationExportFields(nomKeys).map(f => f.id);
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

  const printBulkProfiles = async () => {
    if (submissions.length === 0) {
      alert('No submissions found to print.');
      return;
    }

    if (submissions.length > 50) {
      if (!confirm(`You are about to print ${submissions.length} profiles. This may take a while. Continue?`)) {
        return;
      }
    }

    setIsBulkPrinting(true);
    try {
      const printWindow = window.open('', '_blank', 'width=1100,height=850');
      if (!printWindow) {
        alert('Popup blocked. Please allow popups to print profiles.');
        setIsBulkPrinting(false);
        return;
      }

      let combinedHtml = `
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Bulk Profiles Print - Submissions</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; line-height: 1.45; }
            .page { padding: 24px; page-break-after: always; min-height: 100vh; }
            .page:last-child { page-break-after: auto; }
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
            @media print {
              body { margin: 0; }
              .page { padding: 12mm; border: none; }
            }
          </style>
        </head>
        <body>
      `;

      for (const sub of submissions) {
        try {
          // Fetch full details (similar to openDetail)
          const formIdParam = sub.form_id || sub.formId;
          const nominationIdParamRaw = sub.nomination_id || sub.nominationId;
          const nominationIdParam = typeof nominationIdParamRaw === 'object'
            ? (nominationIdParamRaw?._id || nominationIdParamRaw?.id || '')
            : nominationIdParamRaw;

          const [comms, formRes, nomsRes] = await Promise.all([
            api.get(`/comments?submission_id=${sub.id}`).catch(() => []),
            formIdParam ? api.get(`/forms?id=${formIdParam}`).catch(() => null) : Promise.resolve(null),
            nominationIdParam ? api.get(`/nominations?id=${nominationIdParam}`).catch(() => []) : Promise.resolve([])
          ]);

          const formObj = Array.isArray(formRes) ? formRes[0] : formRes;
          const allNoms = Array.isArray(nomsRes) ? nomsRes : (nomsRes as any)?.data ? [(nomsRes as any).data] : [nomsRes];
          const nomination = pickBestNomination(allNoms, sub, nominationIdParam);

          const { name } = extractNameEmailFromSubmission(sub);
          const displayName = toTitleCase(isAnonymousDirectForm(sub) ? (name || 'Anonymous') : (sub.user_name || name || 'Anonymous'));
          const statusText = String(sub.status || 'N/A').replace(/_/g, ' ');
          const scoreVal = sub.score != null ? `${Number(typeof sub.score === 'object' ? sub.score?.percentage : sub.score).toFixed(2)}%` : 'N/A';

          // Responses
          let responses: Record<string, any> = {};
          if (sub.responses) {
            try {
              const parsed = typeof sub.responses === 'string' ? JSON.parse(sub.responses) : sub.responses;
              if (Array.isArray(parsed)) parsed.forEach((r: any) => { if (r.fieldId) responses[r.fieldId] = r.value; });
              else responses = parsed || {};
            } catch { responses = {}; }
          }

          // Field Map
          const currentFieldMap: Record<string, any> = {};
          const walk = (list: any[]) => {
            if (!Array.isArray(list)) return;
            list.forEach((f: any) => {
              if (f?.id) currentFieldMap[f.id] = f;
              if (f?.children) walk(f.children);
            });
          };
          const schemaSource = formObj?.form_schema || formObj?.schema;
          if (schemaSource) {
            const parsed = typeof schemaSource === 'string' ? JSON.parse(schemaSource) : schemaSource;
            if (Array.isArray(parsed)) walk(parsed);
            else if (parsed?.sections) parsed.sections.forEach((s: any) => walk(s.fields || []));
            else if (parsed?.fields) walk(parsed.fields);
          }

          const responsesHtml = Object.keys(responses).length > 0
            ? Object.entries(responses).map(([k, v], idx) => {
              const field = currentFieldMap[k];
              const label = field?.label || k;
              let displayValue = '';
              const strVal = typeof v === 'string' ? v.trim() : '';
              const isFile = typeof v === 'string' && (field?.type === 'file' || /\.(pdf|docx|xlsx|pptx|txt|jpg|jpeg|png|gif|webp)$/i.test(strVal) || strVal.includes('res.cloudinary.com'));
              displayValue = isFile ? '<span style="color: #2563eb; font-weight: bold;">[File Attached]</span>' : String(formatResponseValue(k, v, currentFieldMap));
              return `<tr><td>${idx + 1}</td><td>${label}</td><td>${displayValue}</td></tr>`;
            }).join('')
            : '<tr><td colspan="3">No responses found.</td></tr>';

          const nomData = nomination ? parseObject(nomination.additional_data) : {};
          const nominationHtml = nomination && Object.keys(nomData).length > 0
            ? `<section class="card"><h2>School Functionary Details</h2><div class="meta"><div><strong>Nominated Teacher:</strong> ${nomination.teacher_name}</div><div><strong>School Code:</strong> ${nomination.school_code}</div>${Object.entries(nomData).map(([key, val]) => `<div><strong>${nominationFieldMap[key] || key.replace(/_/g, ' ')}:</strong> ${String(val)}</div>`).join('')}</div></section>`
            : '';

          combinedHtml += `
            <div class="page">
              <section class="header">
                <h1 class="title">${displayName}</h1>
                <div class="muted">${sub.user_email || ''}</div>
                <div class="meta">
                  <div><strong>Form:</strong> ${sub.form_title || '-'}</div>
                  <div><strong>Status:</strong> ${statusText}</div>
                  <div><strong>Score:</strong> ${scoreVal}</div>
                  <div><strong>Submitted:</strong> ${new Date(sub.submitted_at).toLocaleDateString()}</div>
                </div>
              </section>
              ${nominationHtml}
              <section class="card"><h2>Form Responses</h2><table><thead><tr><th>#</th><th>Field</th><th>Response</th></tr></thead><tbody>${responsesHtml}</tbody></table></section>
            </div>
          `;
        } catch (e) {
          console.error('Error adding submission to bulk print:', e);
        }
      }

      combinedHtml += '</body></html>';
      printWindow.document.open();
      printWindow.document.write(combinedHtml);
      printWindow.document.close();

      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          alert('Unable to start printing automatically. Please use Ctrl+P in the print window.');
        }
        setIsBulkPrinting(false);
      }, 500);

    } catch (err: any) {
      console.error('Bulk Print Error:', err);
      alert('Failed to generate bulk print: ' + err.message);
      setIsBulkPrinting(false);
    }
  };

  const zipBulkProfiles = async () => {
    if (submissions.length === 0) {
      alert('No submissions found to ZIP.');
      return;
    }

    if (submissions.length > 50) {
      if (!confirm(`You are about to generate ZIP for ${submissions.length} profiles. This may take a while. Continue?`)) {
        return;
      }
    }

    setIsBulkZipping(true);
    const zip = new JSZip();

    try {
      for (const sub of submissions) {
        try {
          // Fetch full details
          const formIdParam = sub.form_id || sub.formId;
          const nominationIdParamRaw = sub.nomination_id || sub.nominationId;
          const nominationIdParam = typeof nominationIdParamRaw === 'object'
            ? (nominationIdParamRaw?._id || nominationIdParamRaw?.id || '')
            : nominationIdParamRaw;

          const [comms, formRes, nomsRes] = await Promise.all([
            api.get(`/comments?submission_id=${sub.id}`).catch(() => []),
            formIdParam ? api.get(`/forms?id=${formIdParam}`).catch(() => null) : Promise.resolve(null),
            nominationIdParam ? api.get(`/nominations?id=${nominationIdParam}`).catch(() => []) : Promise.resolve([])
          ]);

          const formObj = Array.isArray(formRes) ? formRes[0] : formRes;
          const allNoms = Array.isArray(nomsRes) ? nomsRes : (nomsRes as any)?.data ? [(nomsRes as any).data] : [nomsRes];
          const nomination = pickBestNomination(allNoms, sub, nominationIdParam);

          const { name } = extractNameEmailFromSubmission(sub);
          const displayName = toTitleCase(isAnonymousDirectForm(sub) ? (name || 'Anonymous') : (sub.user_name || name || 'Anonymous'));
          const statusText = String(sub.status || 'N/A').replace(/_/g, ' ');
          const scoreVal = sub.score != null ? `${Number(typeof sub.score === 'object' ? sub.score?.percentage : sub.score).toFixed(2)}%` : 'N/A';

          // Responses
          let responses: Record<string, any> = {};
          if (sub.responses) {
            try {
              const parsed = typeof sub.responses === 'string' ? JSON.parse(sub.responses) : sub.responses;
              if (Array.isArray(parsed)) parsed.forEach((r: any) => { if (r.fieldId) responses[r.fieldId] = r.value; });
              else responses = parsed || {};
            } catch { responses = {}; }
          }

          // Field Map
          const currentFieldMap: Record<string, any> = {};
          const walk = (list: any[]) => {
            if (!Array.isArray(list)) return;
            list.forEach((f: any) => {
              if (f?.id) currentFieldMap[f.id] = f;
              if (f?.children) walk(f.children);
            });
          };
          const schemaSource = formObj?.form_schema || formObj?.schema;
          if (schemaSource) {
            const parsed = typeof schemaSource === 'string' ? JSON.parse(schemaSource) : schemaSource;
            if (Array.isArray(parsed)) walk(parsed);
            else if (parsed?.sections) parsed.sections.forEach((s: any) => walk(s.fields || []));
            else if (parsed?.fields) walk(parsed.fields);
          }

          const responsesHtml = Object.keys(responses).length > 0
            ? Object.entries(responses).map(([k, v], idx) => {
              const field = currentFieldMap[k];
              const label = field?.label || k;
              let displayValue = '';
              const strVal = typeof v === 'string' ? v.trim() : '';
              const isFile = typeof v === 'string' && (field?.type === 'file' || /\.(pdf|docx|xlsx|pptx|txt|jpg|jpeg|png|gif|webp)$/i.test(strVal) || strVal.includes('res.cloudinary.com'));
              displayValue = isFile ? `<span style="color: #2563eb; font-weight: bold;">[File Attached]</span>` : escapeHtml(String(formatResponseValue(k, v, currentFieldMap)));
              return `<tr><td>${idx + 1}</td><td>${escapeHtml(label)}</td><td>${displayValue}</td></tr>`;
            }).join('')
            : '<tr><td colspan="3">No responses found.</td></tr>';

          const nomData = nomination ? parseObject(nomination.additional_data) : {};
          const nominationHtml = nomination && Object.keys(nomData).length > 0
            ? `<section class="card"><h2>School Functionary Details</h2><div class="meta"><div><strong>Nominated Teacher:</strong> ${escapeHtml(nomination.teacher_name)}</div><div><strong>School Code:</strong> ${escapeHtml(nomination.school_code)}</div>${Object.entries(nomData).map(([key, val]) => `<div><strong>${escapeHtml(nominationFieldMap[key] || key.replace(/_/g, ' '))}:</strong> ${escapeHtml(String(val))}</div>`).join('')}</div></section>`
            : '';

          const htmlContent = `
            <!doctype html>
            <html>
            <head>
              <meta charset="utf-8" />
              <title>${escapeHtml(displayName)} - Profile</title>
              <style>
                body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; line-height: 1.45; }
                .header { border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
                .title { font-size: 22px; font-weight: 700; margin: 0; }
                .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; font-size: 13px; }
                .muted { color: #475569; font-size: 12px; }
                .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 12px 0; }
                h2 { margin: 0 0 10px 0; font-size: 18px; }
                h3 { margin: 0 0 6px 0; font-size: 15px; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; font-size: 12px; }
                th { background: #f8fafc; font-weight: 700; }
              </style>
            </head>
            <body>
              <section class="header">
                <h1 class="title">${escapeHtml(displayName)}</h1>
                <div class="muted">${escapeHtml(sub.user_email || '')}</div>
                <div class="meta">
                  <div><strong>Form:</strong> ${escapeHtml(sub.form_title || '-')}</div>
                  <div><strong>Status:</strong> ${escapeHtml(statusText)}</div>
                  <div><strong>Score:</strong> ${escapeHtml(scoreVal)}</div>
                  <div><strong>Submitted:</strong> ${new Date(sub.submitted_at).toLocaleDateString()}</div>
                </div>
              </section>
              ${nominationHtml}
              <section class="card"><h2>Form Responses</h2><table><thead><tr><th>#</th><th>Field</th><th>Response</th></tr></thead><tbody>${responsesHtml}</tbody></table></section>
            </body>
            </html>
          `;

          const fileName = `${displayName.replace(/[^a-z0-9]/gi, '_')}_${sub.id}.html`;
          zip.file(fileName, htmlContent);
        } catch (e) {
          console.error(`Error adding submission to bulk ZIP for sub ${sub.id}:`, e);
        }
      }

      console.log('Generating ZIP file...');
      const content = await zip.generateAsync({ type: 'blob' });
      console.log('ZIP file generated, triggering download...');
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Submissions_Rendered_Profiles.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      setIsBulkZipping(false);
      console.log('Bulk ZIP completed.');

    } catch (err: any) {
      console.error('Bulk ZIP Error:', err);
      alert('Failed to generate bulk ZIP: ' + err.message);
      setIsBulkZipping(false);
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
        <div className={`p-1 -m-1 rounded-lg transition-colors group ${isNominationSubmission(row) && user.role !== 'teacher' ? 'cursor-pointer hover:bg-primary/5' : ''}`}
          onClick={(e) => { if (!isNominationSubmission(row) || user.role === 'teacher') return; e.stopPropagation(); openNominationOnly(row); }}>
          <p className="text-sm font-medium group-hover:text-primary">
            {(() => {
              const { name } = extractNameEmailFromSubmission(row);
              const displayName = isAnonymousDirectForm(row) ? (name || 'Anonymous') : (v || name || 'Anonymous');
              return toTitleCase(displayName);
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
    { 
      key: 'status', 
      label: 'Status', 
      render: (v: string, row: any) => {
        if (user.role === 'reviewer') {
          // For reviewers, show their own recommendation as the status
          const rec = row.my_review?.recommendation;
          if (rec) {
            const status = rec === 'approve' ? 'approved' : rec;
            return <StatusBadge status={status} />;
          }
          return <StatusBadge status="pending" />;
        }
        const displayStatus = user.role === 'teacher' && (v === 'under_review' || v === 'approved' || v === 'rejected') ? 'submitted' : v;
        return <StatusBadge status={displayStatus} />;
      } 
    },
    { 
      key: 'score', 
      label: user.role === 'reviewer' ? 'My Score' : 'Score', 
      sortable: true, 
      hidden: !canSeeScore, 
      render: (v: any, row: any) => {
        if (user.role === 'reviewer' && row.my_review) {
          const score = Number(row.my_review.overall_score);
          if (isNaN(score)) return <span className="text-muted">—</span>;
          return (
            <div className="flex flex-col">
              <span className="font-bold text-sm text-primary">{score.toFixed(2)}%</span>
              {row.my_review.grade && <span className="text-[10px] text-muted font-bold uppercase">Grade: {row.my_review.grade}</span>}
            </div>
          );
        }
        const scoreVal = typeof v === 'object' ? v?.percentage : v;
        const score = Number(scoreVal);
        return (v != null && !isNaN(score)) ? <span className="font-bold text-sm text-primary">{score.toFixed(2)}%</span> : <span className="text-muted">—</span>;
      } 
    },
    ...visibleFields.map(fieldId => {
      const field = fieldMap[fieldId];
      return {
        key: `field_${fieldId}`,
        label: field?.label || fieldId,
        render: (_v: any, row: any) => {
          const resps = parseResponses(row.responses);
          const val = resps[fieldId];
          if (val === undefined || val === null) return <span className="text-muted">—</span>;
          const stringVal = typeof val === 'string' ? val.trim() : '';
          const isUploadPath = /^https?:\/\/[^/\s]+\/uploads\//i.test(stringVal) || /^\/?uploads\//i.test(stringVal);
          const isFile = typeof val === 'string' && (
            field?.type === 'file' ||
            /\.(pdf|docx|xlsx|pptx|txt|jpg|jpeg|png|gif|webp|csv)$/i.test(stringVal) ||
            stringVal.includes('res.cloudinary.com') ||
            isUploadPath
          );
          if (isFile) {
            const fileUrl = stringVal.startsWith('http') ? stringVal : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(stringVal)}`;
            return <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs"><ExternalLink size={10} /> {getCleanFileName(stringVal)}</a>;
          }
          if (Array.isArray(val)) return val.join(', ');
          return <span className="text-xs">{String(formatResponseValue(fieldId, val, fieldMap))}</span>;
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
            <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 bg-surface-card border border-border rounded-xl text-sm font-medium hover:bg-surface shadow-sm"><FileDown size={16} /> Export Excel (XLSX)</button>
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
            {(user.role as string) === 'admin' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-xl shadow-sm">
                <SlidersHorizontal size={14} className="text-primary" />
                <select value={formFilter} onChange={e => { setFormFilter(e.target.value); setVisibleFields([]); }} className="text-xs bg-transparent outline-none font-bold text-slate-700 min-w-[150px] cursor-pointer">
                  <option value="">All Forms</option>
                  {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                </select>
              </div>
            )}

            {(user.role as string) === 'admin' && formFilter && filterableFields.length > 0 && (
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
              <div className="bg-surface rounded-xl p-3">
                <p className="text-[10px] text-muted uppercase font-semibold">Status</p>
                <div className="mt-0.5">
                  <StatusBadge status={user.role === 'reviewer' 
                    ? (selected.my_review?.recommendation === 'approve' ? 'approved' : (selected.my_review?.recommendation || 'pending')) 
                    : selected.status} 
                  />
                </div>
              </div>
              {canSeeScore && (
                <div className="bg-surface rounded-xl p-3">
                  <p className="text-[10px] text-muted uppercase font-semibold">{user.role === 'reviewer' ? 'My Score' : 'Score'}</p>
                  <p className="text-sm font-bold mt-0.5 text-emerald-600">
                    {(() => {
                      if (user.role === 'reviewer' && selected.my_review) {
                        const s = Number(selected.my_review.overall_score);
                        return isNaN(s) ? 'N/A' : `${s.toFixed(2)}%`;
                      }
                      const scoreVal = typeof selected.score === 'object' ? selected.score?.percentage : selected.score;
                      const s = Number(scoreVal);
                      return (selected.score != null && !isNaN(s)) ? `${s.toFixed(2)}%` : 'N/A';
                    })()}
                  </p>
                </div>
              )}
            </div>
            {canSeeScore && user.role !== 'functionary' && <button onClick={() => { setSelected(null); navigate(`/forms/view?submission=${selected.id}`); }} className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20 flex items-center gap-1.5 w-fit"><ExternalLink size={13} /> View Full Response</button>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {showNominationDetails && (
                <div className={`space-y-4 ${user.role === 'functionary' ? 'col-span-full' : ''}`}>
                  <h4 className="text-sm font-bold flex items-center gap-2 text-primary border-b border-primary/10 pb-2"><Inbox size={14} /> 1. School Functionary Details</h4>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1"><p className="text-[10px] text-muted uppercase font-bold">Nominated Name</p><p className="text-sm font-semibold">{selectedNomination.teacher_name}</p></div>
                      <div className="space-y-1"><p className="text-[10px] text-muted uppercase font-bold">Nominated Email</p><p className="text-sm font-semibold">{selectedNomination.teacher_email}</p></div>
                      <div className="space-y-1"><p className="text-[10px] text-muted uppercase font-bold">School Code</p><p className="text-sm font-semibold font-mono">{selectedNomination.school_code}</p></div>
                      {Object.entries(nominationAdditionalData).map(([key, val]) => {
                        const rawVal = String(val ?? '').trim();
                        const isHttpUrl = /^https?:\/\//i.test(rawVal);
                        const isUploadPath = /^\/?uploads\//i.test(rawVal) || /^https?:\/\/[^/\s]+\/uploads\//i.test(rawVal);
                        const looksLikeFile = /\.(pdf|docx|xlsx|pptx|txt|jpg|jpeg|png|gif|webp|csv)$/i.test(rawVal) || rawVal.includes('res.cloudinary.com');
                        const showAsLink = isHttpUrl || isUploadPath || looksLikeFile;
                        const fileUrl = showAsLink
                          ? (isHttpUrl
                            ? rawVal
                            : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(rawVal.replace(/^\/?uploads\//i, ''))}`)
                          : '';

                        return (
                          <div key={key} className="space-y-1">
                            <p className="text-[10px] text-muted uppercase font-bold">
                              {nominationFieldMap[key] ||
                                nominationFieldMap[`cf_${key}`] ||
                                key.replace(/_/g, ' ').replace(/^cf\s+/i, '').replace(/^cf_/i, '')}
                            </p>
                            <div className="text-sm font-semibold">
                              {showAsLink ? (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                  <ExternalLink size={10} /> {getCleanFileName(rawVal)}
                                </a>
                              ) : (
                                String(val)
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {user.role !== 'functionary' && (
                <div className={`space-y-4 ${!showNominationDetails ? 'col-span-full' : ''}`}>
                  <h4 className="text-sm font-bold flex items-center gap-2 text-slate-700 border-b border-slate-200 pb-2"><Send size={14} /> {showNominationDetails ? '2. Teacher Form Responses' : 'Form Responses'}</h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 max-h-[400px] overflow-y-auto">
                    {Object.keys(responses).length > 0 ? Object.entries(responses).map(([key, val]) => {
                      const strVal = typeof val === 'string' ? val.trim() : '';
                      const isUploadPath = /^https?:\/\/[^/\s]+\/uploads\//i.test(strVal) || /^\/?uploads\//i.test(strVal);
                      const isFile = typeof val === 'string' && (
                        fieldMap[key]?.type === 'file' ||
                        /\.(pdf|docx|xlsx|pptx|txt|jpg|jpeg|png|gif|webp)$/i.test(strVal) ||
                        strVal.includes('res.cloudinary.com') ||
                        isUploadPath
                      );
                      const fileUrl = isFile ? (strVal.startsWith('http') ? strVal : `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001/api/v1').replace('/api/v1', '')}/uploads/${encodeURIComponent(strVal)}`) : '';
                      return (
                        <div key={key} className="space-y-1 pb-2 border-b border-slate-200 last:border-0">
                          <p className="text-[10px] text-muted font-bold uppercase">{fieldMap[key]?.label || key}</p>
                          <div className="text-sm font-semibold">{isFile ? <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"><ExternalLink size={10} /> {getCleanFileName(strVal)}</a> : String(formatResponseValue(key, val, fieldMap))}</div>
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
                    <p>📄 submission.xlsx (Teacher Data)</p>
                    <p>📂 uploads/ (Teacher Files)</p>
                    {exportNamingStrategy === 'school' && includeNominationData && (
                      <>
                        <p className="text-amber-500/70">📄 nomination.xlsx (Functionary Data)</p>
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
                        const noms = isNominationForm ? buildNominationExportFields(nomKeys).map(f => f.id) : [];
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
                    const nomFields = buildNominationExportFields(nomKeys);

                    return [
                      {
                        label: 'Basic Identity', fields: [
                          { id: 'id', label: 'Reference ID' },
                          { id: 'form_title', label: 'Form Title' },
                          { id: 'user_name', label: 'Submitted By' },
                          { id: 'user_email', label: 'Email Address' },
                          { id: 'school_code', label: 'School Code' },
                          { id: 'status', label: 'Submission Status' },
                          { id: 'score', label: 'Evaluation Score' },
                          { id: 'submitted_at', label: 'Timestamp' }
                        ]
                      },
                      ...(nomFields.length > 0 && isNominationForm ? [{ label: 'School Functionary Data', fields: nomFields }] : []),
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

      <Modal open={showCsvConfig} onClose={() => setShowCsvConfig(false)} title="Export Excel (XLSX) Configuration" size="lg">
        <div className="space-y-6">
          <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-primary">Select Columns to Export</h4>
              <p className="text-[11px] text-muted">Choose which fields you want in your Excel (XLSX) file</p>
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
                  const noms = isNominationForm ? buildNominationExportFields(nomKeys).map(f => f.id) : [];
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
              const nomFields = buildNominationExportFields(nomKeys);

              return [
                {
                  label: 'Basic Info', fields: [
                    { id: 'id', label: 'Reference ID' },
                    { id: 'form_title', label: 'Form Title' },
                    { id: 'user_name', label: 'Submitted By' },
                    { id: 'user_email', label: 'Email' },
                    { id: 'school_code', label: 'School Code' },
                    { id: 'status', label: 'Status' },
                    { id: 'score', label: 'Score' },
                    { id: 'submitted_at', label: 'Submission Date' }
                  ]
                },
                ...(nomFields.length > 0 && isNominationForm ? [{ label: 'School Functionary Data', fields: nomFields }] : []),
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
              <FileDown size={18} /> Download Excel (XLSX)
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
