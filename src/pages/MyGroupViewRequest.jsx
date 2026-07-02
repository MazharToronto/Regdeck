import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Filter, RotateCcw, Search, Download, ChevronRight, ChevronDown, Columns, Trash2 } from 'lucide-react';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import * as XLSX from 'xlsx';

const FB_TAT = [10, 5, 4, 3, 2, 1];

// Child row columns config
const CHILD_COLUMN_CONFIG = [
  { key: 'file_number', label: 'File Number', defaultVisible: true },
  { key: 'hearing_date', label: 'Hearing Date', defaultVisible: true },
  { key: 'division', label: 'Division', defaultVisible: true },
  { key: 'request_type', label: 'Request Type', defaultVisible: true },
  { key: 'audio_length', label: 'Audio Length', defaultVisible: true },
  { key: 'word_count', label: 'Word Count', defaultVisible: true },
  { key: 'character_wz_space', label: 'Character wz Space', defaultVisible: true },
  { key: 'line_count', label: 'Line Count', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: false },
  { key: 'delivery_date', label: 'Del Date', defaultVisible: false },
  { key: 'days_late', label: 'Days Late', defaultVisible: false },
  { key: 'employee_comments', label: 'Employee Comments', defaultVisible: false },
  { key: 'regdeck_admin_comments', label: 'RegDeck Admin Comments', defaultVisible: false },
  { key: 'additional_comments', label: 'Additional Comments', defaultVisible: false }
];

// Utility to calculate total audio length
const calculateTotalAudioLength = (children) => {
  let totalSeconds = 0;
  children.forEach(child => {
    if (!child.audio_length) return;
    const parts = child.audio_length.toString().split(':');
    if (parts.length === 3) {
      // HH:MM:SS
      totalSeconds += parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    } else if (parts.length === 2) {
      // MM:SS
      totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 1) {
      // M
      totalSeconds += parseInt(parts[0]) * 60;
    }
  });

  if (totalSeconds === 0) return '—';

  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function MyGroupViewRequest({ userRoles = [], user }) {
  const isEmployee = !userRoles.includes('admin') && !userRoles.includes('manager');
  const canEditAll = !isEmployee;
  const userName = user?.user_metadata?.full_name || '';
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noResults, setNoResults] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [recordToDelete, setRecordToDelete] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const ROWS_PER_PAGE_OPTIONS = [25, 50, 100, 200];

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Inline Editing State
  const [inlineEdits, setInlineEdits] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [tatValues, setTatValues] = useState(FB_TAT);
  const [referenceRates, setReferenceRates] = useState([]);

  // Column Visibility State
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef(null);
  const [visibleChildColumns, setVisibleChildColumns] = useState(() => {
    const saved = localStorage.getItem('invoicegen_group_child_cols_v1');
    if (saved) { try { return JSON.parse(saved); } catch (e) { /* ignore */ } }
    return CHILD_COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key);
  });

  useEffect(() => {
    localStorage.setItem('invoicegen_group_child_cols_v1', JSON.stringify(visibleChildColumns));
  }, [visibleChildColumns]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target)) setShowColumnMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (colKey) => {
    setVisibleChildColumns(prev => prev.includes(colKey) ? prev.filter(k => k !== colKey) : [...prev, colKey]);
  };

  // Parent Column Ordering State (Session Only)
  const [orderedParentColumns, setOrderedParentColumns] = useState([
    'wo_date', 'work_order_number', 'region', 'tat', 'due_date', 'total_audio_length'
  ]);
  const [draggedParentColumn, setDraggedParentColumn] = useState(null);

  // Child Column Ordering State (Session Only)
  const [orderedChildColumns, setOrderedChildColumns] = useState(() => {
    return CHILD_COLUMN_CONFIG.map(col => col.key);
  });
  const [draggedChildColumn, setDraggedChildColumn] = useState(null);

  // Parent Drag/Drop Handlers
  const handleParentDragStart = (e, colKey) => {
    setDraggedParentColumn(colKey);
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', colKey); }
  };
  const handleParentDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };
  const handleParentDrop = (e, targetColKey) => {
    e.preventDefault();
    if (!draggedParentColumn || draggedParentColumn === targetColKey) return;
    setOrderedParentColumns(prev => {
      const draggedIdx = prev.indexOf(draggedParentColumn);
      const targetIdx = prev.indexOf(targetColKey);
      if (draggedIdx === -1 || targetIdx === -1) return prev;
      const newOrder = [...prev];
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedParentColumn);
      return newOrder;
    });
    setDraggedParentColumn(null);
  };

  // Child Drag/Drop Handlers
  const handleChildDragStart = (e, colKey) => {
    setDraggedChildColumn(colKey);
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', colKey); }
  };
  const handleChildDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };
  const handleChildDrop = (e, targetColKey) => {
    e.preventDefault();
    if (!draggedChildColumn || draggedChildColumn === targetColKey) return;
    setOrderedChildColumns(prev => {
      const draggedIdx = prev.indexOf(draggedChildColumn);
      const targetIdx = prev.indexOf(targetColKey);
      if (draggedIdx === -1 || targetIdx === -1) return prev;
      const newOrder = [...prev];
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedChildColumn);
      return newOrder;
    });
    setDraggedChildColumn(null);
  };

  // Filter options (populated from DB)
  const [languageOptions, setLanguageOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [requestTypeOptions, setRequestTypeOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);

  // Filter values — default From/To Due to current month range
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
    return {
      language: '',
      region: '',
      assigned_to: '',
      from_due_date: firstDay,
      to_due_date: lastDay,
      work_order_number: '',
      file_number: '',
      delivery_date: '',
      status: ''
    };
  });

  // Load filter options from reference tables
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

      const { data: userData } = await supabase.from('ref_users').select('name').order('name');
      if (userData?.length) setUserOptions(userData.map(u => u.name));

      const { data: statusData } = await supabase.from('ref_work_order_statuses').select('name').order('name');
      if (statusData?.length) setStatusOptions(statusData.map(s => s.name));

      const { data: tatData } = await supabase.from('ref_tat_scores').select('value').order('value', { ascending: false });
      if (tatData?.length) setTatValues(tatData.map(t => t.value));

      const { data: holidayData } = await supabase.from('holidays').select('holiday_date');
      if (holidayData?.length) setHolidays(holidayData.map(h => h.holiday_date));

      // Reference rates for late deduction and total amount calculation
      const { data: ratesData } = await supabase.from('reference_rate').select('language, tat, rate_per_word');
      if (ratesData?.length) setReferenceRates(ratesData);
    };
    loadFilterOptions();
  }, []);

  const fetchRecords = async (activeFilters = null, targetPage = currentPage, targetRowsPerPage = rowsPerPage, targetSortConfig = sortConfig, searchVal = debouncedSearchTerm) => {
    setLoading(true);
    setError(null);
    setNoResults(false);

    const f = activeFilters || filters;
    const start = (targetPage - 1) * targetRowsPerPage;
    const end = start + targetRowsPerPage - 1;

    let query = supabase
      .from('work_orders')
      .select('*', { count: 'exact' })
      .order(targetSortConfig.key, { ascending: targetSortConfig.direction === 'asc' })
      .range(start, end);

    if (f.language) query = query.eq('language', f.language);
    if (f.region) query = query.eq('region', f.region);
    if (f.assigned_to && !isEmployee) query = query.eq('assigned_to', f.assigned_to);
    if (f.from_due_date) query = query.gte('due_date', f.from_due_date);
    if (f.to_due_date) query = query.lte('due_date', f.to_due_date);
    if (f.delivery_date) query = query.eq('delivery_date', f.delivery_date);
    if (f.status) query = query.eq('status', f.status);
    if (f.work_order_number) query = query.ilike('work_order_number', `%${f.work_order_number}%`);
    if (f.file_number) query = query.ilike('file_number', `%${f.file_number}%`);

    if (isEmployee && userName) {
      query = query.eq('assigned_to', userName);
    }

    // Like search across selected string columns
    const cleanSearch = searchVal.trim();
    if (cleanSearch) {
      const conditions = [
        `work_order_number.ilike.%${cleanSearch}%`,
        `file_number.ilike.%${cleanSearch}%`,
        `assigned_to.ilike.%${cleanSearch}%`,
        `region.ilike.%${cleanSearch}%`,
        `division.ilike.%${cleanSearch}%`,
        `request_type.ilike.%${cleanSearch}%`,
        `status.ilike.%${cleanSearch}%`,
        `employee_comments.ilike.%${cleanSearch}%`,
        `regdeck_admin_comments.ilike.%${cleanSearch}%`,
        `additional_comments.ilike.%${cleanSearch}%`
      ];
      query = query.or(conditions.join(','));
    }

    const { data, error: fetchError, count } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setRecords([]);
      setTotalRecords(0);
    } else {
      setRecords(data || []);
      setTotalRecords(count || 0);
      if (!data || data.length === 0) {
        setNoResults(true);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords(filters, currentPage, rowsPerPage, sortConfig, debouncedSearchTerm);
  }, [currentPage, rowsPerPage, sortConfig, debouncedSearchTerm]);

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleApply = () => {
    if (currentPage === 1) {
      fetchRecords(filters, 1, rowsPerPage, sortConfig, debouncedSearchTerm);
    } else {
      setCurrentPage(1);
    }
  };

  const handleReset = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
    const cleared = {
      language: '',
      region: '',
      assigned_to: '',
      from_due_date: firstDay,
      to_due_date: lastDay,
      work_order_number: '',
      file_number: '',
      delivery_date: '',
      status: ''
    };
    setFilters(cleared);
    setSearchTerm('');
    if (currentPage === 1) {
      fetchRecords(cleared, 1, rowsPerPage, sortConfig, '');
    } else {
      setCurrentPage(1);
    }
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
      const dd = String(cur.getDate()).padStart(2, '0');
      const curDateStr = `${y}-${m}-${dd}`;
      const isHoliday = holidays.includes(curDateStr);
      if (!isWeekend && !isHoliday) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const toggleInlineEdit = (record) => {
    if (inlineEdits[record.id]) {
      const newEdits = { ...inlineEdits };
      delete newEdits[record.id];
      setInlineEdits(newEdits);
    } else {
      setInlineEdits(prev => ({
        ...prev,
        [record.id]: { ...record, tat: record.tat || 5, status: record.status || 'Pending' }
      }));
    }
  };

  const handleInlineChange = (recordId, field, value) => {
    setInlineEdits(prev => {
      const draft = { ...prev[recordId], [field]: value };
      if (field === 'character_wz_space') {
        const cleanValue = typeof value === 'string' ? value.replace(/,/g, '') : value;
        const chars = parseInt(cleanValue, 10);
        draft.line_count = !isNaN(chars) ? Math.round(chars / 65) : '';
      }
      if (field === 'due_date' || field === 'delivery_date') {
        draft.days_late = calculateBusinessDays(draft.due_date, draft.delivery_date);

        // Calculate late_deduction_amount and total_amount
        const wordCount = parseInt(String(draft.word_count || '0').replace(/,/g, ''), 10) || 0;
        const daysLate = parseInt(draft.days_late, 10) || 0;
        const matchingRate = referenceRates.find(r => r.language === draft.language && String(r.tat) === String(draft.tat));
        const ratePerWord = matchingRate ? parseFloat(matchingRate.rate_per_word) : 0;

        const lateDeduction = daysLate > 0 ? parseFloat((wordCount * ratePerWord * 0.05 * daysLate).toFixed(2)) : 0;
        const totalAmount = parseFloat(((ratePerWord * wordCount) - lateDeduction).toFixed(2));

        draft.late_deduction_amount = lateDeduction;
        draft.total_amount = totalAmount;
      }
      return { ...prev, [recordId]: draft };
    });
  };

  const handleRowSave = async (recordId) => {
    const draft = inlineEdits[recordId];
    if (!draft) return;
    const cleanWordCount = draft.word_count ? String(draft.word_count).replace(/,/g, '') : '';
    const wordCountParsed = parseInt(cleanWordCount, 10);
    const cleanCharSpace = draft.character_wz_space ? String(draft.character_wz_space).replace(/,/g, '') : '';
    const charSpaceParsed = parseInt(cleanCharSpace, 10);
    const updatePayload = {
      language: draft.language, work_order_number: draft.work_order_number, region: draft.region,
      assigned_to: draft.assigned_to, file_number: draft.file_number || null,
      hearing_date: draft.hearing_date || null, division: draft.division,
      request_type: draft.request_type, tat: parseInt(draft.tat, 10),
      due_date: draft.due_date || null, audio_length: draft.audio_length || null,
      word_count: !isNaN(wordCountParsed) ? wordCountParsed : null,
      character_wz_space: !isNaN(charSpaceParsed) ? charSpaceParsed : null,
      line_count: draft.line_count ? parseInt(draft.line_count, 10) : 0,
      status: draft.status, delivery_date: draft.delivery_date || null,
      employee_comments: draft.employee_comments || null,
      regdeck_admin_comments: draft.regdeck_admin_comments || null,
      additional_comments: draft.additional_comments || null,
      days_late: draft.days_late ? parseInt(draft.days_late, 10) : 0,
      late_deduction_amount: draft.late_deduction_amount != null ? draft.late_deduction_amount : 0,
      total_amount: draft.total_amount != null ? draft.total_amount : 0
    };
    try {
      const { data, error } = await supabase.from('work_orders').update(updatePayload).eq('id', recordId).select();
      if (error) { setError(`Failed to save record.`); }
      else if (data && data.length > 0) {
        setRecords(prev => prev.map(rec => rec.id === recordId ? data[0] : rec));
        setInlineEdits(prev => { const next = { ...prev }; delete next[recordId]; return next; });
      }
    } catch (err) { setError('An unexpected error occurred during auto-save.'); }
  };

  const handleDeleteRecord = (recordId, e) => {
    e.stopPropagation();
    setRecordToDelete(recordId);
  };
  
  const confirmDelete = async () => {
    if (!recordToDelete) return;
    setLoading(true);
    const { data, error } = await supabase.from('work_orders').delete().eq('id', recordToDelete).select();
    if (error) { setError('Failed to delete record: ' + error.message); }
    else if (!data || data.length === 0) { setError('Delete failed: You may not have permission.'); }
    else {
      setRecords(prev => prev.filter(r => r.id !== recordToDelete));
      setInlineEdits(prev => { const next = { ...prev }; delete next[recordToDelete]; return next; });
    }
    setRecordToDelete(null);
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

  // Pagination computed values
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + records.length, totalRecords);

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  // Generate page numbers to display (with ellipsis logic)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      if (safeCurrentPage > 3) {
        pages.push('...');
      }
      
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (safeCurrentPage < totalPages - 2) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  // Filter & search, then group by work_order_number
  const groupedData = useMemo(() => {
    let items = [...records];

    // Group by work_order_number
    const groups = {};
    items.forEach(record => {
      const key = record.work_order_number || 'Unknown';
      if (!groups[key]) {
        groups[key] = {
          work_order_number: record.work_order_number,
          wo_date: record.wo_date,
          region: record.region,
          tat: record.tat,
          due_date: record.due_date,
          assigned_to: record.assigned_to,
          children: []
        };
      }
      groups[key].children.push(record);
    });

    // Convert to array and sort
    let groupArray = Object.values(groups);
    groupArray.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return groupArray;
  }, [records, sortConfig]);

  // Duplicate detection: work_order_number + file_number + hearing_date
  const duplicateIds = useMemo(() => {
    const seen = new Map();
    const dupes = new Set();
    records.forEach(record => {
      const wo = (record.work_order_number || '').trim().toLowerCase();
      const fn = (record.file_number || '').trim().toLowerCase();
      const hd = (record.hearing_date || '').trim();
      const key = `${wo}|${fn}|${hd}`;
      if (seen.has(key)) {
        dupes.add(record.id);
      } else {
        seen.set(key, record.id);
      }
    });
    return dupes;
  }, [records]);

  const toggleGroup = (woNumber) => {
    setExpandedGroups(prev => ({
      ...prev,
      [woNumber]: !prev[woNumber]
    }));
  };

  const renderSortIcon = (columnName) => {
    if (sortConfig.key !== columnName) {
      return <span className="sort-icon invisible">↕</span>;
    }
    return sortConfig.direction === 'asc' ? <span className="sort-icon">↑</span> : <span className="sort-icon">↓</span>;
  };

  // Export
  const handleExportExcel = async () => {
    setLoading(true);
    let allExportData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    let fetchError = null;

    const f = filters;

    while (hasMore) {
      const start = page * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from('work_orders')
        .select('*')
        .order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
        .range(start, end);

      if (f.language) query = query.eq('language', f.language);
      if (f.region) query = query.eq('region', f.region);
      if (f.assigned_to && !isEmployee) query = query.eq('assigned_to', f.assigned_to);
      if (f.from_due_date) query = query.gte('due_date', f.from_due_date);
      if (f.to_due_date) query = query.lte('due_date', f.to_due_date);
      if (f.delivery_date) query = query.eq('delivery_date', f.delivery_date);
      if (f.status) query = query.eq('status', f.status);
      if (f.work_order_number) query = query.ilike('work_order_number', `%${f.work_order_number}%`);
      if (f.file_number) query = query.ilike('file_number', `%${f.file_number}%`);

      if (isEmployee && userName) {
        query = query.eq('assigned_to', userName);
      }

      const cleanSearch = debouncedSearchTerm.trim();
      if (cleanSearch) {
        const conditions = [
          `work_order_number.ilike.%${cleanSearch}%`,
          `file_number.ilike.%${cleanSearch}%`,
          `assigned_to.ilike.%${cleanSearch}%`,
          `region.ilike.%${cleanSearch}%`,
          `division.ilike.%${cleanSearch}%`,
          `request_type.ilike.%${cleanSearch}%`,
          `status.ilike.%${cleanSearch}%`,
          `employee_comments.ilike.%${cleanSearch}%`,
          `regdeck_admin_comments.ilike.%${cleanSearch}%`,
          `additional_comments.ilike.%${cleanSearch}%`
        ];
        query = query.or(conditions.join(','));
      }

      const { data, error } = await query;
      if (error) {
        fetchError = error;
        break;
      }

      if (data && data.length > 0) {
        allExportData = allExportData.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    setLoading(false);

    if (fetchError) {
      setError('Export failed: ' + fetchError.message);
      return;
    }

    // Group the retrieved records
    const groups = {};
    allExportData.forEach(record => {
      const key = record.work_order_number || 'Unknown';
      if (!groups[key]) {
        groups[key] = {
          work_order_number: record.work_order_number,
          wo_date: record.wo_date,
          region: record.region,
          tat: record.tat,
          due_date: record.due_date,
          assigned_to: record.assigned_to,
          children: []
        };
      }
      groups[key].children.push(record);
    });

    let groupArray = Object.values(groups);
    groupArray.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    const exportData = [];
    groupArray.forEach(group => {
      group.children.forEach(child => {
        exportData.push({
          'WO Date': formatDdMmm(child.wo_date),
          'Work Order #': child.work_order_number,
          'Region': child.region,
          'TAT': child.tat,
          'Due': formatDdMmm(child.due_date),
          'File Number': child.file_number || '',
          'Hearing Date': formatDdMmmYyyy(child.hearing_date),
          'Division': child.division || '',
          'Request Type': child.request_type || '',
          'Audio Length': child.audio_length || '',
          'Word Count': child.word_count != null ? Number(child.word_count).toLocaleString('en-US') : '',
          'Character wz Space': child.character_wz_space != null ? Number(child.character_wz_space).toLocaleString('en-US') : '',
          'Line Count': child.line_count != null ? Number(child.line_count).toLocaleString('en-US') : ''
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Group View");
    XLSX.writeFile(workbook, "Group_View_Export.xlsx");
  };

  const renderParentCell = (colKey, group) => {
    switch (colKey) {
      case 'wo_date': return formatDdMmm(group.wo_date);
      case 'work_order_number': return (
        <>
          <span style={{ color: '#6366f1' }}>{group.work_order_number}</span>
          <span style={{ marginLeft: '0.5rem', background: '#eef2ff', color: '#6366f1', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500 }}>
            {group.children.length} file{group.children.length !== 1 ? 's' : ''}
          </span>
        </>
      );
      case 'region': return group.region;
      case 'tat': return group.tat;
      case 'due_date': return formatDdMmm(group.due_date);
      case 'total_audio_length': return calculateTotalAudioLength(group.children);
      default: return null;
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">My Group View Request</h1>

      {error && <div className="error-banner">{error}</div>}

      {/* ===== Filter Bar ===== */}
      <div className="filter-bar">
        <div className="filter-bar-header">
          <Filter size={16} />
          <span>Filters</span>
        </div>
        <div className="filter-fields" style={{ gap: '1.5rem' }}>
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
          {!isEmployee && (
            <div className="filter-group">
              <label className="filter-label">Assigned To</label>
              <select name="assigned_to" className="filter-select" value={filters.assigned_to} onChange={handleFilterChange}>
                <option value="">All</option>
                {userOptions.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}
          <div className="filter-group">
            <label className="filter-label">From Due</label>
            <input type="date" name="from_due_date" className="filter-select" value={filters.from_due_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">To Due</label>
            <input type="date" name="to_due_date" className="filter-select" value={filters.to_due_date} onChange={handleFilterChange} />
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

      {/* ===== Global Search & Export ===== */}
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

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className="btn-primary" 
            onClick={handleExportExcel}
            style={{ width: 'auto', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: '#10b981', borderColor: '#10b981' }}
            title="Export to Excel"
          >
            <Download size={16} />
            Export
          </button>

          {/* Rows Per Page Dropdown */}
          <div className="rows-per-page-container">
            <label className="rows-per-page-label">Rows</label>
            <select
              className="rows-per-page-select"
              value={rowsPerPage}
              onChange={handleRowsPerPageChange}
            >
              {ROWS_PER_PAGE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

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
                  Toggle Child Columns
                </div>
                {CHILD_COLUMN_CONFIG.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={visibleChildColumns.includes(col.key)} 
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
      </div>

      {/* ===== Summary ===== */}
      <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
        Showing <strong>{groupedData.length}</strong> work order group{groupedData.length !== 1 ? 's' : ''} ({totalRecords} total matching records)
      </div>

      {/* ===== Main Table ===== */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading...</div>
      ) : noResults ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No records found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-grid">
            <thead>
              <tr>
                <th style={{ width: '40px', padding: '0.75rem 0.25rem' }}></th>
                {orderedParentColumns.map(colKey => {
                  const labels = {
                    'wo_date': 'WO Date',
                    'work_order_number': 'Work Order #',
                    'region': 'Region',
                    'tat': 'TAT',
                    'due_date': 'Due',
                    'total_audio_length': 'Total Audio Length'
                  };
                  return (
                    <th 
                      key={colKey}
                      draggable
                      onDragStart={(e) => handleParentDragStart(e, colKey)}
                      onDragOver={handleParentDragOver}
                      onDrop={(e) => handleParentDrop(e, colKey)}
                      onClick={() => handleSort(colKey)} 
                      className="sortable-header"
                      style={{ cursor: 'move' }}
                      title="Drag to reorder"
                    >
                      {labels[colKey]} {renderSortIcon(colKey)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {groupedData.map(group => {
                const isExpanded = !!expandedGroups[group.work_order_number];
                return (
                  <React.Fragment key={group.work_order_number}>
                    {/* Parent Row */}
                    <tr 
                      key={group.work_order_number}
                      onClick={() => toggleGroup(group.work_order_number)}
                      style={{ 
                        cursor: 'pointer', 
                        backgroundColor: isExpanded ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                        fontWeight: 600,
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <td style={{ textAlign: 'center', padding: '0.75rem 0.25rem' }}>
                        {isExpanded 
                          ? <ChevronDown size={18} style={{ color: '#6366f1' }} /> 
                          : <ChevronRight size={18} style={{ color: '#94a3b8' }} />
                        }
                      </td>
                      {orderedParentColumns.map(colKey => (
                        <td key={colKey}>{renderParentCell(colKey, group)}</td>
                      ))}
                    </tr>

                    {/* Child Rows */}
                    {isExpanded && (
                      <tr key={`${group.work_order_number}_children`}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ 
                            margin: '0 0 0.5rem 2.5rem', 
                            borderLeft: '3px solid #6366f1',
                            borderRadius: '0 8px 8px 0',
                            overflow: 'hidden',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                          }}>
                            <table className="data-grid" style={{ marginBottom: 0, tableLayout: 'fixed', width: '100%' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f8fafc' }}>
                                  <th style={{ width: '30px', padding: 0 }}></th>
                                  {orderedChildColumns.filter(c => visibleChildColumns.includes(c)).map(colKey => {
                                    const col = CHILD_COLUMN_CONFIG.find(c => c.key === colKey);
                                    if (!col) return null;
                                    const widthMap = {
                                      file_number: '130px', hearing_date: '110px', division: '80px',
                                      request_type: '90px', audio_length: '90px', word_count: '90px',
                                      character_wz_space: '110px', line_count: '80px', status: '90px',
                                      delivery_date: '90px', days_late: '70px',
                                      employee_comments: '150px', regdeck_admin_comments: '150px', additional_comments: '150px'
                                    };
                                    return (
                                      <th 
                                        key={col.key} 
                                        draggable
                                        onDragStart={(e) => handleChildDragStart(e, col.key)}
                                        onDragOver={handleChildDragOver}
                                        onDrop={(e) => handleChildDrop(e, col.key)}
                                        style={{ fontSize: '0.7rem', padding: '0.5rem 0.75rem', width: widthMap[col.key] || '100px', whiteSpace: 'normal', wordBreak: 'break-word', cursor: 'move' }}
                                        title="Drag to reorder"
                                      >
                                        {col.label}
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {group.children.map(child => {
                                  const isEditing = !!inlineEdits[child.id];
                                  const draft = inlineEdits[child.id] || child;
                                  const tdStyle = { padding: '0.5rem 0.75rem', fontSize: '0.85rem', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' };
                                  const inputStyle = { padding: '0.25rem', fontSize: '0.8rem', minWidth: '80px' };

                                  const renderCell = (colKey) => {
                                    if (isEditing && canEditAll) {
                                      if (colKey === 'file_number') return <input type="text" className="form-input" style={inputStyle} value={draft.file_number || ''} onChange={(e) => handleInlineChange(child.id, 'file_number', e.target.value)} />;
                                      if (colKey === 'hearing_date') return <input type="date" className="form-input" style={inputStyle} value={draft.hearing_date || ''} onChange={(e) => handleInlineChange(child.id, 'hearing_date', e.target.value)} />;
                                      if (colKey === 'division') return <select className="form-select" style={inputStyle} value={draft.division} onChange={(e) => handleInlineChange(child.id, 'division', e.target.value)}>{divisionOptions.map(d => <option key={d} value={d}>{d}</option>)}</select>;
                                      if (colKey === 'request_type') return <select className="form-select" style={inputStyle} value={draft.request_type} onChange={(e) => handleInlineChange(child.id, 'request_type', e.target.value)}>{requestTypeOptions.map(rt => <option key={rt} value={rt}>{rt}</option>)}</select>;
                                      if (colKey === 'audio_length') return <input type="text" className="form-input" style={inputStyle} value={draft.audio_length || ''} onChange={(e) => handleInlineChange(child.id, 'audio_length', e.target.value)} />;
                                      if (colKey === 'word_count') return <input type="text" className="form-input" style={inputStyle} value={draft.word_count || ''} onChange={(e) => handleInlineChange(child.id, 'word_count', e.target.value)} />;
                                      if (colKey === 'character_wz_space') return <input type="text" className="form-input" style={inputStyle} value={draft.character_wz_space || ''} onChange={(e) => handleInlineChange(child.id, 'character_wz_space', e.target.value)} />;
                                      if (colKey === 'line_count') return <span>{Number(draft.line_count != null ? draft.line_count : (child.line_count || 0)).toLocaleString()}</span>;
                                      if (colKey === 'status') return <select className="form-select" style={inputStyle} value={draft.status} onChange={(e) => handleInlineChange(child.id, 'status', e.target.value)}>{statusOptions.map(s => <option key={s} value={s}>{s}</option>)}</select>;
                                      if (colKey === 'delivery_date') return <input type="date" className="form-input" style={inputStyle} value={draft.delivery_date || ''} onChange={(e) => handleInlineChange(child.id, 'delivery_date', e.target.value)} />;
                                      if (colKey === 'days_late') return <span>{draft.days_late != null ? draft.days_late : (child.days_late || 0)}</span>;
                                      if (colKey === 'employee_comments') return <input type="text" className="form-input" style={{...inputStyle, minWidth: '150px'}} value={draft.employee_comments || ''} onChange={(e) => handleInlineChange(child.id, 'employee_comments', e.target.value)} />;
                                      if (colKey === 'regdeck_admin_comments') return <input type="text" className="form-input" style={{...inputStyle, minWidth: '150px'}} value={draft.regdeck_admin_comments || ''} onChange={(e) => handleInlineChange(child.id, 'regdeck_admin_comments', e.target.value)} />;
                                      if (colKey === 'additional_comments') return <input type="text" className="form-input" style={{...inputStyle, minWidth: '150px'}} value={draft.additional_comments || ''} onChange={(e) => handleInlineChange(child.id, 'additional_comments', e.target.value)} />;
                                    }
                                    // Employee-specific: allow editing word_count and character_wz_space
                                    if (isEditing && isEmployee) {
                                      if (colKey === 'word_count') return <input type="text" className="form-input" style={inputStyle} value={draft.word_count || ''} onChange={(e) => handleInlineChange(child.id, 'word_count', e.target.value)} />;
                                      if (colKey === 'character_wz_space') return <input type="text" className="form-input" style={inputStyle} value={draft.character_wz_space || ''} onChange={(e) => handleInlineChange(child.id, 'character_wz_space', e.target.value)} />;
                                      if (colKey === 'line_count') return <span>{Number(draft.line_count != null ? draft.line_count : (child.line_count || 0)).toLocaleString()}</span>;
                                    }
                                    // Read-only display
                                    if (colKey === 'hearing_date') return formatDdMmmYyyy(child.hearing_date);
                                    if (colKey === 'line_count') return Number(child.line_count || 0).toLocaleString();
                                    if (colKey === 'word_count') return child.word_count != null ? Number(child.word_count).toLocaleString() : '';
                                    if (colKey === 'character_wz_space') return child.character_wz_space != null ? Number(child.character_wz_space).toLocaleString() : '';
                                    if (colKey === 'delivery_date') return formatDdMmm(child.delivery_date);
                                    if (colKey === 'status') return <span className={`status-badge ${child.status === 'Done' ? 'paid' : child.status === 'In Process' ? 'pending' : ''}`}>{child.status || '—'}</span>;
                                    if (['employee_comments', 'regdeck_admin_comments', 'additional_comments'].includes(colKey)) return <div style={{ minWidth: '150px', maxWidth: '250px' }}>{child[colKey] || '—'}</div>;
                                    
                                    return child[colKey] || '—';
                                  };

                                  const daysLateVal = parseInt(child.days_late, 10);
                                  const isLate = !isNaN(daysLateVal) && daysLateVal !== 0 && daysLateVal !== 1;
                                  const isDuplicate = duplicateIds.has(child.id);

                                  let rowClass = '';
                                  if (isEditing) {
                                    rowClass = 'row-editing';
                                  } else if (isDuplicate) {
                                    rowClass = 'row-duplicate';
                                  } else if (isLate) {
                                    rowClass = 'row-days-late';
                                  }

                                  return (
                                    <tr 
                                      key={child.id} 
                                      className={rowClass}
                                      style={{ cursor: isEditing ? 'default' : 'pointer' }}
                                      onClick={(e) => {
                                        if (!isEditing && !e.target.closest('button')) toggleInlineEdit(child);
                                      }}
                                      onBlur={(e) => {
                                        if (isEditing && !e.currentTarget.contains(e.relatedTarget)) {
                                          handleRowSave(child.id);
                                        }
                                      }}
                                    >
                                      <td className="row-action-delete" style={{ padding: '0.5rem', textAlign: 'center', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                                        {canEditAll && (
                                          <button 
                                            className="row-delete-btn" 
                                            onClick={(e) => handleDeleteRecord(child.id, e)}
                                            title="Delete Record"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        )}
                                      </td>
                                      {orderedChildColumns.filter(c => visibleChildColumns.includes(c)).map(colKey => (
                                        <td key={colKey} style={tdStyle}>{renderCell(colKey)}</td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalRecords > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {startIndex + 1}–{Math.min(endIndex, totalRecords)} of {totalRecords} records
              </div>
              <div className="pagination-nav">
                <button
                  className="pagination-btn pagination-prev"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                >
                  ‹ Prev
                </button>
                {getPageNumbers().map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="pagination-ellipsis">…</span>
                  ) : (
                    <a
                      key={page}
                      href="#"
                      className={`pagination-link ${page === safeCurrentPage ? 'active' : ''}`}
                      onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}
                    >
                      {page}
                    </a>
                  )
                ))}
                <button
                  className="pagination-btn pagination-next"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <DeleteConfirmationModal 
        isOpen={!!recordToDelete}
        onClose={() => setRecordToDelete(null)}
        onConfirm={confirmDelete}
        message="Are you sure you want to delete this?"
      />
    </div>
  );
}
