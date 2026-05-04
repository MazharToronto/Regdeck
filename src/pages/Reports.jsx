import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import EditWorkOrderModal from '../components/EditWorkOrderModal';
import { Filter, RotateCcw, Search } from 'lucide-react';

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

  // Helper to format MMDD
  const formatMmDd = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  };

  // Helper to format dates
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString();
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
          r.wo_date ? formatMmDd(r.wo_date) : '',
          r.work_order_number,
          r.file_number,
          r.region,
          r.assigned_to,
          r.division,
          r.request_type,
          r.tat != null ? String(r.tat) : '',
          r.hearing_date ? formatDate(r.hearing_date) : '',
          r.due_date ? formatDate(r.due_date) : '',
          r.delivery_date ? formatDate(r.delivery_date) : '',
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
            <label className="filter-label">Delivery Date</label>
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

      {/* ===== Global Search ===== */}
      <div className="search-bar" style={{ marginBottom: '1rem' }}>
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
                  <th onClick={() => handleSort('language')} className="sortable-header">Language {renderSortIcon('language')}</th>
                  <th onClick={() => handleSort('wo_date')} className="sortable-header">WO Date {renderSortIcon('wo_date')}</th>
                  <th onClick={() => handleSort('work_order_number')} className="sortable-header">Work Order # {renderSortIcon('work_order_number')}</th>
                  <th onClick={() => handleSort('file_number')} className="sortable-header">File # {renderSortIcon('file_number')}</th>
                  <th onClick={() => handleSort('region')} className="sortable-header">Region {renderSortIcon('region')}</th>
                  <th onClick={() => handleSort('assigned_to')} className="sortable-header">Assigned To {renderSortIcon('assigned_to')}</th>
                  <th onClick={() => handleSort('division')} className="sortable-header">Division {renderSortIcon('division')}</th>
                  <th onClick={() => handleSort('request_type')} className="sortable-header">Type {renderSortIcon('request_type')}</th>
                  <th onClick={() => handleSort('tat')} className="sortable-header">TAT {renderSortIcon('tat')}</th>
                  <th onClick={() => handleSort('hearing_date')} className="sortable-header">Hearing Date {renderSortIcon('hearing_date')}</th>
                  <th onClick={() => handleSort('due_date')} className="sortable-header">Due Date {renderSortIcon('due_date')}</th>
                  <th onClick={() => handleSort('delivery_date')} className="sortable-header">Delivery Date {renderSortIcon('delivery_date')}</th>
                  <th onClick={() => handleSort('audio_length')} className="sortable-header">Audio Len {renderSortIcon('audio_length')}</th>
                  <th onClick={() => handleSort('word_count')} className="sortable-header">Words {renderSortIcon('word_count')}</th>
                  <th onClick={() => handleSort('character_wz_space')} className="sortable-header">Chars {renderSortIcon('character_wz_space')}</th>
                  <th onClick={() => handleSort('line_count')} className="sortable-header">Lines {renderSortIcon('line_count')}</th>
                  <th onClick={() => handleSort('status')} className="sortable-header">Status {renderSortIcon('status')}</th>
                  <th onClick={() => handleSort('days_late')} className="sortable-header">Days Late {renderSortIcon('days_late')}</th>
                  <th onClick={() => handleSort('employee_comments')} className="sortable-header">Employee Comments {renderSortIcon('employee_comments')}</th>
                  <th onClick={() => handleSort('regdeck_admin_comments')} className="sortable-header">Admin Comments {renderSortIcon('regdeck_admin_comments')}</th>
                  <th onClick={() => handleSort('additional_comments')} className="sortable-header">Additional Comments {renderSortIcon('additional_comments')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map(record => (
                  <tr key={record.id}>
                    <td>{record.language || '—'}</td>
                    <td>{formatMmDd(record.wo_date)}</td>
                    <td>
                      <button
                        className="link-btn"
                        onClick={() => setEditingRecord(record)}
                        title="Click to edit"
                      >
                        {record.work_order_number}
                      </button>
                    </td>
                    <td>{record.file_number || '—'}</td>
                    <td>{record.region}</td>
                    <td>{record.assigned_to}</td>
                    <td>{record.division}</td>
                    <td>{record.request_type}</td>
                    <td>{record.tat}</td>
                    <td>{formatDate(record.hearing_date)}</td>
                    <td>{formatDate(record.due_date)}</td>
                    <td>{formatDate(record.delivery_date)}</td>
                    <td>{record.audio_length || '—'}</td>
                    <td>{record.word_count || 0}</td>
                    <td>{record.character_wz_space || 0}</td>
                    <td>{record.line_count || 0}</td>
                    <td>
                      <span className={`status-badge ${record.status === 'Done' ? 'paid' : record.status === 'In progress' ? 'pending' : ''}`}>
                        {record.status || '—'}
                      </span>
                    </td>
                    <td>{record.days_late || 0}</td>
                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.employee_comments || ''}>{record.employee_comments || '—'}</td>
                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.regdeck_admin_comments || ''}>{record.regdeck_admin_comments || '—'}</td>
                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.additional_comments || ''}>{record.additional_comments || '—'}</td>
                  </tr>
                ))}
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
