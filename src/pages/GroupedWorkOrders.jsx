import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronRight, ChevronDown, Calendar } from 'lucide-react';

export default function GroupedWorkOrders() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedWorkOrders, setExpandedWorkOrders] = useState({});
  const [selectedDueDate, setSelectedDueDate] = useState('');

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .order('due_date', { ascending: true })
      .order('work_order_number', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setRecords(data || []);
      
      // Expand the first few dates by default
      if (data && data.length > 0) {
        const initialExpanded = {};
        const uniqueDates = [...new Set(data.map(r => r.due_date || 'Unassigned'))].slice(0, 3);
        uniqueDates.forEach(d => initialExpanded[d] = true);
        setExpandedDates(initialExpanded);
      }
    }
    setLoading(false);
  };

  const toggleExpand = (date) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const toggleExpandWorkOrder = (compositeKey) => {
    setExpandedWorkOrders(prev => ({
      ...prev,
      [compositeKey]: !prev[compositeKey]
    }));
  };

  const formatDdMmm = (dateStr) => {
    if (!dateStr || dateStr === 'Unassigned') return 'Unassigned';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const isISODate = typeof dateStr === 'string' && dateStr.length === 10 && dateStr.includes('-');
    const day = isISODate ? d.getUTCDate() : d.getDate();
    const monthIndex = isISODate ? d.getUTCMonth() : d.getMonth();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[monthIndex]}`;
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

  // Extract unique due dates for the dropdown
  const uniqueDueDates = useMemo(() => {
    const dates = [...new Set(records.map(r => r.due_date || 'Unassigned'))];
    return dates.sort((a, b) => {
      if (a === 'Unassigned') return -1;
      if (b === 'Unassigned') return 1;
      return new Date(a) - new Date(b);
    });
  }, [records]);

  // Group records by due date, and then combine identical work orders
  const groupedData = useMemo(() => {
    const filteredRecords = selectedDueDate ? records.filter(r => (r.due_date || 'Unassigned') === selectedDueDate) : records;
    const groups = {};
    
    filteredRecords.forEach(record => {
      const dateKey = record.due_date || 'Unassigned';
      if (!groups[dateKey]) {
        groups[dateKey] = {};
      }
      
      const wo = record.work_order_number || '—';
      const st = record.status || '—';
      const rt = record.request_type || '—';
      const compositeKey = `${wo}|${st}|${rt}`;
      const uniqueId = `${dateKey}|${compositeKey}`;
      
      if (!groups[dateKey][compositeKey]) {
        groups[dateKey][compositeKey] = {
          id: uniqueId,
          work_order_number: record.work_order_number,
          status: record.status,
          request_type: record.request_type,
          audio_lengths: [],
          subRecords: [],
          count: 0
        };
      }
      groups[dateKey][compositeKey].audio_lengths.push(record.audio_length);
      groups[dateKey][compositeKey].subRecords.push(record);
      groups[dateKey][compositeKey].count += 1;
    });

    const finalGroups = {};
    for (const dKey in groups) {
      finalGroups[dKey] = Object.values(groups[dKey]).map(item => ({
        ...item,
        audio_length: sumAudioLengths(item.audio_lengths)
      }));
      // Sort combined rows within the group by work order number
      finalGroups[dKey].sort((a, b) => {
        if (!a.work_order_number) return 1;
        if (!b.work_order_number) return -1;
        return a.work_order_number.localeCompare(b.work_order_number);
      });
    }
    return finalGroups;
  }, [records, selectedDueDate]);

  // Sort dates: unassigned first, then chronological
  const sortedDates = useMemo(() => {
    return Object.keys(groupedData).sort((a, b) => {
      if (a === 'Unassigned') return -1;
      if (b === 'Unassigned') return 1;
      return new Date(a) - new Date(b);
    });
  }, [groupedData]);

  return (
    <div className="page-container">
      <h1 className="page-title">By Due Date</h1>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Calendar size={18} color="#64748b" />
          <select 
            value={selectedDueDate} 
            onChange={(e) => setSelectedDueDate(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', color: '#334155', fontWeight: '500', fontSize: '0.95rem', cursor: 'pointer', minWidth: '150px' }}
          >
            <option value="">All Due Dates</option>
            {uniqueDueDates.map(d => (
              <option key={d} value={d}>{formatDdMmm(d)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="content-card">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <p className="text-muted">Loading records...</p>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <p className="text-muted">No records found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: '150px', padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>Due Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>Work Order #</th>
                  <th style={{ width: '150px', padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>Status</th>
                  <th style={{ width: '150px', padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>Request Type</th>
                  <th style={{ width: '150px', padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>Audio Length</th>
                </tr>
              </thead>
              <tbody>
                {sortedDates.map(dateKey => {
                  const isExpanded = !!expandedDates[dateKey];
                  const items = groupedData[dateKey];
                  const formattedDate = formatDdMmm(dateKey);

                  return (
                    <React.Fragment key={dateKey}>
                      {/* Parent Row */}
                      <tr 
                        onClick={() => toggleExpand(dateKey)}
                        style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#f8fafc' : '#ffffff', transition: 'background-color 0.2s', borderBottom: isExpanded ? 'none' : '1px solid #e2e8f0' }}
                      >
                        <td colSpan={5} style={{ padding: '0.75rem', fontWeight: '600', color: '#334155' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ color: '#6366f1', display: 'flex', alignItems: 'center' }}>
                              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>
                            <Calendar size={16} color="#94a3b8" />
                            <span>{formattedDate}</span>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                              ({items.length} work {items.length === 1 ? 'order' : 'orders'})
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Child Rows */}
                      {isExpanded && items.map((record, index) => {
                        const isLastItem = index === items.length - 1;
                        const isWoExpanded = !!expandedWorkOrders[record.id];
                        const hasSubRecords = record.subRecords && record.subRecords.length > 0;
                        
                        return (
                          <React.Fragment key={record.id}>
                            <tr style={{ backgroundColor: isWoExpanded ? '#f8fafc' : '#ffffff', borderBottom: (isLastItem && !isWoExpanded) ? '1px solid #e2e8f0' : '1px solid #f1f5f9', cursor: hasSubRecords ? 'pointer' : 'default' }} onClick={() => hasSubRecords && toggleExpandWorkOrder(record.id)}>
                              <td style={{ padding: '0.75rem', position: 'relative' }}>
                                {/* Indentation indicator */}
                                <div style={{ position: 'absolute', left: '22px', top: 0, bottom: 0, width: '2px', backgroundColor: '#e2e8f0' }}></div>
                              </td>
                              <td style={{ padding: '0.75rem', color: '#475569', fontSize: '0.9rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {hasSubRecords && (
                                    <div style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                                      {isWoExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </div>
                                  )}
                                  <span>{record.work_order_number || '—'}</span>
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <span className={`status-badge ${record.status === 'Done' ? 'paid' : record.status === 'In progress' ? 'pending' : ''}`}>
                                  {record.status || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem', color: '#475569', fontSize: '0.9rem' }}>{record.request_type || '—'}</td>
                              <td style={{ padding: '0.75rem', color: '#475569', fontSize: '0.9rem', fontFamily: 'monospace' }}>{record.audio_length || '—'}</td>
                            </tr>
                            
                            {/* Grandchild Rows (File Numbers) */}
                            {isWoExpanded && hasSubRecords && record.subRecords.map((sub, subIdx) => {
                              const isLastSub = subIdx === record.subRecords.length - 1;
                              return (
                                <tr key={sub.id || subIdx} style={{ backgroundColor: '#fafafa', borderBottom: (isLastItem && isLastSub) ? '1px solid #e2e8f0' : '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '0.75rem', position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '22px', top: 0, bottom: 0, width: '2px', backgroundColor: '#e2e8f0' }}></div>
                                  </td>
                                  <td style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.85rem', paddingLeft: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <div style={{ width: '12px', height: '12px', borderLeft: '2px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', borderRadius: '0 0 0 4px', marginBottom: '4px' }}></div>
                                      File #: {sub.file_number || '—'}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.75rem' }}></td>
                                  <td style={{ padding: '0.75rem' }}></td>
                                  <td style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.85rem', fontFamily: 'monospace' }}>{sub.audio_length || '—'}</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
