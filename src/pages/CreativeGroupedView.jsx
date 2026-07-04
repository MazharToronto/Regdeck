import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronDown, ChevronUp, FileText, CheckCircle, Clock, Filter, RotateCcw } from 'lucide-react';

export default function CreativeGroupedView({ userRoles = [], user }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [userOptions, setUserOptions] = useState([]);

  const isEmployee = !userRoles.includes('admin') && !userRoles.includes('manager');
  const userName = user?.user_metadata?.full_name || '';

  // Filter values — default From/To Due to current month range
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDate = new Date(year, month + 1, 0).getDate(); // last day of month
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
    fetchRecords(filters);
  }, []);

  const fetchRecords = async (activeFilters = null) => {
    setLoading(true);
    setError(null);
    
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

      if (isEmployee && userName) {
        query = query.eq('assigned_to', userName);
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
        totalSeconds += parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    });
    if (totalSeconds === 0) return '—';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
      // Sort by due date first, then by work order number
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

  return (
    <div className="page-container" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Work Order Board</h1>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .work-order-card {
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
          border: 1px solid #f1f5f9;
          overflow: hidden;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
        }
        .work-order-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          border-color: #e2e8f0;
        }
        .work-order-card.status-done { border-top: 4px solid #10b981; }
        .work-order-card.status-in-progress { border-top: 4px solid #f59e0b; }
        .work-order-card.status-default { border-top: 4px solid #6366f1; }
      `}} />

      {/* ===== Filter Bar ===== */}
      <div className="filter-bar" style={{ marginBottom: '2rem' }}>
        <div className="filter-bar-header">
          <Filter size={16} />
          <span>Filters</span>
        </div>
        <div className="filter-fields" style={{ gap: '1.5rem' }}>
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
            <input type="text" name="work_order_number" className="filter-select" placeholder="Search Work Order#" value={filters.work_order_number} onChange={handleFilterChange} />
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

      {/* Total Audio Length Display */}
      {groupedData.length > 0 && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
          border: '1px solid #bbf7d0',
          padding: '0.55rem 1.1rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.04)'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Audio Length
          </span>
          <span style={{ 
            fontSize: '1.1rem', 
            fontWeight: '700', 
            color: '#166534', 
            fontFamily: 'monospace',
            background: '#fff',
            padding: '0.2rem 0.55rem',
            borderRadius: '6px',
            border: '1px solid #dcfce7'
          }}>
            {totalAudioSum}
          </span>
        </div>
      )}

      {/* Board Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading board...</div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : groupedData.length === 0 ? (
        <div style={{ 
          background: '#fff', 
          borderRadius: '16px', 
          padding: '4rem 2rem', 
          textAlign: 'center', 
          border: '1px dashed #cbd5e1',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          marginTop: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>
            No records found
          </h3>
          <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto', fontSize: '0.95rem' }}>
            No active work orders match your current filter criteria.
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1.5rem',
          alignItems: 'start'
        }}>
          {groupedData.map(card => {
            const isExpanded = expandedCards[card.id] !== false; // True by default
            const hasFiles = card.subRecords && card.subRecords.length > 0;
            const statusClass = card.status === 'Done' ? 'status-done' : card.status === 'In Process' ? 'status-in-progress' : 'status-default';
            const StatusIcon = card.status === 'Done' ? CheckCircle : Clock;
            
            return (
              <div key={card.id} className={`work-order-card ${statusClass}`}>
                {/* Card Header */}
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#1e293b' }}>
                      {card.work_order_number || 'Unnamed WO'}
                    </h3>
                    <span className={`status-badge ${card.status === 'Done' ? 'paid' : card.status === 'In Process' ? 'pending' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem' }}>
                      <StatusIcon size={12} />
                      {card.status || 'No Status'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Type</span>
                      <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: '500' }}>{card.request_type || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Due</span>
                      <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: '500' }}>{formatDdMmm(card.due_date)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Total Audio</span>
                      <span style={{ fontSize: '1.1rem', color: '#6366f1', fontWeight: '700', fontFamily: 'monospace' }}>{card.audio_length || '—'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Card Footer / Toggle */}
                {hasFiles && (
                  <div 
                    onClick={() => toggleExpandCard(card.id)}
                    style={{ 
                      padding: '0.75rem 1.25rem', 
                      background: isExpanded ? '#f8fafc' : '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
                      {card.subRecords.length} {card.subRecords.length === 1 ? 'File' : 'Files'}
                    </span>
                    <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                )}
                
                {/* Expanded Files List */}
                {isExpanded && hasFiles && (
                  <div style={{ background: '#f8fafc', padding: '0 1.25rem 1.25rem 1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {card.subRecords.map((sub, idx) => {
                        const fileId = sub.id || `${card.id}-${idx}`;
                        return (
                          <div key={fileId} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '0.6rem 0.8rem',
                            background: '#fff',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontSize: '0.85rem', fontWeight: '500' }}>
                              <FileText size={14} color="#94a3b8" />
                              {sub.file_number || '—'}
                            </div>
                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontFamily: 'monospace', fontWeight: '600' }}>
                              {sub.audio_length || '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
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
