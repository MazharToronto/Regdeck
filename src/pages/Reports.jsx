import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import EditWorkOrderModal from '../components/EditWorkOrderModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { Filter, RotateCcw, Search, Columns, Save, X, Trash2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  { key: 'word_count', label: 'Word Count', defaultVisible: true },
  { key: 'character_wz_space', label: 'Character wz Space', defaultVisible: true },
  { key: 'line_count', label: 'Line Count', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
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
  const [sortConfig, setSortConfig] = useState({ key: 'wo_date', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [recordToDelete, setRecordToDelete] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const ROWS_PER_PAGE_OPTIONS = [25, 50, 100, 200];
  
  // Inline Editing State
  const [inlineEdits, setInlineEdits] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [tatValues, setTatValues] = useState(FB_TAT);
  const [referenceRates, setReferenceRates] = useState([]);

  // Column Visibility State
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef(null);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('invoicegen_visible_columns_v4');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return COLUMN_CONFIG.filter(col => col.defaultVisible).map(col => col.key);
  });

  // Column Ordering State (Session Only)
  const [orderedColumns, setOrderedColumns] = useState(() => {
    return COLUMN_CONFIG.map(col => col.key);
  });
  const [draggedColumn, setDraggedColumn] = useState(null);

  const handleDragStart = (e, colKey) => {
    setDraggedColumn(colKey);
    // Needed for Firefox
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', colKey);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetColKey) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColKey) return;
    
    setOrderedColumns(prev => {
      const draggedIdx = prev.indexOf(draggedColumn);
      const targetIdx = prev.indexOf(targetColKey);
      if (draggedIdx === -1 || targetIdx === -1) return prev;
      
      const newOrder = [...prev];
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedColumn);
      return newOrder;
    });
    setDraggedColumn(null);
  };

  useEffect(() => {
    localStorage.setItem('invoicegen_visible_columns_v4', JSON.stringify(visibleColumns));
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
    from_due_date: '',
    to_due_date: '',
    work_order_number: '',
    file_number: '',
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

      // Reference rates for late deduction and total amount calculation
      const { data: ratesData } = await supabase.from('reference_rate').select('language, tat, rate_per_word');
      if (ratesData?.length) setReferenceRates(ratesData);
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
      .order('wo_date', { ascending: false })
      .limit(10000);

    // Apply filters if provided
    const f = activeFilters || filters;
    if (f.language) query = query.eq('language', f.language);
    if (f.region) query = query.eq('region', f.region);
    if (f.assigned_to && !isEmployee) query = query.eq('assigned_to', f.assigned_to);
    if (f.from_due_date) query = query.gte('due_date', f.from_due_date);
    if (f.to_due_date) query = query.lte('due_date', f.to_due_date);
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
    setCurrentPage(1);
    fetchRecords(filters);
  };

  const handleReset = () => {
    const cleared = {
      language: '',
      region: '',
      assigned_to: '',
      from_due_date: '',
      to_due_date: '',
      work_order_number: '',
      file_number: '',
      delivery_date: '',
      status: ''
    };
    setFilters(cleared);
    setSearchTerm('');
    setCurrentPage(1);
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
    if (!draft) return; // Nothing to save

    const cleanWordCount = draft.word_count ? String(draft.word_count).replace(/,/g, '') : '';
    const wordCountParsed = parseInt(cleanWordCount, 10);
    
    const cleanCharSpace = draft.character_wz_space ? String(draft.character_wz_space).replace(/,/g, '') : '';
    const charSpaceParsed = parseInt(cleanCharSpace, 10);

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
      word_count: !isNaN(wordCountParsed) ? wordCountParsed : null,
      character_wz_space: !isNaN(charSpaceParsed) ? charSpaceParsed : null,
      line_count: draft.line_count ? parseInt(draft.line_count, 10) : 0,
      status: draft.status,
      delivery_date: draft.delivery_date || null,
      employee_comments: draft.employee_comments || null,
      regdeck_admin_comments: draft.regdeck_admin_comments || null,
      additional_comments: draft.additional_comments || null,
      days_late: draft.days_late ? parseInt(draft.days_late, 10) : 0,
      late_deduction_amount: draft.late_deduction_amount != null ? draft.late_deduction_amount : 0,
      total_amount: draft.total_amount != null ? draft.total_amount : 0
    };

    try {
      const { data, error } = await supabase.from('work_orders').update(updatePayload).eq('id', recordId).select();
      if (error) {
        console.error('Save error:', error);
        setError(`Failed to save record ${recordId}. Check console for details.`);
      } else if (data && data.length > 0) {
        // Update local records state immediately
        setRecords(prev => prev.map(rec => rec.id === recordId ? data[0] : rec));
        // Remove from inlineEdits
        setInlineEdits(prev => {
          const next = { ...prev };
          delete next[recordId];
          return next;
        });
      }
    } catch (err) {
      console.error('Unexpected error during auto-save:', err);
      setError('An unexpected error occurred during auto-save.');
    }
  };

  const handleDeleteRecord = (recordId, e) => {
    e.stopPropagation(); // prevent entering edit mode
    setRecordToDelete(recordId);
  };
  
  const confirmDelete = async () => {
    if (!recordToDelete) return;
    setLoading(true);
    const { data, error } = await supabase.from('work_orders').delete().eq('id', recordToDelete).select();
    
    if (error) {
      console.error("Delete Error: ", error);
      setError('Failed to delete record: ' + error.message);
    } else if (!data || data.length === 0) {
      console.warn("Delete affected 0 rows for ID: ", recordToDelete);
      setError('Delete failed: You may not have permission, or the record no longer exists.');
    } else {
      setRecords(prev => prev.filter(r => r.id !== recordToDelete));
      setInlineEdits(prev => {
        const next = { ...prev };
        delete next[recordToDelete];
        return next;
      });
    }
    setRecordToDelete(null);
    setLoading(false);
  };
  // ----- END INLINE EDIT LOGIC -----

  const handleExportExcel = () => {
    const exportColumns = COLUMN_CONFIG.filter(col => visibleColumns.includes(col.key));
    
    const exportData = filteredAndSorted.map(record => {
      const rowData = {};
      exportColumns.forEach(col => {
        if (col.key === 'wo_date') {
          rowData[col.label] = formatDdMmm(record.wo_date);
        } else if (col.key === 'due_date' || col.key === 'delivery_date') {
          rowData[col.label] = formatDdMmm(record[col.key]);
        } else if (col.key === 'hearing_date') {
          rowData[col.label] = formatDdMmmYyyy(record[col.key]);
        } else if (col.key === 'word_count' || col.key === 'character_wz_space' || col.key === 'line_count') {
          rowData[col.label] = record[col.key] != null ? Number(record[col.key]).toLocaleString('en-US') : '';
        } else {
          rowData[col.label] = record[col.key] != null ? record[col.key] : '';
        }
      });
      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "My Requests");
    XLSX.writeFile(workbook, "My_Requests_Export.xlsx");
  };

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

  // Pagination computed values
  const totalRecords = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedRecords = filteredAndSorted.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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

  const renderSortIcon = (columnName) => {
    if (sortConfig.key !== columnName) {
      return <span className="sort-icon invisible">↕</span>;
    }
    return sortConfig.direction === 'asc' ? <span className="sort-icon">↑</span> : <span className="sort-icon">↓</span>;
  };

  const renderCell = (colKey, record, draft, isEditing, canEditAll) => {
    switch (colKey) {
      case 'language': return (isEditing && canEditAll ? <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '100px' }} value={draft.language} onChange={(e) => handleInlineChange(record.id, 'language', e.target.value)}>{languageOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select> : record.language || '—');
      case 'wo_date': return formatDdMmm(record.wo_date);
      case 'work_order_number': return (isEditing && canEditAll ? <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '120px' }} value={draft.work_order_number} onChange={(e) => handleInlineChange(record.id, 'work_order_number', e.target.value)} /> : record.work_order_number);
      case 'region': return (isEditing && canEditAll ? <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '100px' }} value={draft.region} onChange={(e) => handleInlineChange(record.id, 'region', e.target.value)}>{regionOptions.map(r => <option key={r} value={r}>{r}</option>)}</select> : record.region);
      case 'assigned_to': return (isEditing && canEditAll ? <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '110px' }} value={draft.assigned_to} onChange={(e) => handleInlineChange(record.id, 'assigned_to', e.target.value)}>{userOptions.map(u => <option key={u} value={u}>{u}</option>)}</select> : record.assigned_to);
      case 'file_number': return (isEditing && canEditAll ? <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '100px' }} value={draft.file_number || ''} onChange={(e) => handleInlineChange(record.id, 'file_number', e.target.value)} /> : record.file_number || '—');
      case 'hearing_date': return (isEditing && canEditAll ? <input type="date" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '130px' }} value={draft.hearing_date || ''} onChange={(e) => handleInlineChange(record.id, 'hearing_date', e.target.value)} /> : formatDdMmmYyyy(record.hearing_date));
      case 'division': return (isEditing && canEditAll ? <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '80px' }} value={draft.division} onChange={(e) => handleInlineChange(record.id, 'division', e.target.value)}>{divisionOptions.map(d => <option key={d} value={d}>{d}</option>)}</select> : record.division);
      case 'request_type': return (isEditing && canEditAll ? <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '90px' }} value={draft.request_type} onChange={(e) => handleInlineChange(record.id, 'request_type', e.target.value)}>{requestTypeOptions.map(rt => <option key={rt} value={rt}>{rt}</option>)}</select> : record.request_type);
      case 'tat': return (isEditing && canEditAll ? <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '60px' }} value={draft.tat} onChange={(e) => handleInlineChange(record.id, 'tat', e.target.value)}>{tatValues.map(t => <option key={t} value={t}>{t}</option>)}</select> : record.tat);
      case 'due_date': return (isEditing && canEditAll ? <input type="date" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '130px' }} value={draft.due_date || ''} onChange={(e) => handleInlineChange(record.id, 'due_date', e.target.value)} /> : formatDdMmm(record.due_date));
      case 'audio_length': return (isEditing && canEditAll ? <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '80px' }} placeholder="0:15" value={draft.audio_length || ''} onChange={(e) => handleInlineChange(record.id, 'audio_length', e.target.value)} /> : record.audio_length || '—');
      case 'word_count': return (isEditing && canEditAll ? <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '80px' }} value={draft.word_count || ''} onChange={(e) => handleInlineChange(record.id, 'word_count', e.target.value)} /> : record.word_count != null ? Number(record.word_count).toLocaleString() : '');
      case 'character_wz_space': return (isEditing && canEditAll ? <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '100px' }} value={draft.character_wz_space || ''} onChange={(e) => handleInlineChange(record.id, 'character_wz_space', e.target.value)} /> : record.character_wz_space != null ? Number(record.character_wz_space).toLocaleString() : '');
      case 'line_count': return Number(draft.line_count != null ? draft.line_count : (record.line_count || 0)).toLocaleString();
      case 'status': return (isEditing ? <select className="form-select" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '120px' }} value={draft.status} onChange={(e) => handleInlineChange(record.id, 'status', e.target.value)}>{statusOptions.map(s => <option key={s} value={s}>{s}</option>)}</select> : <span className={`status-badge ${record.status === 'Done' ? 'paid' : record.status === 'In progress' ? 'pending' : ''}`}>{record.status || '—'}</span>);
      case 'delivery_date': return (isEditing && canEditAll ? <input type="date" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '130px' }} value={draft.delivery_date || ''} onChange={(e) => handleInlineChange(record.id, 'delivery_date', e.target.value)} /> : formatDdMmm(record.delivery_date));
      case 'days_late': return draft.days_late != null ? draft.days_late : (record.days_late || 0);
      case 'employee_comments': return (isEditing ? <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '150px' }} value={draft.employee_comments || ''} onChange={(e) => handleInlineChange(record.id, 'employee_comments', e.target.value)} /> : <div style={{ minWidth: '150px', maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{record.employee_comments || '—'}</div>);
      case 'regdeck_admin_comments': return (isEditing && canEditAll ? <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '150px' }} value={draft.regdeck_admin_comments || ''} onChange={(e) => handleInlineChange(record.id, 'regdeck_admin_comments', e.target.value)} /> : <div style={{ minWidth: '150px', maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{record.regdeck_admin_comments || '—'}</div>);
      case 'additional_comments': return (isEditing ? <input type="text" className="form-input" style={{ padding: '0.25rem', fontSize: '0.8rem', minWidth: '150px' }} value={draft.additional_comments || ''} onChange={(e) => handleInlineChange(record.id, 'additional_comments', e.target.value)} /> : <div style={{ minWidth: '150px', maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{record.additional_comments || '—'}</div>);
      default: return null;
    }
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
            <label className="filter-label">From Due Date</label>
            <input type="date" name="from_due_date" className="filter-select" value={filters.from_due_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">To Due Date</label>
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

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Export Button */}
          <button 
            className="btn-primary" 
            onClick={handleExportExcel}
            style={{ width: 'auto', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: '#10b981', borderColor: '#10b981' }}
            title="Export Visible Columns to Excel"
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
                  <th style={{ width: '30px', padding: 0 }}></th>
                  {orderedColumns.filter(col => visibleColumns.includes(col)).map(colKey => {
                    const colConfig = COLUMN_CONFIG.find(c => c.key === colKey);
                    return (
                      <th 
                        key={colKey}
                        draggable
                        onDragStart={(e) => handleDragStart(e, colKey)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, colKey)}
                        onClick={() => handleSort(colKey)}
                        className="sortable-header"
                        style={{ cursor: 'move' }}
                        title="Drag to reorder"
                      >
                        {colConfig?.label} {renderSortIcon(colKey)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map(record => {
                  const isEditing = !!inlineEdits[record.id];
                  const draft = inlineEdits[record.id] || record;
                  const canEditAll = !isEmployee;

                  return (
                    <tr 
                      key={record.id} 
                      onClick={() => { if (!isEditing) toggleInlineEdit(record); }} 
                      onBlur={(e) => {
                        if (isEditing && !e.currentTarget.contains(e.relatedTarget)) {
                          handleRowSave(record.id);
                        }
                      }}
                      style={{ cursor: isEditing ? 'default' : 'pointer', ...(isEditing ? { backgroundColor: 'rgba(99, 102, 241, 0.04)' } : {}) }}
                    >
                      <td className="row-action-delete" onClick={(e) => e.stopPropagation()}>
                        {canEditAll && (
                          <button 
                            className="row-delete-btn" 
                            onClick={(e) => handleDeleteRecord(record.id, e)}
                            title="Delete Record"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                      {orderedColumns.filter(col => visibleColumns.includes(col)).map(colKey => (
                        <td key={colKey}>
                          {renderCell(colKey, record, draft, isEditing, canEditAll)}
                        </td>
                      ))}
                    </tr>
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

      <DeleteConfirmationModal 
        isOpen={!!recordToDelete}
        onClose={() => setRecordToDelete(null)}
        onConfirm={confirmDelete}
        message="Are you sure you want to delete this?"
      />
    </div>
  );
}
