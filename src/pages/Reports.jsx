import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import EditWorkOrderModal from '../components/EditWorkOrderModal';
import { Filter, RotateCcw } from 'lucide-react';

export default function Reports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [noResults, setNoResults] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

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
    delivery_status: ''
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

      // Users from user_profiles view
      const { data: userData } = await supabase.from('user_profiles').select('full_name, email');
      if (userData?.length) {
        setUserOptions(userData.map(u => u.full_name || u.email));
      }

      // Delivery status: static since we know them
      setStatusOptions(['On Time', 'Late']);
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
    if (f.delivery_status) query = query.eq('delivery_status', f.delivery_status);

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
      delivery_status: ''
    };
    setFilters(cleared);
    fetchRecords(cleared);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRecords = useMemo(() => {
    let sortableItems = [...records];
    sortableItems.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [records, sortConfig]);

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
            <label className="filter-label">Status</label>
            <select name="delivery_status" className="filter-select" value={filters.delivery_status} onChange={handleFilterChange}>
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
                  <th onClick={() => handleSort('wo_id')} className="sortable-header">WO ID {renderSortIcon('wo_id')}</th>
                  <th onClick={() => handleSort('work_order_number')} className="sortable-header">Work Order # {renderSortIcon('work_order_number')}</th>
                  <th onClick={() => handleSort('region')} className="sortable-header">Region {renderSortIcon('region')}</th>
                  <th onClick={() => handleSort('assigned_to')} className="sortable-header">Assigned To {renderSortIcon('assigned_to')}</th>
                  <th onClick={() => handleSort('division')} className="sortable-header">Division {renderSortIcon('division')}</th>
                  <th onClick={() => handleSort('request_type')} className="sortable-header">Request Type {renderSortIcon('request_type')}</th>
                  <th onClick={() => handleSort('tat')} className="sortable-header">TAT {renderSortIcon('tat')}</th>
                  <th onClick={() => handleSort('hearing_date')} className="sortable-header">Hearing Date {renderSortIcon('hearing_date')}</th>
                  <th onClick={() => handleSort('due_date')} className="sortable-header">Due Date {renderSortIcon('due_date')}</th>
                  <th onClick={() => handleSort('audio_length')} className="sortable-header">Audio Length {renderSortIcon('audio_length')}</th>
                  <th onClick={() => handleSort('delivery_status')} className="sortable-header">Delivery Status {renderSortIcon('delivery_status')}</th>
                  <th onClick={() => handleSort('days_late')} className="sortable-header">Days Late {renderSortIcon('days_late')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map(record => (
                  <tr key={record.id}>
                    <td>{record.language || '—'}</td>
                    <td>{record.wo_id || '—'}</td>
                    <td>
                      <button
                        className="link-btn"
                        onClick={() => setEditingRecord(record)}
                        title="Click to edit"
                      >
                        {record.work_order_number}
                      </button>
                    </td>
                    <td>{record.region}</td>
                    <td>{record.assigned_to}</td>
                    <td>{record.division}</td>
                    <td>{record.request_type}</td>
                    <td>{record.tat}</td>
                    <td>{record.hearing_date ? new Date(record.hearing_date).toLocaleDateString() : '—'}</td>
                    <td>{record.due_date || '—'}</td>
                    <td>{record.audio_length || '—'}</td>
                    <td>
                      <span className={`status-badge ${record.delivery_status === 'On Time' ? 'paid' : record.delivery_status === 'Late' ? 'overdue' : ''}`}>
                        {record.delivery_status || '—'}
                      </span>
                    </td>
                    <td>{record.days_late || 0}</td>
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
        />
      )}
    </div>
  );
}
