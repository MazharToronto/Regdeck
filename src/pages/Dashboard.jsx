import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { BarChart3, CalendarCheck, Truck, Inbox, Clock, Sparkles, ClipboardList } from 'lucide-react';

// Helper to format date as DD-MMM (e.g. "4-May")
const formatDdMmm = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  const isISO = typeof dateStr === 'string' && dateStr.length === 10 && dateStr.includes('-');
  const day = isISO ? d.getUTCDate() : d.getDate();
  const monthIndex = isISO ? d.getUTCMonth() : d.getMonth();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${months[monthIndex]}`;
};

// Helper to format date as DD-MMM-YYYY (e.g. "8-May-26")
const formatDdMmmYyyy = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  const isISO = typeof dateStr === 'string' && dateStr.length === 10 && dateStr.includes('-');
  const day = isISO ? d.getUTCDate() : d.getDate();
  const monthIndex = isISO ? d.getUTCMonth() : d.getMonth();
  const year = isISO ? d.getUTCFullYear() : d.getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortYear = String(year).slice(-2);
  return `${day}-${months[monthIndex]}-${shortYear}`;
};

// Helper to get status badge class
const getStatusClass = (status) => {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s === 'done') return 'dash-status-done';
  if (s === 'in process') return 'dash-status-inprogress';
  if (s === 'pending') return 'dash-status-pending';
  return '';
};
// Helper for monthly region badge — now returns a CSS class name
const getRegionPillClass = (region) => {
  const map = { 'Eastern': 'reg-eastern', 'Central': 'reg-central', 'Western': 'reg-western', 'Rexdale': 'reg-rexdale' };
  return map[region] || '';
};

// Employee pill class
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

// Parse audio length string (hh:mm or hh:mm:ss) → total seconds
const parseAudioToSeconds = (str) => {
  if (!str || typeof str !== 'string') return 0;
  const trimmed = str.trim();
  const parts = trimmed.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60; // hh:mm format
  if (parts.length === 1) return parts[0] * 3600; // bare number = hours
  return 0;
};

// Format total seconds back to hh:mm format
const formatSeconds = (totalSeconds) => {
  if (!totalSeconds || isNaN(totalSeconds)) return '—';
  const totalM = Math.floor(totalSeconds / 60);
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [reportMode, setReportMode] = useState('daily');
  const [language, setLanguage] = useState('EN');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const yyyy = estDate.getFullYear();
    const mm = String(estDate.getMonth() + 1).padStart(2, '0');
    const dd = String(estDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [report1Data, setReport1Data] = useState([]);
  const [reportPastDueData, setReportPastDueData] = useState([]);
  const [report2Data, setReport2Data] = useState([]);
  const [report3Data, setReport3Data] = useState([]);
  const [report4Data, setReport4Data] = useState([]);
  const [report5Data, setReport5Data] = useState([]);
  const [report6Data, setReport6Data] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPastDue, setLoadingPastDue] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [loading3, setLoading3] = useState(false);
  const [loading4, setLoading4] = useState(false);
  const [loading5, setLoading5] = useState(false);
  const [loading6, setLoading6] = useState(false);
  const [error, setError] = useState(null);
  const [errorPastDue, setErrorPastDue] = useState(null);
  const [error2, setError2] = useState(null);
  const [error3, setError3] = useState(null);
  const [error4, setError4] = useState(null);
  const [error5, setError5] = useState(null);
  const [error6, setError6] = useState(null);
  const [report5GrandTotal, setReport5GrandTotal] = useState(0);

  const [report4BenchSeconds, setReport4BenchSeconds] = useState(0);
  const [report4FullSeconds, setReport4FullSeconds] = useState(0);
  const [report4TotalSeconds, setReport4TotalSeconds] = useState(0);
  const [report4TotalRecords, setReport4TotalRecords] = useState(0);

  // --- Monthly States ---
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const [monthlyLanguage, setMonthlyLanguage] = useState('EN');
  const [monthlyMonth, setMonthlyMonth] = useState(currentMonth);
  const [monthlyYear, setMonthlyYear] = useState(currentYear);
  const [monthlyReport1Data, setMonthlyReport1Data] = useState([]);
  const [monthlyReport2Data, setMonthlyReport2Data] = useState([]);
  const [monthlyReport3Data, setMonthlyReport3Data] = useState([]);
  const [monthlyReport5Data, setMonthlyReport5Data] = useState([]);
  const [loadingM1, setLoadingM1] = useState(false);
  const [loadingM3, setLoadingM3] = useState(false);
  const [loadingM5, setLoadingM5] = useState(false);
  const [errorM1, setErrorM1] = useState(null);
  const [errorM3, setErrorM3] = useState(null);
  const [errorM5, setErrorM5] = useState(null);

  // --- Table Sorting States ---
  const [sortM1, setSortM1] = useState({ key: '', direction: 'asc' });
  const [sortM2, setSortM2] = useState({ key: '', direction: 'asc' });
  const [sortM5, setSortM5] = useState({ key: '', direction: 'asc' });

  const [sortD1, setSortD1] = useState({ key: '', direction: 'asc' });
  const [sortPastDue, setSortPastDue] = useState({ key: '', direction: 'asc' });
  const [sortD2, setSortD2] = useState({ key: '', direction: 'asc' });
  const [sortD3, setSortD3] = useState({ key: '', direction: 'asc' });
  const [sortD4, setSortD4] = useState({ key: '', direction: 'asc' });
  const [sortD5, setSortD5] = useState({ key: '', direction: 'asc' });
  const [sortD6, setSortD6] = useState({ key: '', direction: 'asc' });

  // --- Table Column Ordering States ---
  const [colOrderM1, setColOrderM1] = useState(['region', 'audioSeconds', 'wordCount', 'characterSpace', 'lineCount']);
  const [colOrderM2, setColOrderM2] = useState(['assigned_to', 'audioSeconds', 'wordCount', 'characterSpace', 'lineCount']);
  const [colOrderM5, setColOrderM5] = useState(['displayMonth', 'audioSeconds', 'wordCount', 'characterSpace', 'lineCount']);

  const [colOrderD1, setColOrderD1] = useState(['work_order_number', 'assigned_to', 'wo_date', 'due_date', 'tat', 'delivery_action']);
  const [colOrderPastDue, setColOrderPastDue] = useState(['work_order_number', 'wo_date', 'assigned_to', 'request_type', 'tat', 'due_date', 'status', 'delivery_action']);
  const [colOrderD2, setColOrderD2] = useState(['work_order_number', 'assigned_to', 'wo_date', 'delivery_date', 'status', 'delivery_action']);
  const [colOrderD3, setColOrderD3] = useState(['work_order_number', 'assigned_to', 'wo_date', 'due_date', 'status']);
  const [colOrderD4, setColOrderD4] = useState(['work_order_number', 'assigned_to', 'request_type', 'tat', 'totalSeconds']);
  const [colOrderD5, setColOrderD5] = useState(['assigned_to', 'request_type', 'totalSeconds']);
  const [colOrderD6, setColOrderD6] = useState(['wo_date', 'assigned_to', 'tat', 'request_type', 'totalSeconds']);

  const [draggedColumn, setDraggedColumn] = useState(null);

  const handleDragStart = (e, colKey) => {
    setDraggedColumn(colKey);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', colKey);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetColKey, orderedColumns, setOrderedColumns) => {
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

  const handleSortToggle = (sortState, setSortState) => (key) => {
    let direction = 'asc';
    if (sortState.key === key && sortState.direction === 'asc') {
      direction = 'desc';
    }
    setSortState({ key, direction });
  };

  const sortTableData = (data, sortConfig) => {
    if (!sortConfig || !sortConfig.key || !data || data.length === 0) return data;
    const { key, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;

    return [...data].sort((a, b) => {
      let valA = a[key];
      let valB = b[key];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * multiplier;
      }

      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && String(valA).trim() !== '' && String(valB).trim() !== '' && typeof valA !== 'boolean') {
        return (numA - numB) * multiplier;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
    });
  };

  const renderSortHeader = (label, sortKey, currentSort, setSortState, orderedColumns, setOrderedColumns, style = {}) => {
    const handleSort = handleSortToggle(currentSort, setSortState);
    const isSorted = currentSort.key === sortKey;
    const icon = !isSorted ? (
      <span className="sort-icon invisible">↕</span>
    ) : currentSort.direction === 'asc' ? (
      <span className="sort-icon">↑</span>
    ) : (
      <span className="sort-icon">↓</span>
    );

    return (
      <th
        key={sortKey}
        draggable
        onDragStart={(e) => handleDragStart(e, sortKey)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, sortKey, orderedColumns, setOrderedColumns)}
        onClick={() => handleSort(sortKey)}
        className="sortable-header"
        style={{
          padding: '0.7rem 0.5rem',
          fontSize: '0.75rem',
          color: '#64748b',
          textTransform: 'uppercase',
          fontWeight: '600',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          cursor: 'move',
          userSelect: 'none',
          textAlign: sortKey === 'delivery_action' ? 'center' : 'left',
          ...style
        }}
        title={`Drag to reorder column | Click to sort by ${label}`}
      >
        {label} {icon}
      </th>
    );
  };

  // --- Column Labels & Cell Renderers ---
  const colLabelsM1 = { region: 'Region', audioSeconds: 'Audio Length', wordCount: 'Word Count', characterSpace: 'Characters', lineCount: 'Line Count' };
  const renderCellM1 = (colKey, row) => {
    switch (colKey) {
      case 'region':
        return (
          <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
            <span className={`pill ${getRegionPillClass(row.region)}`} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
              {row.region}
            </span>
          </td>
        );
      case 'audioSeconds': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatSeconds(row.audioSeconds)}</td>;
      case 'wordCount': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.wordCount.toLocaleString()}</td>;
      case 'characterSpace': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.characterSpace.toLocaleString()}</td>;
      case 'lineCount': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.lineCount.toLocaleString()}</td>;
      default: return null;
    }
  };

  const colLabelsM2 = { assigned_to: 'Assignee', audioSeconds: 'Audio Length', wordCount: 'Word Count', characterSpace: 'Characters', lineCount: 'Line Count' };
  const renderCellM2 = (colKey, row) => {
    switch (colKey) {
      case 'assigned_to':
        return (
          <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
            <span className={`pill ${getEmployeePillClass(row.assigned_to)}`}>
              {row.assigned_to}
            </span>
          </td>
        );
      case 'audioSeconds': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatSeconds(row.audioSeconds)}</td>;
      case 'wordCount': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.wordCount.toLocaleString()}</td>;
      case 'characterSpace': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.characterSpace.toLocaleString()}</td>;
      case 'lineCount': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.lineCount.toLocaleString()}</td>;
      default: return null;
    }
  };

  const colLabelsM5 = { displayMonth: 'Month', audioSeconds: 'Audio Length', wordCount: 'Word Count', characterSpace: 'Characters', lineCount: 'Line Count' };
  const renderCellM5 = (colKey, row) => {
    switch (colKey) {
      case 'displayMonth':
        return (
          <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: row.isCurrentMonth ? '#8b5cf6' : '#334155' }}>
            {row.displayMonth} {row.isCurrentMonth && <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#8b5cf6', color: '#fff', borderRadius: '4px', marginLeft: '6px' }}>Current</span>}
          </td>
        );
      case 'audioSeconds': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatSeconds(row.audioSeconds)}</td>;
      case 'wordCount': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.wordCount.toLocaleString()}</td>;
      case 'characterSpace': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.characterSpace.toLocaleString()}</td>;
      case 'lineCount': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.lineCount.toLocaleString()}</td>;
      default: return null;
    }
  };

  const handleDeliveryAction = async (row, action) => {
    if (action === 'delivered') {
      const now = new Date();
      const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const yyyy = estDate.getFullYear();
      const mm = String(estDate.getMonth() + 1).padStart(2, '0');
      const dd = String(estDate.getDate()).padStart(2, '0');
      const todayEst = `${yyyy}-${mm}-${dd}`;

      try {
        let updateQuery = supabase
          .from('work_orders')
          .update({ delivery_date: todayEst })
          .eq('language', language)
          .eq('status', 'Done');

        if (row.work_order_number) updateQuery = updateQuery.eq('work_order_number', row.work_order_number);
        else updateQuery = updateQuery.is('work_order_number', null);

        if (row.assigned_to) updateQuery = updateQuery.eq('assigned_to', row.assigned_to);
        else updateQuery = updateQuery.is('assigned_to', null);

        if (row.wo_date) updateQuery = updateQuery.eq('wo_date', row.wo_date);
        else updateQuery = updateQuery.is('wo_date', null);

        if (row.due_date) updateQuery = updateQuery.eq('due_date', row.due_date);
        else updateQuery = updateQuery.is('due_date', null);

        if (row.tat !== undefined && row.tat !== null) updateQuery = updateQuery.eq('tat', row.tat);
        else updateQuery = updateQuery.is('tat', null);

        const { error: updateError } = await updateQuery;

        if (updateError) {
          alert(`Failed to update delivery date: ${updateError.message}`);
        } else {
          setReport1Data(prev => prev.filter(item => !(
            item.work_order_number === row.work_order_number &&
            item.assigned_to === row.assigned_to &&
            item.wo_date === row.wo_date &&
            item.due_date === row.due_date &&
            item.tat === row.tat
          )));
        }
      } catch (err) {
        alert('An error occurred while updating the delivery date.');
      }
    }
  };

  const colLabelsD1 = { work_order_number: 'WO #', assigned_to: 'Assigned To', wo_date: 'WO Date', due_date: 'Due', tat: 'TAT', delivery_action: 'Delivered' };
  const renderCellD1 = (colKey, row) => {
    switch (colKey) {
      case 'work_order_number':
        return (
          <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ClipboardList size={14} color="#94a3b8" /> {row.work_order_number}</div>
          </td>
        );
      case 'assigned_to': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{row.assigned_to}</td>;
      case 'wo_date': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatDdMmm(row.wo_date)}</td>;
      case 'due_date': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatDdMmm(row.due_date)}</td>;
      case 'tat': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{row.tat}</td>;
      case 'delivery_action':
        const rowIdentifier = `${row.work_order_number || ''}_${row.assigned_to || ''}_${row.wo_date || ''}_${row.due_date || ''}_${row.tat || ''}`;
        return (
          <td key={colKey} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
            <input
              type="radio"
              id={`del-yes-${rowIdentifier}`}
              name={`del-status-${rowIdentifier}`}
              checked={false}
              onChange={() => handleDeliveryAction(row, 'delivered')}
              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981' }}
              title="Mark as Delivered"
            />
          </td>
        );
      default: return null;
    }
  };

  const handleDeliveryActionPastDue = async (row, action) => {
    if (action === 'delivered') {
      const now = new Date();
      const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const yyyy = estDate.getFullYear();
      const mm = String(estDate.getMonth() + 1).padStart(2, '0');
      const dd = String(estDate.getDate()).padStart(2, '0');
      const todayEst = `${yyyy}-${mm}-${dd}`;

      try {
        let updateQuery = supabase
          .from('work_orders')
          .update({ delivery_date: todayEst })
          .eq('language', language)
          .is('delivery_date', null);

        if (row.work_order_number) updateQuery = updateQuery.eq('work_order_number', row.work_order_number);
        else updateQuery = updateQuery.is('work_order_number', null);

        if (row.wo_date) updateQuery = updateQuery.eq('wo_date', row.wo_date);
        else updateQuery = updateQuery.is('wo_date', null);

        if (row.assigned_to) updateQuery = updateQuery.eq('assigned_to', row.assigned_to);
        else updateQuery = updateQuery.is('assigned_to', null);

        if (row.hearing_date) updateQuery = updateQuery.eq('hearing_date', row.hearing_date);
        else updateQuery = updateQuery.is('hearing_date', null);

        if (row.status) updateQuery = updateQuery.eq('status', row.status);
        else updateQuery = updateQuery.is('status', null);

        const { error: updateError } = await updateQuery;

        if (updateError) {
          alert(`Failed to update delivery date: ${updateError.message}`);
        } else {
          setReportPastDueData(prev => prev.filter(item => !(
            item.work_order_number === row.work_order_number &&
            item.wo_date === row.wo_date &&
            item.assigned_to === row.assigned_to &&
            item.hearing_date === row.hearing_date &&
            item.status === row.status
          )));
        }
      } catch (err) {
        alert('An error occurred while updating the delivery date.');
      }
    }
  };

  const colLabelsPastDue = {
    work_order_number: 'WO #',
    wo_date: 'WO Date',
    assigned_to: 'Assigned To',
    request_type: 'Type',
    tat: 'TAT',
    due_date: 'Due Date',
    status: 'Status',
    delivery_action: 'Delivered'
  };

  const renderCellPastDue = (colKey, row) => {
    switch (colKey) {
      case 'work_order_number':
        return (
          <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ClipboardList size={14} color="#94a3b8" /> {row.work_order_number}</div>
          </td>
        );
      case 'wo_date': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatDdMmm(row.wo_date)}</td>;
      case 'assigned_to': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{row.assigned_to}</td>;
      case 'request_type':
        return (
          <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>
            <span className={`pill ${row.request_type?.toLowerCase() === 'bench' ? 'req-bench' : 'req-full'}`} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
              {row.request_type || '—'}
            </span>
          </td>
        );
      case 'tat': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{row.tat}</td>;
      case 'due_date': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatDdMmm(row.due_date)}</td>;
      case 'status':
        return (
          <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>
            <span className={`dash-status-badge ${getStatusClass(row.status)}`}>{row.status || '—'}</span>
          </td>
        );
      case 'delivery_action':
        const rowIdPastDue = `${row.work_order_number || ''}_${row.wo_date || ''}_${row.assigned_to || ''}_${row.hearing_date || ''}_${row.status || ''}`;
        return (
          <td key={colKey} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
            <input
              type="radio"
              id={`pd-del-yes-${rowIdPastDue}`}
              name={`pd-del-status-${rowIdPastDue}`}
              checked={false}
              onChange={() => handleDeliveryActionPastDue(row, 'delivered')}
              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981' }}
              title="Mark as Delivered"
            />
          </td>
        );
      default: return null;
    }
  };

  const handleDeliveryActionD2 = async (row, action) => {
    if (action === 'delivered') {
      const now = new Date();
      const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const yyyy = estDate.getFullYear();
      const mm = String(estDate.getMonth() + 1).padStart(2, '0');
      const dd = String(estDate.getDate()).padStart(2, '0');
      const todayEst = `${yyyy}-${mm}-${dd}`;

      try {
        let updateQuery = supabase
          .from('work_orders')
          .update({ delivery_date: todayEst })
          .eq('language', language);

        if (row.work_order_number) updateQuery = updateQuery.eq('work_order_number', row.work_order_number);
        else updateQuery = updateQuery.is('work_order_number', null);

        if (row.assigned_to) updateQuery = updateQuery.eq('assigned_to', row.assigned_to);
        else updateQuery = updateQuery.is('assigned_to', null);

        if (row.wo_date) updateQuery = updateQuery.eq('wo_date', row.wo_date);
        else updateQuery = updateQuery.is('wo_date', null);

        if (row.due_date) updateQuery = updateQuery.eq('due_date', row.due_date);
        else updateQuery = updateQuery.is('due_date', null);

        if (row.status) updateQuery = updateQuery.eq('status', row.status);
        else updateQuery = updateQuery.is('status', null);

        const { error: updateError } = await updateQuery;

        if (updateError) {
          alert(`Failed to update delivery date: ${updateError.message}`);
        } else {
          setReport2Data(prev => prev.map(item => {
            const match = item.work_order_number === row.work_order_number &&
              item.assigned_to === row.assigned_to &&
              item.wo_date === row.wo_date &&
              item.due_date === row.due_date &&
              item.status === row.status;
            return match ? { ...item, delivery_date: todayEst } : item;
          }));
        }
      } catch (err) {
        alert('An error occurred while updating the delivery date.');
      }
    }
  };

  const colLabelsD2 = { work_order_number: 'WO #', assigned_to: 'Assigned To', wo_date: 'WO Date', delivery_date: 'Delivery Date', status: 'Status', delivery_action: 'Delivered' };
  const renderCellD2 = (colKey, row) => {
    switch (colKey) {
      case 'work_order_number':
        return (
          <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ClipboardList size={14} color="#94a3b8" /> {row.work_order_number}</div>
          </td>
        );
      case 'assigned_to': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{row.assigned_to}</td>;
      case 'wo_date': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatDdMmm(row.wo_date)}</td>;
      case 'delivery_date': return <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatDdMmm(row.delivery_date)}</td>;
      case 'status':
        return (
          <td key={colKey} style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>
            <span className={`dash-status-badge ${getStatusClass(row.status)}`}>{row.status || '—'}</span>
          </td>
        );
      case 'delivery_action':
        const hasDeliveryDate = !!row.delivery_date;
        const rowId2 = `${row.work_order_number || ''}_${row.assigned_to || ''}_${row.wo_date || ''}_${row.due_date || ''}_${row.status || ''}`;
        return (
          <td key={colKey} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
            <input
              type="radio"
              id={`d2-del-yes-${rowId2}`}
              name={`d2-del-status-${rowId2}`}
              checked={hasDeliveryDate}
              disabled={hasDeliveryDate}
              onChange={() => handleDeliveryActionD2(row, 'delivered')}
              style={{ cursor: hasDeliveryDate ? 'default' : 'pointer', width: '16px', height: '16px', accentColor: '#10b981', opacity: hasDeliveryDate ? 0.6 : 1 }}
              title={hasDeliveryDate ? 'Delivered' : 'Mark as Delivered'}
            />
          </td>
        );
      default: return null;
    }
  };

  const colLabelsD3 = { work_order_number: 'WO #', assigned_to: 'Assigned To', wo_date: 'WO Date', due_date: 'Due', status: 'Status' };
  const renderCellD3 = (colKey, row) => {
    switch (colKey) {
      case 'work_order_number':
        return (
          <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={14} color="#94a3b8" /> {row.work_order_number}</div>
          </td>
        );
      case 'assigned_to': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.assigned_to}</td>;
      case 'wo_date': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatDdMmm(row.wo_date)}</td>;
      case 'due_date': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatDdMmm(row.due_date)}</td>;
      case 'status':
        return (
          <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>
            <span className={`dash-status-badge ${getStatusClass(row.status)}`}>{row.status || '—'}</span>
          </td>
        );
      default: return null;
    }
  };

  const colLabelsD4 = { work_order_number: 'WO #', assigned_to: 'Assigned To', request_type: 'Type', tat: 'TAT', totalSeconds: 'Total Audio Length' };
  const renderCellD4 = (colKey, row) => {
    switch (colKey) {
      case 'work_order_number':
        return (
          <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={14} color="#94a3b8" /> {row.work_order_number}</div>
          </td>
        );
      case 'assigned_to': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.assigned_to}</td>;
      case 'request_type':
        return (
          <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>
            <span className={`pill ${row.request_type?.toLowerCase() === 'bench' ? 'req-bench' : 'req-full'}`} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
              {row.request_type || '—'}
            </span>
          </td>
        );
      case 'tat': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.tat}</td>;
      case 'totalSeconds': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatSeconds(row.totalSeconds)}</td>;
      default: return null;
    }
  };

  const colLabelsD5 = { assigned_to: 'Assigned To', request_type: 'Request Type', totalSeconds: 'Total Audio Length' };
  const renderCellD5 = (colKey, row) => {
    switch (colKey) {
      case 'assigned_to': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>{row.assigned_to}</td>;
      case 'request_type': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.request_type}</td>;
      case 'totalSeconds': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatSeconds(row.totalSeconds)}</td>;
      default: return null;
    }
  };

  const colLabelsD6 = { wo_date: 'WO Date', assigned_to: 'Assigned To', tat: 'TAT', request_type: 'Type', totalSeconds: 'Audio Length' };
  const renderCellD6 = (colKey, row) => {
    switch (colKey) {
      case 'wo_date': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatDdMmm(row.wo_date)}</td>;
      case 'assigned_to': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.assigned_to}</td>;
      case 'tat': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.tat}</td>;
      case 'request_type':
        return (
          <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>
            <span className={`pill ${row.request_type?.toLowerCase() === 'bench' ? 'req-bench' : 'req-full'}`} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
              {row.request_type || '—'}
            </span>
          </td>
        );
      case 'totalSeconds': return <td key={colKey} style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatSeconds(row.totalSeconds)}</td>;
      default: return null;
    }
  };

  const filtersReady = language && selectedDate;
  const monthlyFiltersReady = monthlyLanguage && monthlyMonth && monthlyYear;

  // Set today's date in EST timezone on mount
  useEffect(() => {
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const yyyy = estDate.getFullYear();
    const mm = String(estDate.getMonth() + 1).padStart(2, '0');
    const dd = String(estDate.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Fetch reports when filters change
  useEffect(() => {
    if (!filtersReady) {
      setReport1Data([]);
      setReport2Data([]);
      setReport3Data([]);
      setReport4Data([]);
      setReport5Data([]);
      setReport6Data([]);
      setReport5GrandTotal(0);
      return;
    }

    // Report 1: Done – Not yet Delivered
    const fetchReport1 = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('id, wo_date, work_order_number, due_date, tat, assigned_to, status')
          .eq('language', language)
          .is('delivery_date', null)
          .eq('status', 'Done')
          .order('wo_date', { ascending: true });

        if (fetchError) {
          setError(fetchError.message);
          setReport1Data([]);
        } else {
          // Group by 5 columns: work_order_number, assigned_to, wo_date, due_date, status
          const seen = new Map();
          (data || []).forEach(row => {
            const key = `${row.work_order_number || ''}|${row.assigned_to || ''}|${row.wo_date || ''}|${row.due_date || ''}|${row.status || ''}`;
            if (!seen.has(key)) seen.set(key, row);
          });
          const uniqueData = Array.from(seen.values());
          const sortedData = uniqueData.sort((a, b) => {
            const timeDiff = new Date(a.wo_date).getTime() - new Date(b.wo_date).getTime();
            if (timeDiff !== 0) return timeDiff;
            return (a.work_order_number || '').localeCompare(b.work_order_number || '');
          });
          setReport1Data(sortedData);
        }
      } catch (err) {
        setError('Failed to fetch report data.');
      }
      setLoading(false);
    };

    // Past Due Date Report
    const fetchReportPastDue = async () => {
      setLoadingPastDue(true);
      setErrorPastDue(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('id, wo_date, work_order_number, due_date, tat, assigned_to, status, request_type, hearing_date')
          .eq('language', language)
          .lt('due_date', selectedDate)
          .is('delivery_date', null)
          .in('status', ['Done', 'In Process', 'Pending'])
          .order('due_date', { ascending: true });

        if (fetchError) {
          setErrorPastDue(fetchError.message);
          setReportPastDueData([]);
        } else {
          // Group by requested columns: work_order_number, wo_date, assigned_to, hearing_date, status
          const seen = new Map();
          (data || []).forEach(row => {
            const key = `${row.work_order_number || ''}|${row.wo_date || ''}|${row.assigned_to || ''}|${row.hearing_date || ''}|${row.status || ''}`;
            if (!seen.has(key)) seen.set(key, row);
          });
          const uniqueData = Array.from(seen.values());
          const sortedData = uniqueData.sort((a, b) => {
            const timeDiff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            if (timeDiff !== 0) return timeDiff;
            return (a.work_order_number || '').localeCompare(b.work_order_number || '');
          });
          setReportPastDueData(sortedData);
        }
      } catch (err) {
        setErrorPastDue('Failed to fetch past due report data.');
      }
      setLoadingPastDue(false);
    };

    // Report 2: Work Order Due Today
    const fetchReport2 = async () => {
      setLoading2(true);
      setError2(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('wo_date, work_order_number, due_date, delivery_date, status, assigned_to')
          .eq('language', language)
          .eq('due_date', selectedDate)
          .order('wo_date', { ascending: true });

        if (fetchError) {
          setError2(fetchError.message);
          setReport2Data([]);
        } else {
          // Group by 5 columns: work_order_number, assigned_to, wo_date, due_date, status
          const seen = new Map();
          (data || []).forEach(row => {
            const key = `${row.work_order_number || ''}|${row.assigned_to || ''}|${row.wo_date || ''}|${row.due_date || ''}|${row.status || ''}`;
            if (!seen.has(key)) seen.set(key, row);
          });
          const uniqueData = Array.from(seen.values());
          const sortedData = uniqueData.sort((a, b) => {
            const timeDiff = new Date(a.wo_date).getTime() - new Date(b.wo_date).getTime();
            if (timeDiff !== 0) return timeDiff;
            return (a.work_order_number || '').localeCompare(b.work_order_number || '');
          });
          setReport2Data(sortedData);
        }
      } catch (err) {
        setError2('Failed to fetch report data.');
      }
      setLoading2(false);
    };

    // Report 3: Work Order Delivered Today
    const fetchReport3 = async () => {
      setLoading3(true);
      setError3(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('wo_date, work_order_number, due_date, status, assigned_to')
          .eq('language', language)
          .eq('delivery_date', selectedDate)
          .order('wo_date', { ascending: true });

        if (fetchError) {
          setError3(fetchError.message);
          setReport3Data([]);
        } else {
          // Group by 5 columns: work_order_number, assigned_to, wo_date, due_date, status
          const seen = new Map();
          (data || []).forEach(row => {
            const key = `${row.work_order_number || ''}|${row.assigned_to || ''}|${row.wo_date || ''}|${row.due_date || ''}|${row.status || ''}`;
            if (!seen.has(key)) seen.set(key, row);
          });
          const uniqueData = Array.from(seen.values());
          const sortedData = uniqueData.sort((a, b) => {
            const timeDiff = new Date(a.wo_date).getTime() - new Date(b.wo_date).getTime();
            if (timeDiff !== 0) return timeDiff;
            return (a.work_order_number || '').localeCompare(b.work_order_number || '');
          });
          setReport3Data(sortedData);
        }
      } catch (err) {
        setError3('Failed to fetch report data.');
      }
      setLoading3(false);
    };

    // Report 4: Work Order Assigned on [date] — grouped by WO# with combined audio
    const fetchReport4 = async () => {
      setLoading4(true);
      setError4(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('work_order_number, tat, assigned_to, audio_length, request_type, wo_date, due_date, status')
          .eq('language', language)
          .eq('wo_date', selectedDate)
          .order('work_order_number', { ascending: true });

        if (fetchError) {
          setError4(fetchError.message);
          setReport4Data([]);
          setReport4BenchSeconds(0);
          setReport4FullSeconds(0);
          setReport4TotalSeconds(0);
          setReport4TotalRecords(0);
        } else {
          let benchSecs = 0;
          let fullSecs = 0;

          (data || []).forEach((row) => {
            const secs = parseAudioToSeconds(row.audio_length);
            const reqType = (row.request_type || '').toLowerCase();
            if (reqType === 'bench') {
              benchSecs += secs;
            } else {
              fullSecs += secs;
            }
          });

          const totalSecs = benchSecs + fullSecs;
          const totalRecs = (data || []).length;

          setReport4BenchSeconds(benchSecs);
          setReport4FullSeconds(fullSecs);
          setReport4TotalSeconds(totalSecs);
          setReport4TotalRecords(totalRecs);

          // Group by WO#, assigned_to, request_type, tat, wo_date, due_date, status
          const grouped = {};
          (data || []).forEach((row) => {
            const key = `${row.work_order_number || ''}|${row.assigned_to || ''}|${row.request_type || ''}|${row.tat || ''}|${row.wo_date || ''}|${row.due_date || ''}|${row.status || ''}`;
            if (!grouped[key]) {
              grouped[key] = {
                work_order_number: row.work_order_number,
                assigned_to: row.assigned_to,
                wo_date: row.wo_date,
                due_date: row.due_date,
                status: row.status,
                tat: row.tat,
                request_type: row.request_type,
                totalSeconds: 0,
              };
            }
            grouped[key].totalSeconds += parseAudioToSeconds(row.audio_length);
          });
          setReport4Data(Object.values(grouped));
        }
      } catch (err) {
        setError4('Failed to fetch report data.');
      }
      setLoading4(false);
    };

    // Report 6: Pending (status = 'Pending', created_at < now() - 24h)
    const fetchReport6 = async () => {
      setLoading6(true);
      setError6(null);
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('wo_date, assigned_to, tat, request_type, audio_length')
          .eq('language', language)
          .eq('status', 'Pending')
          .lt('created_at', oneDayAgo);

        if (fetchError) {
          setError6(fetchError.message);
          setReport6Data([]);
        } else {
          // Group the records based on the combination of wo_date, assigned_to, tat, and request_type
          const grouped = {};
          (data || []).forEach((row) => {
            const key = `${row.wo_date || ''}_${row.assigned_to || ''}_${row.tat || ''}_${row.request_type || ''}`;
            if (!grouped[key]) {
              grouped[key] = {
                wo_date: row.wo_date,
                assigned_to: row.assigned_to,
                tat: row.tat,
                request_type: row.request_type,
                totalSeconds: 0,
              };
            }
            grouped[key].totalSeconds += parseAudioToSeconds(row.audio_length);
          });

          // Sort grouped records by wo_date asc, then assigned_to asc, then tat, then request_type
          const sortedData = Object.values(grouped).sort((a, b) => {
            const dateDiff = new Date(a.wo_date || 0).getTime() - new Date(b.wo_date || 0).getTime();
            if (dateDiff !== 0) return dateDiff;
            const assignDiff = (a.assigned_to || '').localeCompare(b.assigned_to || '');
            if (assignDiff !== 0) return assignDiff;
            const tatDiff = (a.tat || 0) - (b.tat || 0);
            if (tatDiff !== 0) return tatDiff;
            return (a.request_type || '').localeCompare(b.request_type || '');
          });

          setReport6Data(sortedData);
        }
      } catch (err) {
        setError6('Failed to fetch report data.');
      }
      setLoading6(false);
    };

    fetchReport1();
    fetchReportPastDue();
    fetchReport2();
    fetchReport3();
    fetchReport4();
    fetchReport6();
  }, [language, selectedDate, filtersReady]);

  // Fetch Monthly reports when monthly filters change
  useEffect(() => {
    if (!monthlyFiltersReady) {
      setMonthlyReport1Data([]);
      setMonthlyReport2Data([]);
      return;
    }

    const fetchMonthlyReport1 = async () => {
      setLoadingM1(true);
      setErrorM1(null);
      try {
        const yyyy = String(monthlyYear);
        const mm = String(monthlyMonth).padStart(2, '0');
        const lastDayNum = new Date(monthlyYear, monthlyMonth, 0).getDate();
        const dd = String(lastDayNum).padStart(2, '0');

        const startDate = `${yyyy}-${mm}-01`;
        const endDate = `${yyyy}-${mm}-${dd}`;

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
            .select('region, assigned_to, audio_length, word_count, character_wz_space, line_count')
            .eq('language', monthlyLanguage)
            .gte('due_date', startDate)
            .lte('due_date', endDate)
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
          setErrorM1(fetchError.message);
          setMonthlyReport1Data([]);
          setMonthlyReport2Data([]);
        } else {
          const groupedRegion = {};
          const groupedAssignee = {};

          (allData || []).forEach((row) => {
            const region = row.region || 'Unknown';
            const assignee = row.assigned_to || 'Unassigned';
            
            const audioSecs = parseAudioToSeconds(row.audio_length);
            const wordCount = parseInt(row.word_count, 10) || 0;
            const charSpace = parseInt(row.character_wz_space, 10) || 0;
            const lineCount = parseInt(row.line_count, 10) || 0;

            // Group by Region
            if (!groupedRegion[region]) {
              groupedRegion[region] = {
                region,
                audioSeconds: 0,
                wordCount: 0,
                characterSpace: 0,
                lineCount: 0
              };
            }
            groupedRegion[region].audioSeconds += audioSecs;
            groupedRegion[region].wordCount += wordCount;
            groupedRegion[region].characterSpace += charSpace;
            groupedRegion[region].lineCount += lineCount;

            // Group by Assignee
            if (!groupedAssignee[assignee]) {
              groupedAssignee[assignee] = {
                assigned_to: assignee,
                audioSeconds: 0,
                wordCount: 0,
                characterSpace: 0,
                lineCount: 0
              };
            }
            groupedAssignee[assignee].audioSeconds += audioSecs;
            groupedAssignee[assignee].wordCount += wordCount;
            groupedAssignee[assignee].characterSpace += charSpace;
            groupedAssignee[assignee].lineCount += lineCount;
          });

          setMonthlyReport1Data(Object.values(groupedRegion));
          setMonthlyReport2Data(Object.values(groupedAssignee).sort((a,b) => b.audioSeconds - a.audioSeconds));
        }
      } catch (err) {
        setErrorM1('Failed to fetch monthly report data.');
      }
      setLoadingM1(false);
    };

    fetchMonthlyReport1();
  }, [monthlyLanguage, monthlyMonth, monthlyYear, monthlyFiltersReady]);

  // Fetch Monthly Report 3: Yearly audio length by month
  useEffect(() => {
    if (!monthlyLanguage || !monthlyYear) {
      setMonthlyReport3Data([]);
      return;
    }

    const fetchMonthlyReport3 = async () => {
      setLoadingM3(true);
      setErrorM3(null);
      try {
        const startDate = `${monthlyYear}-01-01`;
        const endDate = `${monthlyYear}-12-31`;

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
            .select('due_date, audio_length')
            .eq('language', monthlyLanguage)
            .gte('due_date', startDate)
            .lte('due_date', endDate)
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
          setErrorM3(fetchError.message);
          setMonthlyReport3Data([]);
        } else {
          // Initialize 12 months array
          const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
            monthIndex: i,
            monthName: new Date(2000, i, 1).toLocaleString('default', { month: 'short' }),
            audioSeconds: 0
          }));

          (allData || []).forEach(row => {
            if (row.due_date && row.audio_length) {
              const parts = row.due_date.split('-');
              if (parts.length >= 2) {
                const mIdx = parseInt(parts[1], 10) - 1;
                if (mIdx >= 0 && mIdx < 12) {
                  monthlyTotals[mIdx].audioSeconds += parseAudioToSeconds(row.audio_length);
                }
              }
            }
          });

          setMonthlyReport3Data(monthlyTotals);
        }
      } catch (err) {
        setErrorM3('Failed to fetch yearly report data.');
      }
      setLoadingM3(false);
    };

    fetchMonthlyReport3();
  }, [monthlyLanguage, monthlyYear]);

  // Fetch Monthly Report 5: 5-month rolling window (Month-3 to Month+1)
  useEffect(() => {
    if (!monthlyLanguage || !monthlyMonth || !monthlyYear) {
      setMonthlyReport5Data([]);
      return;
    }

    const fetchMonthlyReport5 = async () => {
      setLoadingM5(true);
      setErrorM5(null);
      try {
        // Start date: 3 months before selected month
        const startMonthObj = new Date(monthlyYear, monthlyMonth - 1 - 3, 1);
        const startY = startMonthObj.getFullYear();
        const startM = String(startMonthObj.getMonth() + 1).padStart(2, '0');
        const startDate = `${startY}-${startM}-01`;

        // End date: 1 month after selected month (last day of that month)
        const endMonthObj = new Date(monthlyYear, monthlyMonth - 1 + 1, 1);
        const endY = endMonthObj.getFullYear();
        const endM = endMonthObj.getMonth() + 1;
        const endLastDay = new Date(endY, endM, 0).getDate();
        const endDate = `${endY}-${String(endM).padStart(2, '0')}-${String(endLastDay).padStart(2, '0')}`;

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
            .select('due_date, audio_length, word_count, character_wz_space, line_count')
            .eq('language', monthlyLanguage)
            .gte('due_date', startDate)
            .lte('due_date', endDate)
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
          setErrorM5(fetchError.message);
          setMonthlyReport5Data([]);
        } else {
          // Initialize the 5 months array
          const monthsArray = [];
          for (let i = -3; i <= 1; i++) {
            const d = new Date(monthlyYear, monthlyMonth - 1 + i, 1);
            const mYear = d.getFullYear();
            const mMonth = d.getMonth() + 1; // 1-12
            const monthStr = d.toLocaleString('default', { month: 'short' });
            
            monthsArray.push({
              key: `${mYear}-${mMonth}`,
              displayMonth: `${monthStr}-${mYear}`,
              isCurrentMonth: i === 0,
              audioSeconds: 0,
              wordCount: 0,
              characterSpace: 0,
              lineCount: 0
            });
          }

          (allData || []).forEach(row => {
            if (!row.due_date) return;
            const parts = row.due_date.split('-');
            if (parts.length >= 2) {
              const y = parseInt(parts[0], 10);
              const m = parseInt(parts[1], 10);
              const key = `${y}-${m}`;
              
              const targetMonth = monthsArray.find(item => item.key === key);
              if (targetMonth) {
                if (row.audio_length) {
                  targetMonth.audioSeconds += parseAudioToSeconds(row.audio_length);
                }
                targetMonth.wordCount += Number(row.word_count) || 0;
                targetMonth.characterSpace += Number(row.character_wz_space) || 0;
                targetMonth.lineCount += Number(row.line_count) || 0;
              }
            }
          });

          setMonthlyReport5Data(monthsArray);
        }
      } catch (err) {
        setErrorM5('Failed to fetch rolling monthly report data.');
      }
      setLoadingM5(false);
    };

    fetchMonthlyReport5();
  }, [monthlyLanguage, monthlyMonth, monthlyYear]);

  const maxAudioSeconds = Math.max(...monthlyReport3Data.map(d => d.audioSeconds), 1);
  const sortedWordCountData = [...monthlyReport2Data].sort((a, b) => b.wordCount - a.wordCount);
  const maxWordCount = Math.max(...sortedWordCountData.map(d => d.wordCount), 1);
  const monthNameStr = new Date(0, monthlyMonth - 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="page-container">
      <h1 className="page-title" style={{ marginBottom: '1.5rem' }}>Dashboard</h1>
      
      {/* Toggle Panel */}
      <div style={{ 
        display: 'flex', 
        background: '#f1f5f9', 
        padding: '4px', 
        borderRadius: '8px',
        gap: '4px',
        width: 'fit-content',
        marginBottom: '1.5rem'
      }}>
          <button
            onClick={() => setReportMode('daily')}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: '6px',
              background: reportMode === 'daily' ? '#fff' : 'transparent',
              color: reportMode === 'daily' ? '#0f172a' : '#64748b',
              fontWeight: reportMode === 'daily' ? '600' : '500',
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: reportMode === 'daily' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Daily
          </button>
          <button
            onClick={() => setReportMode('monthly')}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: '6px',
              background: reportMode === 'monthly' ? '#fff' : 'transparent',
              color: reportMode === 'monthly' ? '#0f172a' : '#64748b',
              fontWeight: reportMode === 'monthly' ? '600' : '500',
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: reportMode === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Monthly
          </button>
      </div>

      {reportMode === 'monthly' ? (
        <>
          {/* ===== Monthly Filters Strip ===== */}
          <div className="dashboard-filters">
            {/* Language Radio */}
            <div className="dashboard-filter-group">
              <span className="dashboard-filter-label">Language</span>
              <div className="dashboard-radio-group">
                <div className="dashboard-radio-option">
                  <input
                    type="radio"
                    id="dash-monthly-en"
                    name="dashboard-monthly-language"
                    value="EN"
                    checked={monthlyLanguage === 'EN'}
                    onChange={(e) => setMonthlyLanguage(e.target.value)}
                  />
                  <label htmlFor="dash-monthly-en">EN English</label>
                </div>
                <div className="dashboard-radio-option">
                  <input
                    type="radio"
                    id="dash-monthly-fr"
                    name="dashboard-monthly-language"
                    value="FR"
                    checked={monthlyLanguage === 'FR'}
                    onChange={(e) => setMonthlyLanguage(e.target.value)}
                  />
                  <label htmlFor="dash-monthly-fr">FR French</label>
                </div>
              </div>
            </div>

            {/* Month Dropdown */}
            <div className="dashboard-filter-group">
              <span className="dashboard-filter-label">Month</span>
              <select 
                className="dashboard-select"
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem', outline: 'none' }}
                value={monthlyMonth}
                onChange={(e) => setMonthlyMonth(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i+1} value={i+1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Dropdown */}
            <div className="dashboard-filter-group">
              <span className="dashboard-filter-label">Year</span>
              <select
                className="dashboard-select"
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem', outline: 'none' }}
                value={monthlyYear}
                onChange={(e) => setMonthlyYear(parseInt(e.target.value, 10))}
              >
                <option value={currentYear - 1}>{currentYear - 1}</option>
                <option value={currentYear}>{currentYear}</option>
                <option value={currentYear + 1}>{currentYear + 1}</option>
              </select>
            </div>
            
            {/* Selection summary pill */}
            {monthlyFiltersReady && (
              <div className="dashboard-selection-summary">
                <span className="dashboard-selection-dot" />
                {monthlyLanguage === 'EN' ? 'English' : 'French'} · {new Date(0, monthlyMonth - 1).toLocaleString('default', { month: 'short' })} {monthlyYear}
              </div>
            )}
          </div>

          {/* ===== Monthly Reports Kanban ===== */}
          {!monthlyFiltersReady ? (
            <div className="dashboard-prompt">
              <div className="dashboard-prompt-icon">
                <BarChart3 size={32} />
              </div>
              <h3>Select filters to view dashboard</h3>
              <p>Choose a language, month, and year above to generate the monthly dashboard report cards.</p>
            </div>
          ) : (
            <div className="dashboard-kanban" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
              {/* Monthly Report 1: Metrics by Region */}
              <div className="work-order-card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #14b8a6', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#1e293b' }}>
                    Metrics by Region
                  </h3>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#ccfbf1', color: '#0f766e', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                    <BarChart3 size={14} />
                    {loadingM1 ? '…' : monthlyReport1Data.length} Regions
                  </span>
                </div>
                <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
                  {loadingM1 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p>Loading report data…</p>
                    </div>
                  ) : errorM1 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p style={{ color: '#dc2626' }}>{errorM1}</p>
                    </div>
                  ) : monthlyReport1Data.length === 0 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <BarChart3 size={28} color="#94a3b8" />
                      <p>No data for this month.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            {colOrderM1.map(colKey => renderSortHeader(colLabelsM1[colKey], colKey, sortM1, setSortM1, colOrderM1, setColOrderM1))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortTableData(monthlyReport1Data, sortM1).map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: idx === monthlyReport1Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                              {colOrderM1.map(colKey => renderCellM1(colKey, row))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Report 2: By Assignee */}
              <div className="work-order-card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #eab308', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#1e293b' }}>
                    Metrics by Assignee
                  </h3>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#fef3c7', color: '#a16207', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                    <BarChart3 size={14} />
                    {loadingM1 ? '…' : monthlyReport2Data.length} Assignees
                  </span>
                </div>
                <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
                  {loadingM1 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p>Loading report data…</p>
                    </div>
                  ) : errorM1 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p style={{ color: '#dc2626' }}>{errorM1}</p>
                    </div>
                  ) : monthlyReport2Data.length === 0 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <BarChart3 size={28} color="#94a3b8" />
                      <p>No data for this month.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            {colOrderM2.map(colKey => renderSortHeader(colLabelsM2[colKey], colKey, sortM2, setSortM2, colOrderM2, setColOrderM2))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortTableData(monthlyReport2Data, sortM2).map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: idx === monthlyReport2Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                              {colOrderM2.map(colKey => renderCellM2(colKey, row))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Report 4: Word Count by Assignee (Horizontal Bar) */}
              <div className="work-order-card" style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #f97316', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#1e293b' }}>
                    {monthNameStr} {monthlyYear} Word Count
                  </h3>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#ffedd5', color: '#c2410c', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                    <BarChart3 size={14} />
                    {loadingM1 ? '…' : sortedWordCountData.length} Assignees
                  </span>
                </div>
                <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
                  {loadingM1 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p>Loading report data…</p>
                    </div>
                  ) : errorM1 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p style={{ color: '#dc2626' }}>{errorM1}</p>
                    </div>
                  ) : sortedWordCountData.length === 0 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <BarChart3 size={28} color="#94a3b8" />
                      <p>No data for this month.</p>
                    </div>
                  ) : (
                    <div className="horizontal-bar-chart" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                      {sortedWordCountData.map((d, i) => {
                        const widthPercent = Math.max((d.wordCount / maxWordCount) * 100, 1); // Min 1% to show a sliver
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                            {/* Name Label */}
                            <div style={{ width: '120px', textAlign: 'right', paddingRight: '16px', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                              {d.assigned_to}
                            </div>
                            {/* Bar Track */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                              <div style={{ 
                                width: d.wordCount > 0 ? `${widthPercent}%` : '0%', 
                                height: '24px', 
                                backgroundColor: '#f97316', 
                                borderRadius: '0 4px 4px 0', 
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                position: 'relative'
                              }} />
                              {/* Value Label */}
                              <span style={{ marginLeft: '12px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                {d.wordCount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Report 3: Yearly Audio Length Bar Chart */}
              <div className="work-order-card" style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #3b82f6', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#1e293b' }}>
                    {monthlyYear} Monthly Audio Length
                  </h3>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                    <BarChart3 size={14} />
                    {loadingM3 ? '…' : monthlyReport3Data.length} Months
                  </span>
                </div>
                <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
                  {loadingM3 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p>Loading chart data…</p>
                    </div>
                  ) : errorM3 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p style={{ color: '#dc2626' }}>{errorM3}</p>
                    </div>
                  ) : monthlyReport3Data.length === 0 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <BarChart3 size={28} color="#94a3b8" />
                      <p>No data for this year.</p>
                    </div>
                  ) : (
                    <div className="css-bar-chart-container" style={{ background: '#fff', padding: '2rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                      <div className="css-bar-chart-bars">
                        {monthlyReport3Data.map((d, i) => {
                          const heightPercent = Math.max((d.audioSeconds / maxAudioSeconds) * 100, 2); // Min 2% height so it's visible
                          return (
                            <div className="css-bar-wrapper" key={i}>
                              <div className="css-bar-value" style={{ opacity: d.audioSeconds > 0 ? undefined : 0, color: '#1e293b', fontWeight: 600 }}>
                                {d.audioSeconds > 0 ? formatSeconds(d.audioSeconds) : ''}
                              </div>
                              <div className="css-bar-fill-container">
                                <div 
                                  className="css-bar-fill" 
                                  style={{ height: `${d.audioSeconds > 0 ? heightPercent : 0}%`, backgroundColor: '#3b82f6', borderRadius: '4px 4px 0 0' }}
                                ></div>
                              </div>
                              <div className="css-bar-label" style={{ fontWeight: 600, color: '#475569' }}>{d.monthName}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Report 5: Rolling 5-Month Metrics */}
              <div className="work-order-card" style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #8b5cf6', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#1e293b' }}>
                    Monthly Rolling Metrics
                  </h3>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#ede9fe', color: '#6d28d9', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                    <BarChart3 size={14} />
                    {loadingM5 ? '…' : monthlyReport5Data.length} Months
                  </span>
                </div>
                <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
                  {loadingM5 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p>Loading report data…</p>
                    </div>
                  ) : errorM5 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p style={{ color: '#dc2626' }}>{errorM5}</p>
                    </div>
                  ) : monthlyReport5Data.length === 0 ? (
                    <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <BarChart3 size={28} color="#94a3b8" />
                      <p>No data for these months.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            {colOrderM5.map(colKey => renderSortHeader(colLabelsM5[colKey], colKey, sortM5, setSortM5, colOrderM5, setColOrderM5))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortTableData(monthlyReport5Data, sortM5).map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: idx === monthlyReport5Data.length - 1 ? 'none' : '1px solid #f1f5f9', backgroundColor: row.isCurrentMonth ? '#fdf4ff' : 'transparent' }}>
                              {colOrderM5.map(colKey => renderCellM5(colKey, row))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* ===== Filter Strip ===== */}
          <div className="dashboard-filters">
        {/* Language Radio */}
        <div className="dashboard-filter-group">
          <span className="dashboard-filter-label">Language</span>
          <div className="dashboard-radio-group">
            <div className="dashboard-radio-option">
              <input
                type="radio"
                id="dash-lang-en"
                name="dashboard-language"
                value="EN"
                checked={language === 'EN'}
                onChange={(e) => setLanguage(e.target.value)}
              />
              <label htmlFor="dash-lang-en">EN English</label>
            </div>
            <div className="dashboard-radio-option">
              <input
                type="radio"
                id="dash-lang-fr"
                name="dashboard-language"
                value="FR"
                checked={language === 'FR'}
                onChange={(e) => setLanguage(e.target.value)}
              />
              <label htmlFor="dash-lang-fr">🇫🇷 French</label>
            </div>
          </div>
        </div>

        {/* Date Picker */}
        <div className="dashboard-filter-group">
          <span className="dashboard-filter-label">Date</span>
          <input
            type="date"
            className="dashboard-date-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {/* Selection summary pill */}
        {filtersReady && (
          <div className="dashboard-selection-summary">
            <span className="dashboard-selection-dot" />
            {language === 'EN' ? 'English' : 'French'} · {formatDdMmm(selectedDate)}
          </div>
        )}
      </div>

      {/* ===== Reports Kanban ===== */}
      {!filtersReady ? (
        <div className="dashboard-prompt">
          <div className="dashboard-prompt-icon">
            <BarChart3 size={32} />
          </div>
          <h3>Select filters to view dashboard</h3>
          <p>Choose a language and a date above to generate the dashboard report cards.</p>
        </div>
      ) : (
        <div className="dashboard-kanban" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
          {/* ===== Report 1: Done – Not yet Delivered ===== */}
          <div className="work-order-card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #10b981', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); navigate(`/records?report=1&date=${selectedDate}&lang=${language}`); }} 
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.5rem 1.1rem',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '13px',
                    fontWeight: '700',
                    background: 'var(--subtle)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '.5px solid var(--border)'
                  }} 
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--hover)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                  }} 
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--subtle)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Done - Not Delivered
                </a>
              </h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#d1fae5', color: '#047857', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                <Inbox size={14} />
                {loading ? '…' : report1Data.length} Records
              </span>
            </div>
            <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
              {loading ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p>Loading report data…</p>
                </div>
              ) : error ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p style={{ color: '#dc2626' }}>{error}</p>
                </div>
              ) : report1Data.length === 0 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <Inbox size={28} color="#94a3b8" />
                  <p>No records match the criteria.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {colOrderD1.map(colKey => renderSortHeader(colLabelsD1[colKey], colKey, sortD1, setSortD1, colOrderD1, setColOrderD1))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortTableData(report1Data, sortD1).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report1Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          {colOrderD1.map(colKey => renderCellD1(colKey, row))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ===== Report: Past Due Date ===== */}
          <div className="work-order-card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #ef4444', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); navigate(`/records?report=past_due&date=${selectedDate}&lang=${language}`); }} 
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.5rem 1.1rem',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '13px',
                    fontWeight: '700',
                    background: 'var(--subtle)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '.5px solid var(--border)'
                  }} 
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--hover)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                  }} 
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--subtle)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Past Due Date
                </a>
              </h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                <Clock size={14} />
                {loadingPastDue ? '…' : reportPastDueData.length} Records
              </span>
            </div>
            <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
              {loadingPastDue ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p>Loading report data…</p>
                </div>
              ) : errorPastDue ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p style={{ color: '#dc2626' }}>{errorPastDue}</p>
                </div>
              ) : reportPastDueData.length === 0 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <Clock size={28} color="#94a3b8" />
                  <p>No past due records found.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {colOrderPastDue.map(colKey => renderSortHeader(colLabelsPastDue[colKey], colKey, sortPastDue, setSortPastDue, colOrderPastDue, setColOrderPastDue))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortTableData(reportPastDueData, sortPastDue).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === reportPastDueData.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          {colOrderPastDue.map(colKey => renderCellPastDue(colKey, row))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ===== Report 2: Work Order Due Today ===== */}
          <div className="work-order-card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #f59e0b', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); navigate(`/records?report=2&date=${selectedDate}&lang=${language}`); }} 
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.5rem 1.1rem',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '13px',
                    fontWeight: '700',
                    background: 'var(--subtle)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '.5px solid var(--border)'
                  }} 
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--hover)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                  }} 
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--subtle)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Due {formatDdMmm(selectedDate)}
                </a>
              </h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#fef3c7', color: '#b45309', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                <CalendarCheck size={14} />
                {loading2 ? '…' : report2Data.length} Records
              </span>
            </div>
            <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
              {loading2 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p>Loading report data…</p>
                </div>
              ) : error2 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p style={{ color: '#dc2626' }}>{error2}</p>
                </div>
              ) : report2Data.length === 0 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <CalendarCheck size={28} color="#94a3b8" />
                  <p>No work orders due on this date.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {colOrderD2.map(colKey => renderSortHeader(colLabelsD2[colKey], colKey, sortD2, setSortD2, colOrderD2, setColOrderD2))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortTableData(report2Data, sortD2).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report2Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          {colOrderD2.map(colKey => renderCellD2(colKey, row))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ===== Report 3: Work Order Delivered Today ===== */}
          <div className="work-order-card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #3b82f6', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); navigate(`/records?report=3&date=${selectedDate}&lang=${language}`); }} 
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.5rem 1.1rem',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '13px',
                    fontWeight: '700',
                    background: 'var(--subtle)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '.5px solid var(--border)'
                  }} 
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--hover)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                  }} 
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--subtle)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Delivered {formatDdMmm(selectedDate)}
                </a>
              </h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                <Truck size={14} />
                {loading3 ? '…' : report3Data.length} Records
              </span>
            </div>
            <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
              {loading3 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p>Loading report data…</p>
                </div>
              ) : error3 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p style={{ color: '#dc2626' }}>{error3}</p>
                </div>
              ) : report3Data.length === 0 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <Truck size={28} color="#94a3b8" />
                  <p>No work orders delivered on this date.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {colOrderD3.map(colKey => renderSortHeader(colLabelsD3[colKey], colKey, sortD3, setSortD3, colOrderD3, setColOrderD3))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortTableData(report3Data, sortD3).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report3Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          {colOrderD3.map(colKey => renderCellD3(colKey, row))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ===== Report 4: Work Order Assigned on [date] ===== */}
          <div className="work-order-card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #8b5cf6', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); navigate(`/records?report=4&date=${selectedDate}&lang=${language}`); }} 
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.5rem 1.1rem',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '13px',
                    fontWeight: '700',
                    background: 'var(--subtle)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '.5px solid var(--border)'
                  }} 
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--hover)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                  }} 
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--subtle)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Assigned {formatDdMmm(selectedDate)}
                </a>
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#fef3c7', color: '#b45309', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                  Bench {formatSeconds(report4BenchSeconds)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                  Full {formatSeconds(report4FullSeconds)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#f3e8ff', color: '#6b21a8', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                  Total {formatSeconds(report4TotalSeconds)}
                </span>

                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#ede9fe', color: '#6d28d9', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                  <Clock size={14} />
                  {loading4 ? '…' : report4TotalRecords} Records
                </span>
              </div>
            </div>
            <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
              {loading4 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p>Loading report data…</p>
                </div>
              ) : error4 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p style={{ color: '#dc2626' }}>{error4}</p>
                </div>
              ) : report4TotalRecords === 0 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <Clock size={28} color="#94a3b8" />
                  <p>No work orders assigned on this date.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {colOrderD4.map(colKey => renderSortHeader(colLabelsD4[colKey], colKey, sortD4, setSortD4, colOrderD4, setColOrderD4))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortTableData(report4Data, sortD4).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report4Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          {colOrderD4.map(colKey => renderCellD4(colKey, row))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ===== Report 6: Pending (status = 'Pending', created_at < now() - 24h) ===== */}
          <div className="work-order-card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #ef4444', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); navigate(`/records?report=6&lang=${language}`); }} 
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.5rem 1.1rem',
                    borderRadius: 'var(--r-sm)',
                    fontSize: '13px',
                    fontWeight: '700',
                    background: 'var(--subtle)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '.5px solid var(--border)'
                  }} 
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--hover)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                  }} 
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--subtle)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Pending
                </a>
              </h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                <Clock size={14} />
                {loading6 ? '…' : report6Data.length} Groups
              </span>
            </div>
            <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
              {loading6 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p>Loading report data…</p>
                </div>
              ) : error6 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p style={{ color: '#dc2626' }}>{error6}</p>
                </div>
              ) : report6Data.length === 0 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <Clock size={28} color="#94a3b8" />
                  <p>No pending work orders match the criteria.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {colOrderD6.map(colKey => renderSortHeader(colLabelsD6[colKey], colKey, sortD6, setSortD6, colOrderD6, setColOrderD6))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortTableData(report6Data, sortD6).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report6Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          {colOrderD6.map(colKey => renderCellD6(colKey, row))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
        </>
      )}
    </div>
  );
}
