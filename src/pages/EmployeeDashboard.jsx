import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';

// Utility to calculate total seconds from audio length string (hh:mm format)
const parseAudioToSeconds = (audioLengthStr) => {
  if (!audioLengthStr) return 0;
  const parts = audioLengthStr.toString().split(':');
  let totalSeconds = 0;
  if (parts.length === 3) {
    totalSeconds += parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    totalSeconds += parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60; // hh:mm
  } else if (parts.length === 1) {
    totalSeconds += parseInt(parts[0], 10) * 3600;
  }
  return isNaN(totalSeconds) ? 0 : totalSeconds;
};

// Format total seconds back into audio length string in hh:mm format
const formatSecondsToAudioLength = (totalSeconds) => {
  if (!totalSeconds || totalSeconds === 0) return '0:00';
  const totalM = Math.floor(totalSeconds / 60);
  const hrs = Math.floor(totalM / 60);
  const mins = totalM % 60;
  return `${hrs}:${mins.toString().padStart(2, '0')}`;
};

// Format date as DD-MMM (e.g. 1-Apr)
const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()}-${months[d.getMonth()]}`;
};

// Group records by WO# + Type + Due Date, summing audio lengths
const groupByWO = (items) => {
  const grouped = new Map();
  items.forEach(item => {
    const key = `${item.work_order_number}|${item.request_type}|${item.due_date}`;
    if (grouped.has(key)) {
      const existing = grouped.get(key);
      existing.secondsValue += item.secondsValue;
      existing.displayAudio = formatSecondsToAudioLength(existing.secondsValue);
    } else {
      grouped.set(key, { ...item });
    }
  });
  return Array.from(grouped.values());
};

export default function EmployeeDashboard({ user }) {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const userName = user?.user_metadata?.full_name || '';

  useEffect(() => {
    const fetchMyWorkOrders = async () => {
      setLoading(true);
      const nameToQuery = userName.trim();
      if (!nameToQuery) {
        setWorkOrders([]);
        setLoading(false);
        return;
      }

      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      let fetchError = null;

      while (hasMore) {
        const start = page * pageSize;
        const end = start + pageSize - 1;

        const { data, error } = await supabase
          .from('work_orders')
          .select('id, work_order_number, request_type, due_date, audio_length, status, tat')
          .eq('assigned_to', nameToQuery)
          .range(start, end);

        if (error) {
          fetchError = error;
          break;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      if (fetchError) {
        console.error('Error fetching work orders:', fetchError);
        setWorkOrders([]);
      } else {
        setWorkOrders(allData);
      }
      setLoading(false);
    };

    fetchMyWorkOrders();
  }, [userName]);

  const reportData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day for accurate comparison

    // Calculate the date 2 days from now
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const active = [];
    const needsAttention = [];
    const workDue = [];

    workOrders.forEach(wo => {
      const status = (wo.status || '').toLowerCase();
      const seconds = parseAudioToSeconds(wo.audio_length);
      const mappedRecord = {
        ...wo,
        displayAudio: wo.audio_length || '0:00',
        secondsValue: seconds
      };

      const isActiveStatus = status === 'in process' || status === 'pending';

      // 1. Active: records with status "In Process" or "Pending"
      if (isActiveStatus) {
        active.push(mappedRecord);
      }

      // 2. Needs Attention: due within 2 days AND status is "In Process" or "Pending"
      if (wo.due_date && isActiveStatus) {
        const dueDateObj = new Date(wo.due_date);
        dueDateObj.setHours(0, 0, 0, 0);
        if (dueDateObj >= today && dueDateObj <= twoDaysFromNow) {
          needsAttention.push(mappedRecord);
        }
      }

      // 3. Work Due: past due date AND status is "In Process" or "Pending"
      if (wo.due_date && isActiveStatus) {
        const dueDateObj = new Date(wo.due_date);
        dueDateObj.setHours(0, 0, 0, 0);
        if (dueDateObj < today) {
          workDue.push(mappedRecord);
        }
      }
    });

    // Group all reports by WO# + Type + Due Date, summing audio lengths
    return {
      active: groupByWO(active),
      needsAttention: groupByWO(needsAttention),
      workDue: groupByWO(workDue)
    };
  }, [workOrders]);

  // Color config for badge backgrounds matching Dashboard.jsx report cards
  const colorConfig = {
    '#3b82f6': { badgeBg: '#dbeafe', badgeText: '#1d4ed8' }, // Blue
    '#f59e0b': { badgeBg: '#fef3c7', badgeText: '#a16207' }, // Amber
    '#ef4444': { badgeBg: '#fee2e2', badgeText: '#b91c1c' }, // Red
  };

  const renderKanbanCard = (title, items, icon, colorHex) => {
    const totalSeconds = items.reduce((sum, item) => sum + item.secondsValue, 0);
    const { badgeBg, badgeText } = colorConfig[colorHex] || { badgeBg: '#f1f5f9', badgeText: '#475569' };

    return (
      <div className="work-order-card" style={{
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        border: '1px solid #f1f5f9',
        borderTop: `6px solid ${colorHex}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Card Header */}
        <div style={{
          padding: '1.25rem',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <h3 style={{ margin: 0 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.5rem 1.1rem',
              borderRadius: 'var(--r-sm)',
              fontSize: '13px',
              fontWeight: '700',
              background: 'var(--subtle)',
              color: 'var(--text)',
              border: '.5px solid var(--border)'
            }}>
              {title}
            </span>
          </h3>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.4rem 0.85rem',
            background: badgeBg,
            color: badgeText,
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: '600'
          }}>
            {icon}
            {items.length} {items.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        {/* Card Body (Table) */}
        <div style={{ padding: '1.25rem', background: '#f8fafc', flexGrow: 1 }}>
          {items.length === 0 ? (
            <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              {React.cloneElement(icon, { size: 28, color: '#94a3b8' })}
              <p>No work orders found.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>WO #</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Type</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Due</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em', textAlign: 'right' }}>Audio Length</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: idx === items.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>{item.work_order_number || '—'}</td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{item.request_type || '—'}</td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatShortDate(item.due_date) || '—'}</td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', fontWeight: '700', color: '#6366f1', fontFamily: 'monospace', textAlign: 'right' }}>
                        {item.displayAudio}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Card Footer (Totals) */}
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                    <td colSpan="3" style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '700', color: '#1e293b', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Total
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '700', color: '#6366f1', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                      {formatSecondsToAudioLength(totalSeconds)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="page-container"><div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading dashboard...</div></div>;
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ color: '#64748b', fontSize: '14px' }}>
          Welcome back, <strong>{userName}</strong>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {renderKanbanCard(
          "Process and Pending",
          reportData.active,
          <Clock size={18} />,
          '#3b82f6' // Blue
        )}

        {renderKanbanCard(
          "Needs attention",
          reportData.needsAttention,
          <AlertCircle size={18} />,
          '#f59e0b' // Amber
        )}
        
        {renderKanbanCard(
          "Past Due date",
          reportData.workDue,
          <AlertTriangle size={18} />,
          '#ef4444' // Red
        )}
      </div>
    </div>
  );
}
