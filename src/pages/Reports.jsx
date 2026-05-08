import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import EditWorkOrderModal from '../components/EditWorkOrderModal';
import { Filter, RotateCcw, Search, Columns, Save, X } from 'lucide-react';

const FB_TAT = [10, 5, 4, 3, 2, 1];

const COLUMN_CONFIG = [
  { key: 'language', label: 'Language', defaultVisible: false },
  { key: 'wo_date', label: 'WO Date', defaultVisible: true },
  { key: 'work_order_number', label: 'Work Order #', defaultVisible: true },
  { key: 'region', label: 'Region', defaultVisible: true },
  { key: 'assigned_to', label: 'Assigned to', defaultVisible: false },
  { key: 'file_number', label: 'File Number', defaultVisible: true },
  { key: 'hearing_date', label: 'Hearing Date', defaultVisible: true },
  { key: 'division', label: 'Division', defaultVisible: true },
  { key: 'request_type', label: 'Request Type', defaultVisible: true },
  { key: 'tat', label: 'TAT', defaultVisible: true },
  { key: 'due_date', label: 'Due Date', defaultVisible: true },
  { key: 'audio_length', label: 'Audio Length', defaultVisible: true },
  { key: 'word_count', label: 'Word Count', defaultVisible: false },
  { key: 'character_wz_space', label: 'Character wz Space', defaultVisible: false },
  { key: 'line_count', label: 'Line Count', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: false },
  { key: 'delivery_date', label: 'Del Date', defaultVisible: false },
  { key: 'days_late', label: 'Days Late', defaultVisible: false },
  { key: 'employee_comments', label: 'Employee Comments', defaultVisible: false },
  { key: 'regdeck_admin_comments', label: 'RegDeck Admin Comments', defaultVisible: false },
  { key: 'additional_comments', label: 'Additional Comments', defaultVisible: false }
];

export default function Reports({ userRoles = [], user }) {
  const isEmployee = !userRoles.includes('admin') && !userRoles.includes('manager');
  const userName = user?.user_metadata?.full_name || '';
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [noResults, setNoResults] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Inline Editing State
  const [inlineEdits, setInlineEdits] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [tatValues, setTatValues] = useState(FB_TAT);

  // Column Visibility State
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef(null);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('invoicegen_visible_columns_v3');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return COLUMN_CONFIG.filter(col => col.defaultVisible).map(col => col.key);
  });

  useEffect(() => {
    localStorage.setItem('invoicegen_visible_columns_v2', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (colKey) => {
    setVisibleColumns(prev => 
      prev.includes(colKey) ? prev.filter(k => k !== colKey) : [...prev, colKey]
    );
  };

  // Filter options (populated from DB)
  const [languageOptions, setLanguageOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [requestTypeOptions, setRequestTypeOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);

  // Filter values
  const [filters, setFilters] = useState({
    language: '',
    region: '',
    assigned_to: '',
    division: '',
    request_type: '',
    due_date: '',
    work_order_number: '',
    file_number: '',
    hearing_date: '',
    delivery_date: '',
    status: ''
  });

  // Load filter options from reference tables + distinct values
  useEffect(() => {
    const loadFilterOptions = async () => {
      const { data: langData } = await supabase.from('ref_languages').select('code, label');
      if (langData?.length) setLanguageOptions(langData.map(l => ({ value: l.code, label: `${l.code} (${l.label})` })));

      const { data: regData } = await supabase.from('ref_regions').select('name');
      if (regData?.length) setRegionOptions(regData.map(r => r.name));

      const { data: divData } = await supabase.from('ref_divisions').select('name');
      if (divData?.length) setDivisionOptions(divData.map(d => d.name));

      const { data: rtData } = await supabase.from('ref_request_types').select('name');
      if (rtData?.length) setRequestTypeOptions(rtData.map(rt => rt.name));

      // Users from ref_users table
      const { data: userData } = await supabase.from('ref_users').select('name').order('name');
      if (userData?.length) {
        setUserOptions(userData.map(u => u.name));
      }

      // Statuses from ref_work_order_statuses table
      const { data: statusData } = await supabase.from('ref_work_order_statuses').select('name').order('name');
      if (statusData?.length) {
        setStatusOptions(statusData.map(s => s.name));
      }

      // TAT scores
      const { data: tatData } = await supabase.from('ref_tat_scores').select('value').order('value', { ascending: false });
      if (tatData?.length) setTatValues(tatData.map(t => t.value));

      // Holidays for days_late calculation
      const { data: holidayData } = await supabase.from('holidays').select('holiday_date');
      if (holidayData?.length) setHolidays(holidayData.map(h => h.holiday_date));
    };
    loadFilterOptions();
    fetchRecords();
  }, []);

  const fetchRecords = async (activeFilters = null) => {
    setLoading(true);
    setError(null);
    setNoResults(false);

    let query = supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters if provided
    const f = activeFilters || filters;
    if (f.language) query = query.eq('language', f.language);
    if (f.region) query = query.eq('region', f.region);
    if (f.assigned_to) query = query.eq('assigned_to', f.assigned_to);
    if (f.division) query = query.eq('division', f.division);
    if (f.request_type) query = query.eq('request_type', f.request_type);
    if (f.due_date) query = query.eq('due_date', f.due_date);
    if (f.hearing_date) query = query.eq('hearing_date', f.hearing_date);
    if (f.delivery_date) query = query.eq('delivery_date', f.delivery_date);
    if (f.status) query = query.eq('status', f.status);
    if (f.work_order_number) query = query.ilike('work_order_number', `%${f.work_order_number}%`);
    if (f.file_number) query = query.ilike('file_number', `%${f.file_number}%`);

    // Employee role: only show records assigned to them
    if (isEmployee && userName) {
      query = query.eq('assigned_to', userName);
    }

    const { data, error } = await query;

    if (error) {
      setError(error.message);
    } else if (!data || data.length === 0) {
      setRecords([]);
      setNoResults(true);
    } else {
      setRecords(data);
    }
    setLoading(false);
  };

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleApply = () => {
    fetchRecords(filters);
  };

  const handleReset = () => {
    const cleared = {
      language: '',
      region: '',
      assigned_to: '',
      division: '',
      request_type: '',
      due_date: '',
      work_order_number: '',
      file_number: '',
      hearing_date: '',
      delivery_date: '',
      status: ''
    };
    setFilters(cleared);
    setSearchTerm('');
    fetchRecords(cleared);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // ----- INLINE EDIT LOGIC -----
  const calculateBusinessDays = (startStr, endStr) => {
    if (!startStr || !endStr) return '';
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start) || isNaN(end)) return '';
    if (end <= start) return 0;
    
    let count = 0;
    let cur = new Date(start);
    cur.setDate(cur.getDate() + 1);
    
    while (cur <= end) {
      const day = cur.getDay();
      const isWeekend = day === 0 || day === 6;
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const curDateStr = `${y}-${m}-${d}`;
      const isHoliday = holidays.includes(curDateStr);

      if (!isWeekend && !isHoliday) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const toggleInlineEdit = (record) => {
    if (inlineEdits[record.id]) {
      // Discard draft
      const newEdits = { ...inlineEdits };
      delete newEdits[record.id];
      setInlineEdits(newEdits);
    } else {
      // Start editing
      setInlineEdits(prev => ({
        ...prev,
        [record.id]: {
          ...record,
          tat: record.tat || 5, // fallback
          status: record.status || 'Pending'
        }
      }));
    }
  };

  const handleInlineChange = (recordId, field, value) => {
    setInlineEdits(prev => {
      const draft = { ...prev[recordId], [field]: value };

      if (field === 'character_wz_space') {
        const chars = parseInt(value, 10);
        draft.line_count = !isNaN(chars) ? Math.floor(chars / 65) : '';
      }

      if (field === 'due_date' || field === 'delivery_date') {
        draft.days_late = calculateBusinessDays(draft.due_date, draft.delivery_date);
      }

      return { ...prev, [recordId]: draft };
    });
  };

  const handleBulkSave = async () => {
    setLoading(true);
    const updatePromises = Object.keys(inlineEdits).map(async (recordId) => {
      const draft = inlineEdits[recordId];
      const updatePayload = {
        language: draft.language,
        work_order_number: draft.work_order_number,
        region: draft.region,
        assigned_to: draft.assigned_to,
        file_number: draft.file_number || null,
        hearing_date: draft.hearing_date || null,
        division: draft.division,
        request_type: draft.request_type,
        tat: parseInt(draft.tat, 10),
        due_date: draft.due_date || null,
        audio_length: draft.audio_length || null,
        word_count: draft.word_count,
        character_wz_space: draft.character_wz_space,
        line_count: draft.line_count ? parseInt(draft.line_count, 10) : 0,
        status: draft.status,
        delivery_date: draft.delivery_date || null,
        employee_comments: draft.employee_comments || null,
        regdeck_admin_comments: draft.regdeck_admin_comments || null,
        additional_comments: draft.additional_comments || null,
        days_late: draft.days_late ? parseInt(draft.days_late, 10) : 0
      };

      return supabase.from('work_orders').update(updatePayload).eq('id', recordId);
    });

    try {
      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        setError(`Failed to update ${errors.length} record(s). Check console for details.`);
        console.error('Bulk save errors:', errors);
      } else {
        setInlineEdits({});
        fetchRecords(filters);
      }
    } catch (err) {
      setError('An unexpected error occurred during bulk save.');
    }
    setLoading(false);
  };
  // ----- END INLINE EDIT LOGIC -----

  // Helper to format DD-MMM
  const formatDdMmm = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    const isISODate = typeof dateStr === 'string' && dateStr.length === 10 && dateStr.includes('-');
    const day = isISODate ? d.getUTCDate() : d.getDate();
    const monthIndex = isISODate ? d.getUTCMonth() : d.getMonth();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[monthIndex]}`;
  };

  // Helper to format DD-MMM-YYYY
  const formatDdMmmYyyy = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    const isISODate = typeof dateStr === 'string' && dateStr.length === 10 && dateStr.includes('-');
    const day = isISODate ? d.getUTCDate() : d.getDate();
    const monthIndex = isISODate ? d.getUTCMonth() : d.getMonth();
    const year = isISODate ? d.getUTCFullYear() : d.getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[monthIndex]}-${year}`;
  };

  // Sort + search filtering
  const filteredAndSorted = useMemo(() => {
    let items = [...records];

    // Global search across all visible fields
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      items = items.filter(r => {
        const searchableValues = [
          r.language,
          r.wo_date ? formatDdMmm(r.wo_date) : '',
          r.work_order_number,
          r.file_number,
          r.region,
          r.assigned_to,
          r.division,
          r.request_type,
          r.tat != null ? String(r.tat) : '',
          r.hearing_date ? formatDdMmmYyyy(r.hearing_date) : '',
          r.due_date ? formatDdMmm(r.due_date) : '',
          r.delivery_date ? formatDdMmm(r.delivery_date) : '',
          r.audio_length,
          r.word_count != null ? String(r.word_count) : '',
          r.character_wz_space != null ? String(r.character_wz_space) : '',
          r.line_count != null ? String(r.line_count) : '',
          r.status,
          r.days_late != null ? String(r.days_late) : '',
          r.employee_comments,
          r.regdeck_admin_comments,
          r.additional_comments
        ];
        return searchableValues.some(v => v && v.toLowerCase().includes(term));
      });
    }

    // Sort
    items.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return items;
  }, [records, sortConfig, searchTerm]);

  const renderSortIcon = (columnName) => {
    if (sortConfig.key !== columnName) {
      return <span className="sort-icon invisible">↕</span>;
    }
    return sortConfig.direction === 'asc' ? <span className="sort-icon">↑</span> : <span className="sort-icon">↓</span>;
  };

  return (
    <div className="page-container">
      <h1 className="page-title">My Requests</h1>

      {/* ===== Filter Bar ===== */}
      <div className="filter-bar">
        <div className="filter-bar-header">
          <Filter size={16} />
          <span>Filters</span>
        </div>
        <div className="filter-fields">
          <div className="filter-group">
            <label className="filter-label">Language</label>
            <select name="language" className="filter-select" value={filters.language} onChange={handleFilterChange}>
              <option value="">All</option>
              {languageOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Region</label>
            <select name="region" className="filter-select" value={filters.region} onChange={handleFilterChange}>
              <option value="">All</option>
              {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Assigned To</label>
            <select name="assigned_to" className="filter-select" value={filters.assigned_to} onChange={handleFilterChange}>
              <option value="">All</option>
              {userOptions.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Division</label>
            <select name="division" className="filter-select" value={filters.division} onChange={handleFilterChange}>
              <option value="">All</option>
              {divisionOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Request Type</label>
            <select name="request_type" className="filter-select" value={filters.request_type} onChange={handleFilterChange}>
              <option value="">All</option>
              {requestTypeOptions.map(rt => <option key={rt} value={rt}>{rt}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Due Date</label>
            <input type="date" name="due_date" className="filter-select" value={filters.due_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">Hearing Date</label>
            <input type="date" name="hearing_date" className="filter-select" value={filters.hearing_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">Del Date</label>
            <input type="date" name="delivery_date" className="filter-select" value={filters.delivery_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select name="status" className="filter-select" value={filters.status} onChange={handleFilterChange}>
              <option value="">All</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Work Order #</label>
            <input type="text" name="work_order_number" className="filter-select" placeholder="Search WO#" value={filters.work_order_number} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">File #</label>
            <input type="text" name="file_number" className="filter-select" placeholder="Search File#" value={filters.file_number} onChange={handleFilterChange} />
          </div>
        </div>
        <div className="filter-actions">
          <button className="btn-filter-apply" onClick={handleApply}>Apply</button>
          <button className="btn-filter-reset" onClick={handleReset}>
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      {/* ===== Global Search & Columns ===== */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '250px' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search across all fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '38px', width: '100%' }}
            />
          </div>
        </div>

        {/* Bulk Action Buttons */}
        {Object.keys(inlineEdits).length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem' }}>
            <button className="btn-secondary" onClick={() => setInlineEdits({})} style={{ background: '#fef2f2', color: '#ef4444', borderColor: '#fecaca', display: 'flex', alignItems: 'center', padding: '0.6rem 1rem' }}>
              Cancel All
            </button>
            <button className="btn-primary" onClick={handleBulkSave} style={{ marginTop: 0, width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}>
              <Save size={16} /> Save {Object.keys(inlineEdits).length} Changes
            </button>
          </div>
        )}

        {/* Column Toggle Dropdown */}
        <div className="column-toggle-container" ref={columnMenuRef} style={{ position: 'relative' }}>
          <button 
            className="btn-secondary" 
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}
          >
            <Columns size={16} />
            Columns
          </button>
          
          {showColumnMenu && (
            <div className="column-dropdown-menu" style={{ 
              position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', 
              background: '#fff', border: '1px solid #e0e0ea', borderRadius: '10px', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)', zIndex: 100, minWidth: '220px',
              padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
              maxHeight: '400px', overflowY: 'auto'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5a5a72', marginBottom: '0.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f0f0f5' }}>
                Toggle Columns
              </div>
              {COLUMN_CONFIG.map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.includes(col.key)} 
                    onChange={() => toggleColumn(col.key)} 
                    style={{ accentColor: '#6366f1', cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== Data Table ===== */}
      <div className="content-card">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <p className="text-muted">Loading records...</p>
        ) : noResults ? (
          <div className="empty-state">
            <p className="no-results-msg">No records returned. Try searching with other criteria.</p>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <p className="text-muted">No records found. Create one to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-grid">
              <thead>
                <tr>
                  {visibleColumns.includes('language') && <th onClick={() => handleSort('language')} className="sortable-header">Language {renderSortIcon('language')}</th>}
                  {visibleColumns.includes('wo_date') && <th onClick={() => handleSort('wo_date')} className="sortable-header">WO Date {renderSortIcon('wo_date')}</th>}
                  {visibleColumns.includes('work_order_number') && <th onClick={() => handleSort('work_order_number')} className="sortable-header">Work Order # {renderSortIcon('work_order_number')}</th>}
                  {visibleColumns.includes('region') && <th onClick={() => handleSort('region')} className="sortable-header">Region {renderSortIcon('region')}</th>}
                  {visibleColumns.includes('assigned_to') && <th onClick={() => handleSort('assigned_to')} className="sortable-header">Assigned to {renderSortIcon('assigned_to')}</th>}
                  {visibleColumns.includes('file_number') && <th onClick={() => handleSort('file_number')} className="sortable-header">File Number {renderSortIcon('file_number')}</th>}
                  {visibleColumns.includes('hearing_date') && <th onClick={() => handleSort('hearing_date')} className="sortable-header">Hearing Date {renderSortIcon('hearing_date')}</th>}
                  {visibleColumns.includes('division') && <th onClick={() => handleSort('division')} className="sortable-header">Division {renderSortIcon('division')}</th>}
                  {visibleColumns.includes('request_type') && <th onClick={() => handleSort('request_type')} className="sortable-header">Request Type {renderSortIcon('request_type')}</th>}
                  {visibleColumns.includes('tat') && <th onClick={() => handleSort('tat')} className="sortable-header">TAT {renderSortIcon('tat')}</th>}
                  {visibleColumns.includes('due_date') && <th onClick={() => handleSort('due_date')} className="sortable-header">Due Date {renderSortIcon('due_date')}</th>}
                  {visibleColumns.includes('audio_length') && <th onClick={() => handleSort('audio_length')} className="sortable-header">Audio Length {renderSortIcon('audio_length')}</th>}
                  {visibleColumns.includes('word_count') && <th onClick={() => handleSort('word_count')} className="sortable-header">Word Count {renderSortIcon('word_count')}</th>}
                  {visibleColumns.includes('character_wz_space') && <th onClick={() => handleSort('character_wz_space')} className="sortable-header">Character wz Space {renderSortIcon('character_wz_space')}</th>}
                  {visibleColumns.includes('line_count') && <th onClick={() => handleSort('line_count')} className="sortable-header">Line Count {renderSortIcon('line_count')}</th>}
                  {visibleColumns.includes('status') && <th onClick={() => handleSort('status')} className="sortable-header">Status {renderSortIcon('status')}</th>}
                  {visibleColumns.includes('delivery_date') && <th onClick={() => handleSort('delivery_date')} className="sortable-header">Del Date {renderSortIcon('delivery_date')}</th>}
                  {visibleColumns.includes('days_late') && <th onClick={() => handleSort('days_late')} className="sortable-header">Days Late {renderSortIcon('days_late')}</th>}
                  {visibleColumns.includes('employee_comments') && <th onClick={() => handleSort('employee_comments')} className="sortable-header">Employee Comments {renderSortIcon('employee_comments')}</th>}
                  {visibleColumns.includes('regdeck_admin_comments') && <th onClick={() => handleSort('regdeck_admin_comments')} className="sortable-header">RegDeck Admin Comments {renderSortIcon('regdeck_admin_comments')}</th>}
                  {visibleColumns.includes('additional_comments') && <th onClick={() => handleSort('additional_comments')} className="sortable-header">Additional Comments {renderSortIcon('additional_comments')}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map(record => {
                  const isEditing = !!inlineEdits[record.id];
                  const draft = inlineEdits[record.id] || record;
                  const canEditAll = !isEmployee;

                  return (
                    <tr key={record.id} onClick={() => { if (!isEditing) toggleInlineEdit(record); }} style={{ cursor: isEditing ? 'default' : 'pointer', ...(isEditing ? { backgroundColor: 'rgba(99, 102, 241, 0.04)' } : {}) }}>
                      {visibleColumns.includes('language') && <td>
                        {isEditing && canEditAll ? (
                          <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '100px' }} value={draft.language} onChange={(e) => handleInlineChange(record.id, 'language', e.target.value)}>
                            {languageOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                          </select>
                        ) : (
                          record.language || '—'
                        )}
                      </td>}
                      {visibleColumns.includes('wo_date') && <td>{formatDdMmm(record.wo_date)}</td>}
                      {visibleColumns.includes('work_order_number') && <td>
                        {isEditing && canEditAll ? (
                          <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '120px' }} value={draft.work_order_number} onChange={(e) => handleInlineChange(record.id, 'work_order_number', e.target.value)} />
                        ) : (
                          record.work_order_number
                        )}
                      </td>}
                      {visibleColumns.includes('region') && <td>
                        {isEditing && canEditAll ? (
                          <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '100px' }} value={draft.region} onChange={(e) => handleInlineChange(record.id, 'region', e.target.value)}>
                            {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          record.region
                        )}
                      </td>}
                      {visibleColumns.includes('assigned_to') && <td>
                        {isEditing && canEditAll ? (
                          <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '110px' }} value={draft.assigned_to} onChange={(e) => handleInlineChange(record.id, 'assigned_to', e.target.value)}>
                            {userOptions.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        ) : (
                          record.assigned_to
                        )}
                      </td>}
                      {visibleColumns.includes('file_number') && <td>
                        {isEditing && canEditAll ? (
                          <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '100px' }} value={draft.file_number || ''} onChange={(e) => handleInlineChange(record.id, 'file_number', e.target.value)} />
                        ) : (
                          record.file_number || '—'
                        )}
                      </td>}
                      {visibleColumns.includes('hearing_date') && <td>
                        {isEditing && canEditAll ? (
                          <input type="date" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '130px' }} value={draft.hearing_date || ''} onChange={(e) => handleInlineChange(record.id, 'hearing_date', e.target.value)} />
                        ) : (
                          formatDdMmmYyyy(record.hearing_date)
                        )}
                      </td>}
                      {visibleColumns.includes('division') && <td>
                        {isEditing && canEditAll ? (
                          <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '80px' }} value={draft.division} onChange={(e) => handleInlineChange(record.id, 'division', e.target.value)}>
                            {divisionOptions.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        ) : (
                          record.division
                        )}
                      </td>}
                      {visibleColumns.includes('request_type') && <td>
                        {isEditing && canEditAll ? (
                          <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '90px' }} value={draft.request_type} onChange={(e) => handleInlineChange(record.id, 'request_type', e.target.value)}>
                            {requestTypeOptions.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                          </select>
                        ) : (
                          record.request_type
                        )}
                      </td>}
                      {visibleColumns.includes('tat') && <td>
                        {isEditing && canEditAll ? (
                          <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '60px' }} value={draft.tat} onChange={(e) => handleInlineChange(record.id, 'tat', e.target.value)}>
                            {tatValues.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : (
                          record.tat
                        )}
                      </td>}
                      {visibleColumns.includes('due_date') && <td>
                        {isEditing && canEditAll ? (
                          <input type="date" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '130px' }} value={draft.due_date || ''} onChange={(e) => handleInlineChange(record.id, 'due_date', e.target.value)} />
                        ) : (
                          formatDdMmm(record.due_date)
                        )}
                      </td>}
                      {visibleColumns.includes('audio_length') && <td>
                        {isEditing && canEditAll ? (
                          <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '80px' }} placeholder="0:15" value={draft.audio_length || ''} onChange={(e) => handleInlineChange(record.id, 'audio_length', e.target.value)} />
                        ) : (
                          record.audio_length || '—'
                        )}
                      </td>}
                      {visibleColumns.includes('word_count') && <td>
                        {isEditing && canEditAll ? (
                          <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '80px' }} value={draft.word_count || ''} onChange={(e) => handleInlineChange(record.id, 'word_count', e.target.value)} />
                        ) : (
                          record.word_count || ''
                        )}
                      </td>}
                      {visibleColumns.includes('character_wz_space') && <td>
                        {isEditing && canEditAll ? (
                          <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '100px' }} value={draft.character_wz_space || ''} onChange={(e) => handleInlineChange(record.id, 'character_wz_space', e.target.value)} />
                        ) : (
                          record.character_wz_space || ''
                        )}
                      </td>}
                      {visibleColumns.includes('line_count') && <td>{draft.line_count != null ? draft.line_count : (record.line_count || 0)}</td>}
                      {visibleColumns.includes('status') && <td>
                        {isEditing ? (
                          <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '120px' }} value={draft.status} onChange={(e) => handleInlineChange(record.id, 'status', e.target.value)}>
                            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={`status-badge ${record.status === 'Done' ? 'paid' : record.status === 'In progress' ? 'pending' : ''}`}>
                            {record.status || '—'}
                          </span>
                        )}
                      </td>}
                      {visibleColumns.includes('delivery_date') && <td>
                        {isEditing && canEditAll ? (
                          <input type="date" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '130px' }} value={draft.delivery_date || ''} onChange={(e) => handleInlineChange(record.id, 'delivery_date', e.target.value)} />
                        ) : (
                          formatDdMmm(record.delivery_date)
                        )}
                      </td>}
                      {visibleColumns.includes('days_late') && <td>{draft.days_late != null ? draft.days_late : (record.days_late || 0)}</td>}
                      {visibleColumns.includes('employee_comments') && <td>
                        {isEditing ? (
                          <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '150px' }} value={draft.employee_comments || ''} onChange={(e) => handleInlineChange(record.id, 'employee_comments', e.target.value)} />
                        ) : (
                          <div style={{ minWidth: '150px', maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{record.employee_comments || '—'}</div>
                        )}
                      </td>}
                      {visibleColumns.includes('regdeck_admin_comments') && <td>
                        {isEditing && canEditAll ? (
                          <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '150px' }} value={draft.regdeck_admin_comments || ''} onChange={(e) => handleInlineChange(record.id, 'regdeck_admin_comments', e.target.value)} />
                        ) : (
                          <div style={{ minWidth: '150px', maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{record.regdeck_admin_comments || '—'}</div>
                        )}
                      </td>}
                      {visibleColumns.includes('additional_comments') && <td>
                        {isEditing ? (
                          <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '150px' }} value={draft.additional_comments || ''} onChange={(e) => handleInlineChange(record.id, 'additional_comments', e.target.value)} />
                        ) : (
                          <div style={{ minWidth: '150px', maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{record.additional_comments || '—'}</div>
                        )}
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <EditWorkOrderModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={() => fetchRecords(filters)}
          userRoles={userRoles}
        />
      )}
    </div>
  );
}
