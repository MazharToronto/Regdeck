import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronDown, ChevronUp, FileText, CheckCircle, Clock, AlertCircle, Filter, RotateCcw } from 'lucide-react';

// Pill class helpers
const getRegionPillClass = (region) => {
  const map = { 'Eastern': 'reg-eastern', 'Central': 'reg-central', 'Western': 'reg-western', 'Rexdale': 'reg-rexdale' };
  return map[region] || '';
};
const getDivisionPillClass = (div) => {
  const map = { 'RAD': 'div-rad', 'RPD': 'div-rpd', 'ID': 'div-id', 'IAD': 'div-iad' };
  return map[div] || '';
};
const getEmployeePillClass = (name) => {
  if (!name) return 'emp-0';
  const knownMap = {
    'Sylvia': 'e-sylvia', 'Eugene': 'e-eugene', 'Virginie': 'e-virginie',
    'Christian': 'e-christian', 'Laurel': 'e-laurel', 'Jean': 'e-jean',
    'Adib': 'e-adib', 'Nathalie': 'e-nathalie', 'Daurha': 'e-daurha',
    'Laurie': 'e-laurie', 'Jeanne': 'e-jeanne', 'Ahalm': 'e-ahalm'
  };
  const firstName = name.split(' ')[0];
  if (knownMap[firstName]) return knownMap[firstName];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  return `emp-${Math.abs(hash) % 12}`;
};

export default function CreativeGroupedView({ userRoles = [], user }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [userOptions, setUserOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState(['Done', 'In Process', 'Pending']);
  const [updatingId, setUpdatingId] = useState(null);

  const isEmployee = !userRoles.includes('admin') && !userRoles.includes('manager');
  const [resolvedUserName, setResolvedUserName] = useState(user?.user_metadata?.full_name || '');

  // Robustly resolve full name from metadata or ref_users
  useEffect(() => {
    const resolveName = async () => {
      if (user?.user_metadata?.full_name) {
        setResolvedUserName(user.user_metadata.full_name);
      } else if (user?.id) {
        const { data } = await supabase.from('ref_users').select('name').eq('user_id', user.id).maybeSingle();
        if (data?.name) {
          setResolvedUserName(data.name);
        }
      }
    };
    resolveName();
  }, [user]);

  // Load status options from ref_work_order_statuses
  useEffect(() => {
    const loadStatuses = async () => {
      const { data } = await supabase.from('ref_work_order_statuses').select('name').order('name');
      if (data?.length) {
        const names = data.map(s => s.name).filter(Boolean);
        const defaults = ['Done', 'In Process', 'Pending'];
        const combined = Array.from(new Set([...defaults, ...names]));
        setStatusOptions(combined);
      }
    };
    loadStatuses();
  }, []);

  // Filter values — default From/To Due to current month range
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
    return {
      assigned_to: '',
      from_wo_date: '',
      to_wo_date: '',
      from_due_date: firstDay,
      to_due_date: lastDay,
      work_order_number: ''
    };
  });

  // Load ref_users options for admin/manager
  useEffect(() => {
    const loadUsers = async () => {
      const { data } = await supabase.from('ref_users').select('name').order('name');
      if (data?.length) {
        setUserOptions(data.map(u => u.name));
      }
    };
    if (!isEmployee) {
      loadUsers();
    }
  }, [isEmployee]);

  useEffect(() => {
    if (isEmployee && !resolvedUserName) return;
    fetchRecords(filters, resolvedUserName);
  }, [resolvedUserName, isEmployee]);

  const fetchRecords = async (activeFilters = null, currentUserName = resolvedUserName) => {
    setLoading(true);
    setError(null);
    
    if (isEmployee && !currentUserName) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const f = activeFilters || filters;
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    let fetchError = null;

    while (hasMore) {
      const start = page * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from('work_orders')
        .select('*')
        .order('due_date', { ascending: true })
        .order('work_order_number', { ascending: true })
        .range(start, end);

      if (isEmployee) {
        query = query.eq('assigned_to', currentUserName);
      } else if (f.assigned_to) {
        query = query.eq('assigned_to', f.assigned_to);
      }

      if (f.from_wo_date) query = query.gte('wo_date', f.from_wo_date);
      if (f.to_wo_date) query = query.lte('wo_date', f.to_wo_date);
      if (f.from_due_date) query = query.gte('due_date', f.from_due_date);
      if (f.to_due_date) query = query.lte('due_date', f.to_due_date);
      if (f.work_order_number) query = query.ilike('work_order_number', `%${f.work_order_number}%`);

      const { data, error } = await query;

      if (error) {
        fetchError = error;
        break;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRecords(allData);
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
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
    const cleared = {
      assigned_to: '',
      from_wo_date: '',
      to_wo_date: '',
      from_due_date: firstDay,
      to_due_date: lastDay,
      work_order_number: ''
    };
    setFilters(cleared);
    fetchRecords(cleared);
  };

  const toggleExpandCard = (compositeKey) => {
    setExpandedCards(prev => ({
      ...prev,
      [compositeKey]: prev[compositeKey] === false ? true : false
    }));
  };

  const handleStatusChange = async (card, newStatus) => {
    if (!newStatus || newStatus === card.status) return;

    setUpdatingId(card.id);
    setError(null);

    try {
      const subIds = (card.subRecords || []).map(r => r.id).filter(Boolean);
      const woNumber = card.work_order_number;

      // Update all corresponding records in Supabase
      let query = supabase.from('work_orders').update({ status: newStatus });
      if (subIds.length > 0) {
        query = query.in('id', subIds);
      } else if (woNumber) {
        query = query.eq('work_order_number', woNumber);
      }

      const { error: updateError } = await query;
      if (updateError) throw updateError;

      // Optimistically update local state so UI updates instantly
      setRecords(prevRecords =>
        prevRecords.map(rec => {
          if (subIds.includes(rec.id) || (woNumber && rec.work_order_number === woNumber)) {
            return { ...rec, status: newStatus };
          }
          return rec;
        })
      );
    } catch (err) {
      console.error('Error updating status:', err);
      setError(`Failed to update status for ${card.work_order_number}: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDdMmm = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const isISODate = typeof dateStr === 'string' && dateStr.length === 10 && dateStr.includes('-');
    const day = isISODate ? d.getUTCDate() : d.getDate();
    const monthIndex = isISODate ? d.getUTCMonth() : d.getMonth();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[monthIndex]}`;
  };

  const sumAudioLengths = (lengths) => {
    let totalSeconds = 0;
    lengths.forEach(len => {
      if (!len) return;
      const parts = String(len).split(':').map(n => parseInt(n, 10));
      if (parts.some(isNaN)) return;
      if (parts.length === 2) {
        totalSeconds += parts[0] * 3600 + parts[1] * 60;
      } else if (parts.length === 3) {
        totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 1) {
        totalSeconds += parts[0] * 3600;
      }
    });
    if (totalSeconds === 0) return '—';
    const totalM = Math.floor(totalSeconds / 60);
    const h = Math.floor(totalM / 60);
    const m = totalM % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  // Group records and combine identical work orders
  const groupedData = useMemo(() => {
    const groups = {};
    
    records.forEach(record => {
      const wo = record.work_order_number || '—';
      const st = record.status || '—';
      const rt = record.request_type || '—';
      const dd = record.due_date || 'Unassigned';
      const compositeKey = `${dd}|${wo}|${st}|${rt}`;
      
      if (!groups[compositeKey]) {
        groups[compositeKey] = {
          id: compositeKey,
          work_order_number: record.work_order_number,
          status: record.status,
          request_type: record.request_type,
          due_date: record.due_date,
          region: record.region,
          division: record.division,
          assigned_to: record.assigned_to,
          audio_lengths: [],
          subRecords: [],
          count: 0
        };
      }
      groups[compositeKey].audio_lengths.push(record.audio_length);
      groups[compositeKey].subRecords.push(record);
      groups[compositeKey].count += 1;
    });

    const finalGroups = Object.values(groups).map(item => ({
      ...item,
      audio_length: sumAudioLengths(item.audio_lengths)
    }));
    
    finalGroups.sort((a, b) => {
      if (a.due_date !== b.due_date) {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (!a.work_order_number) return 1;
      if (!b.work_order_number) return -1;
      return a.work_order_number.localeCompare(b.work_order_number);
    });
    
    return finalGroups;
  }, [records]);

  const totalAudioSum = useMemo(() => {
    if (groupedData.length === 0) return '00:00';
    const allLengths = groupedData.map(card => card.audio_length);
    return sumAudioLengths(allLengths);
  }, [groupedData]);

  // Counts
  const doneCount = useMemo(() => groupedData.filter(c => c.status === 'Done').length, [groupedData]);
  const inProgressCount = useMemo(() => groupedData.filter(c => c.status === 'In Process').length, [groupedData]);
  const pendingCount = useMemo(() => groupedData.filter(c => c.status !== 'Done' && c.status !== 'In Process').length, [groupedData]);

  // Get status card class
  const getStatusCardClass = (status) => {
    if (status === 'Done') return 'st-is-done';
    if (status === 'In Process') return 'st-is-prog';
    return 'st-is-pend';
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'Done') return 'st-badge-done';
    if (status === 'In Process') return 'st-badge-prog';
    return 'st-badge-pend';
  };

  const StatusIcon = ({ status, size = 10 }) => {
    if (status === 'Done') return <CheckCircle size={size} />;
    if (status === 'In Process') return <Clock size={size} />;
    return <AlertCircle size={size} />;
  };

  return (
    <div className="page-container" style={{ paddingBottom: '3rem' }}>
      <h1 className="page-title">Work Order Board</h1>

      {/* ===== Filter Bar ===== */}
      <div className="filter-bar">
        <div className="filter-bar-header">
          <Filter size={14} />
          <span>Filters</span>
        </div>
        <div className="filter-fields">
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
            <label className="filter-label">From WO</label>
            <input type="date" name="from_wo_date" className="filter-select" value={filters.from_wo_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">To WO</label>
            <input type="date" name="to_wo_date" className="filter-select" value={filters.to_wo_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">From Due</label>
            <input type="date" name="from_due_date" className="filter-select" value={filters.from_due_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">To Due</label>
            <input type="date" name="to_due_date" className="filter-select" value={filters.to_due_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">Work Order #</label>
            <input type="text" name="work_order_number" className="filter-select" placeholder="Search WO#" value={filters.work_order_number} onChange={handleFilterChange} />
          </div>
        </div>
        <div className="filter-actions">
          <button className="btn-filter-apply" onClick={handleApply}>Apply</button>
          <button className="btn-filter-reset" onClick={handleReset}>
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>

      {/* ===== Stats Row ===== */}
      {groupedData.length > 0 && (
        <div className="board-stats">
          <div className="stat">
            <span className="stat-lbl">Work Orders</span>
            <span className="stat-val">{groupedData.length}</span>
          </div>
          <div className="stat">
            <span className="stat-lbl">Total Audio</span>
            <span className="stat-val">{totalAudioSum}</span>
          </div>
          <div className="stat">
            <span className="stat-lbl">Done</span>
            <span className="stat-val">{doneCount}</span>
          </div>
          <div className="stat">
            <span className="stat-lbl">In Progress</span>
            <span className="stat-val">{inProgressCount}</span>
          </div>
          <div className="stat">
            <span className="stat-lbl">Pending</span>
            <span className="stat-val">{pendingCount}</span>
          </div>
        </div>
      )}

      {/* ===== Board Content ===== */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading board...</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : groupedData.length === 0 ? (
        <div style={{ 
          background: 'var(--surface)', 
          borderRadius: 'var(--r-lg)', 
          padding: '4rem 2rem', 
          textAlign: 'center', 
          border: '.5px dashed var(--border)',
          marginTop: '1.5rem'
        }}>
          <h3 style={{ fontSize: '19px', fontWeight: '700', color: 'var(--text)', marginBottom: '0.5rem', letterSpacing: '-0.015em' }}>
            No records found
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto', fontSize: '13px' }}>
            No active work orders match your current filter criteria.
          </p>
        </div>
      ) : (
        <div className="board-grid">
          {groupedData.map(card => {
            const isExpanded = expandedCards[card.id] !== false;
            const hasFiles = card.subRecords && card.subRecords.length > 0;
            
            return (
              <div key={card.id} className={`wo-card ${getStatusCardClass(card.status)}`}>
                {/* Card Header */}
                <div className="wo-head">
                  <span className="wo-num">{card.work_order_number || 'Unnamed WO'}</span>
                  <div 
                    className={`wo-badge ${getStatusBadgeClass(card.status)} wo-badge-interactive`}
                    title="Click to update status for all file records in this work order"
                  >
                    {updatingId === card.id ? (
                      <RotateCcw size={11} className="spin" />
                    ) : (
                      <StatusIcon status={card.status} />
                    )}
                    <span>{card.status || 'Pending'}</span>
                    <ChevronDown size={11} style={{ marginLeft: '1px', opacity: 0.75 }} />
                    <select
                      value={card.status || 'Pending'}
                      disabled={updatingId === card.id}
                      onChange={(e) => handleStatusChange(card, e.target.value)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: updatingId === card.id ? 'wait' : 'pointer'
                      }}
                    >
                      {statusOptions.map(opt => (
                        <option key={opt} value={opt} style={{ background: '#ffffff', color: '#1e293b' }}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Card Metadata */}
                <div className="wo-meta">
                  <div>
                    <div className="wo-meta-lbl">Type</div>
                    <div className="wo-meta-val">{card.request_type || '—'}</div>
                  </div>
                  <div>
                    <div className="wo-meta-lbl">Due</div>
                    <div className="wo-meta-val">{formatDdMmm(card.due_date)}</div>
                  </div>
                  <div className="wo-meta-audio">
                    <div className="wo-meta-lbl">Total Audio</div>
                    <div className="wo-meta-val">{card.audio_length || '—'}</div>
                  </div>
                </div>

                {/* Tag pills row */}
                <div className="wo-tags">
                  {card.region && <span className={`pill ${getRegionPillClass(card.region)}`}>{card.region}</span>}
                  {card.division && <span className={`pill ${getDivisionPillClass(card.division)}`}>{card.division}</span>}
                  {card.assigned_to && <span className={`pill ${getEmployeePillClass(card.assigned_to)}`}>{card.assigned_to}</span>}
                </div>
                
                {/* Files Section */}
                {hasFiles && (
                  <div className="wo-files">
                    <div className="wo-files-head" onClick={() => toggleExpandCard(card.id)}>
                      <span>{card.subRecords.length} {card.subRecords.length === 1 ? 'File' : 'Files'}</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    
                    {isExpanded && card.subRecords.map((sub, idx) => {
                      const fileId = sub.id || `${card.id}-${idx}`;
                      return (
                        <div key={fileId} className="wo-file">
                          <div className="wo-file-name">
                            <FileText size={13} />
                            <span>{sub.file_number || '—'}</span>
                          </div>
                          <span className="wo-file-len">{sub.audio_length || '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
