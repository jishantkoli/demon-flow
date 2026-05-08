import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Printer } from 'lucide-react';

interface Column { key: string; label: string; sortable?: boolean; render?: (value: any, row: any) => React.ReactNode; hidden?: boolean; }
interface DataTableProps {
  columns: Column[]; data: any[]; searchable?: boolean; searchPlaceholder?: string; pageSize?: number;
  onRowClick?: (row: any) => void; actions?: (row: any) => React.ReactNode; emptyMessage?: string;
  emptyIcon?: React.ReactNode; loading?: boolean; filters?: React.ReactNode; title?: string; subtitle?: string;
  headerActions?: React.ReactNode;
  searchValue?: string; onSearch?: (val: string) => void;
}

export default function DataTable({ 
  columns, data, searchable = true, searchPlaceholder = 'Search...', pageSize = 12, 
  onRowClick, actions, emptyMessage = 'No data found', emptyIcon, loading, 
  filters, title, subtitle, headerActions,
  searchValue, onSearch 
}: DataTableProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const search = searchValue !== undefined ? searchValue : internalSearch;

  const handlePrint = () => {
    window.print();
  };
  const handleSearchChange = (val: string) => {
    if (onSearch) onSearch(val);
    else setInternalSearch(val);
    setPage(0);
  };

  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const visibleCols = columns.filter(c => !c.hidden);

  const filtered = useMemo(() => {
    let result = data;
    // Only filter client-side if we are NOT using external search
    if (search && !onSearch) {
      const q = search.toLowerCase();
      result = result.filter(row => {
        // 1. Search in visible column keys
        const matchInCols = visibleCols.some(col => String(row[col.key] || '').toLowerCase().includes(q));
        if (matchInCols) return true;

        // 2. Deep search in responses if they exist
        let responses = row.responses;
        if (typeof responses === 'string') {
          try { responses = JSON.parse(responses); } catch { responses = []; }
        }
        if (Array.isArray(responses)) {
          const matchInResponses = responses.some(r => String(r.value || '').toLowerCase().includes(q));
          if (matchInResponses) return true;
        } else if (responses && typeof responses === 'object') {
          const matchInResponses = Object.values(responses).some(v => String(v || '').toLowerCase().includes(q));
          if (matchInResponses) return true;
        }

        // 3. Search in other common fields that might not be visible as columns
        const otherFields = ['user_email', 'userEmail', 'school_code', 'schoolCode', 'form_title', 'formTitle'];
        return otherFields.some(f => String(row[f] || '').toLowerCase().includes(q));
      });
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const cmp = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, sortKey, sortDir, visibleCols]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const toggleSort = (key: string) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); } };

  return (
    <div className="bg-surface-card rounded-2xl border border-border overflow-hidden shadow-sm relative print-container">
      {/* Loading overlay for smoother search/filter experience */}
      {loading && (
        <div className="absolute inset-0 bg-surface/40 backdrop-blur-[1px] z-10 flex items-center justify-center no-print">
          <div className="flex flex-col items-center gap-2 bg-white/80 p-4 rounded-2xl shadow-xl border border-border animate-in zoom-in-95 duration-200">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Loading...</p>
          </div>
        </div>
      )}

      {(title || headerActions) && (
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3 no-print">
          <div>{title && <h3 className="font-semibold font-heading text-sm">{title}</h3>}{subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}</div>
          {headerActions}
        </div>
      )}
      {/* Printable Title (Only visible during print) */}
      <div className="print-only hidden py-6 text-center">
        <h1 className="text-2xl font-bold text-black uppercase tracking-wider">{title || 'Form Submissions Data'}</h1>
        <p className="text-sm text-gray-500 mt-1">Generated on {new Date().toLocaleDateString()}</p>
      </div>

      {(searchable || filters) && (
        <div className="px-5 py-3 border-b border-border/50 flex flex-wrap items-center gap-3 no-print">
          {searchable && (
            <div className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2 flex-1 min-w-[200px] max-w-sm border border-border">
              <Search size={14} className="text-muted" />
              <input type="text" value={search} onChange={e => handleSearchChange(e.target.value)} placeholder={searchPlaceholder}
                className="bg-transparent text-sm outline-none w-full placeholder-muted" aria-label="Search" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 bg-surface hover:bg-slate-50 text-slate-700 rounded-xl border border-border text-sm font-medium transition-colors"
              title="Print Table"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
            {filters}
          </div>
        </div>
      )}
      <div className="overflow-x-auto printable-area">
        <table className="w-full" role="table">
          <thead>
            <tr className="border-b border-border">
              {visibleCols.map(col => (
                <th key={col.key} onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  className={`px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted ${col.sortable ? 'cursor-pointer hover:text-fg select-none' : ''}`}>
                  <span className="flex items-center gap-1">{col.label}
                    {col.sortable && (sortKey === col.key ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />)}
                  </span>
                </th>
              ))}
              {actions && <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-muted">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.length === 0 ? (
              <tr><td colSpan={visibleCols.length + (actions ? 1 : 0)} className="px-5 py-16 text-center">
                {emptyIcon && <div className="mb-3 flex justify-center opacity-30">{emptyIcon}</div>}
                <p className="text-sm text-muted">{emptyMessage}</p>
              </td></tr>
            ) : paged.map((row, i) => (
              <tr key={row.id || i} onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-primary/[0.03]' : 'hover:bg-surface/50'}`}
                role={onRowClick ? 'button' : undefined} tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}>
                {visibleCols.map(col => (
                  <td key={col.key} className="px-5 py-3 text-sm">{col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}</td>
                ))}
                {actions && <td className="px-5 py-3 text-right">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted">Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg hover:bg-surface disabled:opacity-30" aria-label="Previous"><ChevronLeft size={15} /></button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = totalPages <= 5 ? i : page < 3 ? i : Math.min(page + i - 2, totalPages - 1);
              if (pg < 0 || pg >= totalPages) return null;
              return <button key={pg} onClick={() => setPage(pg)} className={`w-7 h-7 rounded-lg text-xs font-semibold ${pg === page ? 'bg-primary text-white' : 'hover:bg-surface'}`}>{pg + 1}</button>;
            })}
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg hover:bg-surface disabled:opacity-30" aria-label="Next"><ChevronRight size={15} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
