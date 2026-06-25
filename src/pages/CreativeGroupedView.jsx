import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, ChevronDown, ChevronUp, FileText, CheckCircle, Clock } from 'lucide-react';

export default function CreativeGroupedView({ userRoles = [], user }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDueDate, setSelectedDueDate] = useState('');
  const [expandedCards, setExpandedCards] = useState({});

  const isEmployee = !userRoles.includes('admin') && !userRoles.includes('manager');
  const userName = user?.user_metadata?.full_name || '';

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    
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
      }

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

  const toggleExpandCard = (compositeKey) => {
    setExpandedCards(prev => ({
      ...prev,
      [compositeKey]: prev[compositeKey] === false ? true : false
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

  // Group records by the SELECTED due date, then combine identical work orders
  const groupedDataForSelectedDate = useMemo(() => {
    if (!selectedDueDate) return [];
    
    const filteredRecords = records.filter(r => (r.due_date || 'Unassigned') === selectedDueDate);
    const groups = {};
    
    filteredRecords.forEach(record => {
      const wo = record.work_order_number || '—';
      const st = record.status || '—';
      const rt = record.request_type || '—';
      const compositeKey = `${wo}|${st}|${rt}`;
      const uniqueId = `${selectedDueDate}|${compositeKey}`;
      
      if (!groups[compositeKey]) {
        groups[compositeKey] = {
          id: uniqueId,
          work_order_number: record.work_order_number,
          status: record.status,
          request_type: record.request_type,
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
      if (!a.work_order_number) return 1;
      if (!b.work_order_number) return -1;
      return a.work_order_number.localeCompare(b.work_order_number);
    });
    
    return finalGroups;
  }, [records, selectedDueDate]);

  const totalAudioSum = useMemo(() => {
    if (!selectedDueDate || groupedDataForSelectedDate.length === 0) return '00:00';
    const allLengths = groupedDataForSelectedDate.map(card => card.audio_length);
    return sumAudioLengths(allLengths);
  }, [groupedDataForSelectedDate, selectedDueDate]);

  return (
    <div className="page-container" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Work Order Board</h1>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-date-input:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15) !important;
        }
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

      {/* Date Selector Row */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '2.5rem'
      }}>
        {/* Date Input Wrapper */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem', 
          background: '#fff', 
          padding: '0.55rem 1rem', 
          borderRadius: '10px', 
          border: '1.5px solid #ececf1', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)' 
        }}>
          <Calendar size={18} color="#64748b" />
          <input 
            type="date" 
            value={selectedDueDate && selectedDueDate !== 'Unassigned' ? selectedDueDate : ''} 
            onChange={(e) => setSelectedDueDate(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: '#1e1e2f',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              minWidth: '150px',
              fontFamily: 'inherit'
            }}
            className="custom-date-input"
          />
        </div>

        {/* Unassigned Button */}
        <button 
          type="button"
          onClick={() => setSelectedDueDate('Unassigned')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            border: '1.5px solid ' + (selectedDueDate === 'Unassigned' ? 'transparent' : '#ececf1'),
            background: selectedDueDate === 'Unassigned' 
              ? 'linear-gradient(135deg, #6366f1, #7c3aed)' 
              : '#fff',
            color: selectedDueDate === 'Unassigned' ? '#fff' : '#5a5a72',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
            boxShadow: selectedDueDate === 'Unassigned' ? '0 3px 12px rgba(99, 102, 241, 0.25)' : 'none'
          }}
          onMouseOver={(e) => {
            if (selectedDueDate !== 'Unassigned') {
              e.currentTarget.style.background = '#f7f7fb';
              e.currentTarget.style.borderColor = '#c0c0d0';
            }
          }}
          onMouseOut={(e) => {
            if (selectedDueDate !== 'Unassigned') {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = '#ececf1';
            }
          }}
        >
          Unassigned
        </button>
      </div>

      {/* Total Audio Length Display */}
      {selectedDueDate && groupedDataForSelectedDate.length > 0 && (
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
      {!selectedDueDate ? (
        <div style={{ 
          background: '#fff', 
          borderRadius: '16px', 
          padding: '4rem 2rem', 
          textAlign: 'center', 
          border: '1px dashed #cbd5e1',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          marginTop: '1.5rem'
        }}>
          <Calendar size={48} color="#6366f1" style={{ margin: '0 auto 1.5rem', opacity: 0.8 }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>
            Select a Due Date
          </h3>
          <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto', fontSize: '0.95rem' }}>
            Please select a due date from the date picker above or click "Unassigned" to view active work orders on the board.
          </p>
        </div>
      ) : loading ? (
        <p className="text-muted">Loading board...</p>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : groupedDataForSelectedDate.length === 0 ? (
        <div className="empty-state">
          <p className="text-muted">No records found for this due.</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1.5rem',
          alignItems: 'start'
        }}>
          {groupedDataForSelectedDate.map(card => {
            const isExpanded = expandedCards[card.id] !== false; // True by default
            const hasFiles = card.subRecords && card.subRecords.length > 0;
            const statusClass = card.status === 'Done' ? 'status-done' : card.status === 'In progress' ? 'status-in-progress' : 'status-default';
            const StatusIcon = card.status === 'Done' ? CheckCircle : Clock;
            
            return (
              <div key={card.id} className={`work-order-card ${statusClass}`}>
                {/* Card Header */}
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#1e293b' }}>
                      {card.work_order_number || 'Unnamed WO'}
                    </h3>
                    <span className={`status-badge ${card.status === 'Done' ? 'paid' : card.status === 'In progress' ? 'pending' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem' }}>
                      <StatusIcon size={12} />
                      {card.status || 'No Status'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Type</span>
                      <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: '500' }}>{card.request_type || '—'}</span>
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
