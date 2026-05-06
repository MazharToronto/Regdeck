import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, ChevronDown, ChevronUp, FileText, CheckCircle, Clock } from 'lucide-react';

export default function CreativeGroupedView() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDueDate, setSelectedDueDate] = useState('');
  const [expandedCards, setExpandedCards] = useState({});

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
      
      // Auto-select the first available date
      if (data && data.length > 0) {
        const uniqueDates = [...new Set(data.map(r => r.due_date || 'Unassigned'))].sort((a, b) => {
          if (a === 'Unassigned') return -1;
          if (b === 'Unassigned') return 1;
          return new Date(a) - new Date(b);
        });
        if (uniqueDates.length > 0) {
          setSelectedDueDate(uniqueDates[0]);
        }
      }
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

  // Extract unique due dates for the pill selector
  const uniqueDueDates = useMemo(() => {
    const dates = [...new Set(records.map(r => r.due_date || 'Unassigned'))];
    return dates.sort((a, b) => {
      if (a === 'Unassigned') return -1;
      if (b === 'Unassigned') return 1;
      return new Date(a) - new Date(b);
    });
  }, [records]);

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

  return (
    <div className="page-container" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Work Order Board</h1>
      </div>

      {/* Interactive Date Strip */}
      <div style={{ 
        display: 'flex', 
        gap: '0.75rem', 
        overflowX: 'auto', 
        paddingBottom: '1rem', 
        marginBottom: '1.5rem',
        scrollbarWidth: 'none', /* Firefox */
      }}>
        <style dangerouslySetInnerHTML={{__html: `
          .date-strip::-webkit-scrollbar { display: none; }
          .date-pill {
            padding: 0.6rem 1.25rem;
            border-radius: 999px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s ease;
            border: 2px solid transparent;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .date-pill:hover {
            transform: translateY(-2px);
          }
          .date-pill.active {
            background: linear-gradient(135deg, #6366f1, #7c3aed);
            color: white;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
          }
          .date-pill.inactive {
            background: #fff;
            color: #64748b;
            border-color: #e2e8f0;
          }
          .date-pill.inactive:hover {
            border-color: #cbd5e1;
            color: #334155;
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
        
        <div className="date-strip" style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', width: '100%' }}>
          {uniqueDueDates.length === 0 && !loading && (
            <p className="text-muted">No dates available.</p>
          )}
          {uniqueDueDates.map(d => (
            <div 
              key={d} 
              className={`date-pill ${selectedDueDate === d ? 'active' : 'inactive'}`}
              onClick={() => setSelectedDueDate(d)}
            >
              <Calendar size={16} />
              {formatDdMmm(d)}
            </div>
          ))}
        </div>
      </div>

      {/* Masonry / Grid Board */}
      {loading ? (
        <p className="text-muted">Loading board...</p>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : groupedDataForSelectedDate.length === 0 ? (
        <div className="empty-state">
          <p className="text-muted">No records found for this due date.</p>
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
                      )})}
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
