import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';

// Utility to calculate total seconds from audio length string
const parseAudioToSeconds = (audioLengthStr) => {
  if (!audioLengthStr) return 0;
  const parts = audioLengthStr.toString().split(':');
  let totalSeconds = 0;
  if (parts.length === 3) {
    totalSeconds += parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    totalSeconds += parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  } else if (parts.length === 1) {
    totalSeconds += parseInt(parts[0], 10) * 60;
  }
  return isNaN(totalSeconds) ? 0 : totalSeconds;
};

// Format total seconds back into audio length string
const formatSecondsToAudioLength = (totalSeconds) => {
  if (!totalSeconds || totalSeconds === 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format date as DD-MMM (e.g. 1-Apr)
const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()}-${months[d.getMonth()]}`;
};

export default function EmployeeDashboard({ user }) {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const userName = user?.user_metadata?.full_name || '';

  useEffect(() => {
    const fetchMyWorkOrders = async () => {
      setLoading(true);
      if (!userName) {
        setLoading(false);
        return;
      }

      // Fetch all incomplete or recently completed work orders assigned to the user
      // Status isn't explicitly constrained here so we can do all client-side filtering
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, work_order_number, request_type, due_date, audio_length, status, tat')
        .eq('assigned_to', userName);

      if (error) {
        console.error('Error fetching work orders:', error);
        setWorkOrders([]);
      } else {
        setWorkOrders(data || []);
      }
      setLoading(false);
    };

    fetchMyWorkOrders();
  }, [userName]);

  const reportData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day for accurate past due comparison

    const inProcess = [];
    const pastDue = [];
    const pending2Tat = [];

    workOrders.forEach(wo => {
      const status = (wo.status || '').toLowerCase();
      const tat = parseInt(wo.tat, 10);
      const seconds = parseAudioToSeconds(wo.audio_length);
      const mappedRecord = {
        ...wo,
        displayAudio: wo.audio_length || '0:00',
        secondsValue: seconds
      };

      // 1. Work In Process
      if (status === 'in progress') {
        inProcess.push(mappedRecord);
      }

      // 2. Past Due
      if (wo.due_date) {
        const dueDateObj = new Date(wo.due_date);
        dueDateObj.setHours(0, 0, 0, 0);
        // Only consider past due if it's not done (assuming 'done' means completed)
        if (dueDateObj < today && status !== 'done') {
          pastDue.push(mappedRecord);
        }
      }

      // 3. 2 TAT - Assigned (Pending & Work in Progress)
      if (tat === 2 && (status === 'pending' || status === 'in progress')) {
        pending2Tat.push(mappedRecord);
      }
    });

    return { inProcess, pastDue, pending2Tat };
  }, [workOrders]);

  const renderKanbanCard = (title, items, icon, colorHex) => {
    const totalSeconds = items.reduce((sum, item) => sum + item.secondsValue, 0);

    return (
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Card Header */}
        <div style={{
          padding: '16px',
          background: colorHex,
          color: '#fff',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '15px'
        }}>
          {icon}
          {title}
        </div>

        {/* Card Body (Table) */}
        <div style={{ padding: '0', flexGrow: 1, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569', fontWeight: '600' }}>WO #</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569', fontWeight: '600' }}>Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569', fontWeight: '600' }}>Due date</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>Audio length</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    No work orders found.
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', color: '#1e293b', fontWeight: '500' }}>{item.work_order_number || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{item.request_type || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{formatShortDate(item.due_date) || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1e293b', fontWeight: '500' }}>
                      {item.displayAudio}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Card Footer (Totals) */}
            {items.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                  <td colSpan="3" style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>
                    Total
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>
                    {formatSecondsToAudioLength(totalSeconds)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
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
        <h1 className="page-title" style={{ margin: 0 }}>Employee Dashboard</h1>
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
          "Work In progress",
          reportData.inProcess,
          <Clock size={18} />,
          '#3b82f6' // Blue
        )}
        
        {renderKanbanCard(
          "Work Order past due date",
          reportData.pastDue,
          <AlertTriangle size={18} />,
          '#ef4444' // Red
        )}

        {renderKanbanCard(
          "TAT of score 2 and Status with Pending and In progress",
          reportData.pending2Tat,
          <AlertCircle size={18} />,
          '#f59e0b' // Amber
        )}
      </div>
    </div>
  );
}
