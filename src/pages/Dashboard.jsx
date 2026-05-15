import { useState, useEffect, useMemo } from 'react';
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
  if (s === 'in progress' || s === 'in process') return 'dash-status-inprogress';
  if (s === 'pending') return 'dash-status-pending';
  return '';
};
// Helper for monthly region badge color
const getRegionStyle = (region) => {
  const r = (region || '').toLowerCase();
  if (r === 'eastern') return { backgroundColor: '#bae6fd', color: '#0369a1' };
  if (r === 'central') return { backgroundColor: '#fecaca', color: '#b91c1c' };
  if (r === 'western') return { backgroundColor: '#bbf7d0', color: '#15803d' };
  if (r === 'rexdale') return { backgroundColor: '#e9d5ff', color: '#7e22ce' };
  return { backgroundColor: '#e2e8f0', color: '#475569' };
};

// Hash function for assignee background color pill
const getAssigneeStyle = (name) => {
  if (!name) return { backgroundColor: '#e2e8f0', color: '#475569' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return {
    backgroundColor: `hsl(${hue}, 70%, 90%)`,
    color: `hsl(${hue}, 70%, 30%)`
  };
};

// Parse any audio length string (H:MM:SS, M:SS, or bare minutes) → total seconds
const parseAudioToSeconds = (str) => {
  if (!str || typeof str !== 'string') return 0;
  const trimmed = str.trim();
  const parts = trimmed.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60; // bare number = minutes
  return 0;
};

// Format total seconds back to M:SS or H:MM:SS
const formatSeconds = (totalSeconds) => {
  if (!totalSeconds || isNaN(totalSeconds)) return '—';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function Dashboard() {
  const [reportMode, setReportMode] = useState('daily');
  const [language, setLanguage] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [report1Data, setReport1Data] = useState([]);
  const [report2Data, setReport2Data] = useState([]);
  const [report3Data, setReport3Data] = useState([]);
  const [report4Data, setReport4Data] = useState([]);
  const [report5Data, setReport5Data] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [loading3, setLoading3] = useState(false);
  const [loading4, setLoading4] = useState(false);
  const [loading5, setLoading5] = useState(false);
  const [error, setError] = useState(null);
  const [error2, setError2] = useState(null);
  const [error3, setError3] = useState(null);
  const [error4, setError4] = useState(null);
  const [error5, setError5] = useState(null);
  const [report5GrandTotal, setReport5GrandTotal] = useState(0);

  // --- Monthly States ---
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const [monthlyLanguage, setMonthlyLanguage] = useState('');
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

  const filtersReady = language && selectedDate;
  const monthlyFiltersReady = monthlyLanguage && monthlyMonth && monthlyYear;

  // Fetch reports when filters change
  useEffect(() => {
    if (!filtersReady) {
      setReport1Data([]);
      setReport2Data([]);
      setReport3Data([]);
      setReport4Data([]);
      setReport5Data([]);
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
          .select('wo_date, work_order_number, due_date, tat, assigned_to')
          .eq('language', language)
          .is('delivery_date', null)
          .eq('status', 'Done')
          .gt('due_date', selectedDate)
          .order('wo_date', { ascending: true });

        if (fetchError) {
          setError(fetchError.message);
          setReport1Data([]);
        } else {
          setReport1Data(data || []);
        }
      } catch (err) {
        setError('Failed to fetch report data.');
      }
      setLoading(false);
    };

    // Report 2: Work Order Due Today
    const fetchReport2 = async () => {
      setLoading2(true);
      setError2(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('wo_date, work_order_number, delivery_date, status, assigned_to')
          .eq('language', language)
          .eq('due_date', selectedDate)
          .order('wo_date', { ascending: true });

        if (fetchError) {
          setError2(fetchError.message);
          setReport2Data([]);
        } else {
          setReport2Data(data || []);
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
          setReport3Data(data || []);
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
          .select('work_order_number, tat, assigned_to, audio_length')
          .eq('language', language)
          .eq('wo_date', selectedDate)
          .order('work_order_number', { ascending: true });

        if (fetchError) {
          setError4(fetchError.message);
          setReport4Data([]);
        } else {
          // Group rows by work_order_number, summing audio_length
          const grouped = {};
          (data || []).forEach((row) => {
            const key = row.work_order_number;
            if (!grouped[key]) {
              grouped[key] = {
                work_order_number: row.work_order_number,
                tat: row.tat,
                assigned_to: row.assigned_to,
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

    // Report 5: Work Order Assigned on [date] — grouped by Assigned To and Request Type
    const fetchReport5 = async () => {
      setLoading5(true);
      setError5(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('assigned_to, request_type, audio_length')
          .eq('language', language)
          .eq('wo_date', selectedDate);

        if (fetchError) {
          setError5(fetchError.message);
          setReport5Data([]);
          setReport5GrandTotal(0);
        } else {
          // Group rows by assigned_to + request_type
          const grouped = {};
          let grandTotal = 0;
          
          (data || []).forEach((row) => {
            const key = `${row.assigned_to}_${row.request_type}`;
            if (!grouped[key]) {
              grouped[key] = {
                assigned_to: row.assigned_to,
                request_type: row.request_type,
                totalSeconds: 0,
              };
            }
            const secs = parseAudioToSeconds(row.audio_length);
            grouped[key].totalSeconds += secs;
            grandTotal += secs;
          });
          
          const sortedData = Object.values(grouped).sort((a, b) => {
             const cmp = (a.assigned_to || '').localeCompare(b.assigned_to || '');
             if (cmp !== 0) return cmp;
             return (a.request_type || '').localeCompare(b.request_type || '');
          });
          
          setReport5Data(sortedData);
          setReport5GrandTotal(grandTotal);
        }
      } catch (err) {
        setError5('Failed to fetch report data.');
      }
      setLoading5(false);
    };

    fetchReport1();
    fetchReport2();
    fetchReport3();
    fetchReport4();
    fetchReport5();
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
        // Construct the 1st day of the selected month
        const startDate = new Date(monthlyYear, monthlyMonth - 1, 1).toISOString().split('T')[0];
        // Day 0 of the next month corresponds to the last day of the current month
        const endDate = new Date(monthlyYear, monthlyMonth, 0).toISOString().split('T')[0];

        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('region, assigned_to, audio_length, word_count, character_wz_space, line_count')
          .eq('language', monthlyLanguage)
          .gte('due_date', startDate)
          .lte('due_date', endDate);

        if (fetchError) {
          setErrorM1(fetchError.message);
          setMonthlyReport1Data([]);
          setMonthlyReport2Data([]);
        } else {
          const groupedRegion = {};
          const groupedAssignee = {};

          (data || []).forEach((row) => {
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
        const startDate = new Date(monthlyYear, 0, 1).toISOString().split('T')[0];
        const endDate = new Date(monthlyYear, 11, 31).toISOString().split('T')[0];

        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('due_date, audio_length')
          .eq('language', monthlyLanguage)
          .gte('due_date', startDate)
          .lte('due_date', endDate);

        if (fetchError) {
          setErrorM3(fetchError.message);
          setMonthlyReport3Data([]);
        } else {
          // Initialize 12 months array
          const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
            monthIndex: i,
            monthName: new Date(0, i).toLocaleString('default', { month: 'short' }),
            audioSeconds: 0
          }));

          (data || []).forEach(row => {
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
        // Create base date (1st of the selected month)
        const baseDate = new Date(monthlyYear, monthlyMonth - 1, 1);
        
        // Start date: 3 months before
        const startDateObj = new Date(baseDate);
        startDateObj.setMonth(startDateObj.getMonth() - 3);
        const startDate = startDateObj.toISOString().split('T')[0];

        // End date: 1 month after (end of that month)
        const endDateObj = new Date(baseDate);
        endDateObj.setMonth(endDateObj.getMonth() + 1);
        // move to end of the month
        const nextMonth = endDateObj.getMonth();
        const nextYear = endDateObj.getFullYear();
        const endOfMonthObj = new Date(nextYear, nextMonth + 1, 0); // last day
        const endDate = endOfMonthObj.toISOString().split('T')[0];

        const { data, error: fetchError } = await supabase
          .from('work_orders')
          .select('due_date, audio_length, word_count, character_wz_space, line_count')
          .eq('language', monthlyLanguage)
          .gte('due_date', startDate)
          .lte('due_date', endDate);

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

          (data || []).forEach(row => {
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
      <h1 className="page-title" style={{ marginBottom: '1.5rem' }}>Reports</h1>
      
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
              <h3>Select filters to view reports</h3>
              <p>Choose a language, month, and year above to generate the monthly dashboard report cards.</p>
            </div>
          ) : (
            <div className="dashboard-kanban">
              {/* Monthly Report 1 */}
              <div className="dashboard-report-card">
                <div className={`dashboard-report-header ${monthlyLanguage === 'FR' ? 'lang-fr' : 'lang-en'}`}>
                  <span className="dashboard-report-title">{monthlyLanguage} Metrics by Region</span>
                  <span className="dashboard-report-count">
                    <BarChart3 size={13} />
                    {loadingM1 ? '…' : monthlyReport1Data.length}
                  </span>
                </div>
                <div className="dashboard-report-body">
                  {loadingM1 ? (
                    <div className="dashboard-empty-state">
                      <p>Loading report data…</p>
                    </div>
                  ) : errorM1 ? (
                    <div className="dashboard-empty-state">
                      <p style={{ color: '#dc2626' }}>{errorM1}</p>
                    </div>
                  ) : monthlyReport1Data.length === 0 ? (
                    <div className="dashboard-empty-state">
                      <BarChart3 size={28} />
                      <p>No data for this month.</p>
                    </div>
                  ) : (
                <div className="kanban-card-grid">
                  {monthlyReport1Data.map((row, idx) => (
                    <div key={idx} className="kanban-card">
                      <div className="kanban-card-header">
                        <span style={{ 
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          ...getRegionStyle(row.region)
                        }}>
                          {row.region}
                        </span>
                      </div>
                      <div className="kanban-metrics-grid">
                        <div className="kanban-metric-box">
                          <span className="label">Audio Length</span>
                          <span className="value">{formatSeconds(row.audioSeconds)}</span>
                        </div>
                        <div className="kanban-metric-box">
                          <span className="label">Word Count</span>
                          <span className="value">{row.wordCount.toLocaleString()}</span>
                        </div>
                        <div className="kanban-metric-box">
                          <span className="label">Characters</span>
                          <span className="value">{row.characterSpace.toLocaleString()}</span>
                        </div>
                        <div className="kanban-metric-box">
                          <span className="label">Line Count</span>
                          <span className="value">{row.lineCount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                </div>
              </div>

              {/* Monthly Report 2: By Assignee */}
              <div className="dashboard-report-card">
                <div className={`dashboard-report-header ${monthlyLanguage === 'FR' ? 'lang-fr' : 'lang-en'}`}>
                  <span className="dashboard-report-title">{monthlyLanguage} Metrics by Assignee</span>
                  <span className="dashboard-report-count">
                    <BarChart3 size={13} />
                    {loadingM1 ? '…' : monthlyReport2Data.length}
                  </span>
                </div>
                <div className="dashboard-report-body">
                  {loadingM1 ? (
                    <div className="dashboard-empty-state">
                      <p>Loading report data…</p>
                    </div>
                  ) : errorM1 ? (
                    <div className="dashboard-empty-state">
                      <p style={{ color: '#dc2626' }}>{errorM1}</p>
                    </div>
                  ) : monthlyReport2Data.length === 0 ? (
                    <div className="dashboard-empty-state">
                      <BarChart3 size={28} />
                      <p>No data for this month.</p>
                    </div>
                  ) : (
                <div className="kanban-card-grid">
                  {monthlyReport2Data.map((row, idx) => (
                    <div key={idx} className="kanban-card">
                      <div className="kanban-card-header">
                        <span style={{ 
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          ...getAssigneeStyle(row.assigned_to)
                        }}>
                          {row.assigned_to}
                        </span>
                      </div>
                      <div className="kanban-metrics-grid">
                        <div className="kanban-metric-box">
                          <span className="label">Audio Length</span>
                          <span className="value">{formatSeconds(row.audioSeconds)}</span>
                        </div>
                        <div className="kanban-metric-box">
                          <span className="label">Word Count</span>
                          <span className="value">{row.wordCount.toLocaleString()}</span>
                        </div>
                        <div className="kanban-metric-box">
                          <span className="label">Characters</span>
                          <span className="value">{row.characterSpace.toLocaleString()}</span>
                        </div>
                        <div className="kanban-metric-box">
                          <span className="label">Line Count</span>
                          <span className="value">{row.lineCount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                </div>
              </div>

              {/* Monthly Report 4: Word Count by Assignee (Horizontal Bar) */}
              <div className="dashboard-report-card dashboard-report-full-width">
                <div className={`dashboard-report-header ${monthlyLanguage === 'FR' ? 'lang-fr' : 'lang-en'}`}>
                  <span className="dashboard-report-title">{monthNameStr} {monthlyYear} Word Count</span>
                  <span className="dashboard-report-count">
                    <BarChart3 size={13} />
                  </span>
                </div>
                <div className="dashboard-report-body" style={{ padding: '1.5rem' }}>
                  {loadingM1 ? (
                    <div className="dashboard-empty-state">
                      <p>Loading report data…</p>
                    </div>
                  ) : errorM1 ? (
                    <div className="dashboard-empty-state">
                      <p style={{ color: '#dc2626' }}>{errorM1}</p>
                    </div>
                  ) : sortedWordCountData.length === 0 ? (
                    <div className="dashboard-empty-state">
                      <BarChart3 size={28} />
                      <p>No data for this month.</p>
                    </div>
                  ) : (
                    <div className="horizontal-bar-chart" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {sortedWordCountData.map((d, i) => {
                        const widthPercent = Math.max((d.wordCount / maxWordCount) * 100, 1); // Min 1% to show a sliver
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                            {/* Name Label */}
                            <div style={{ width: '120px', textAlign: 'right', paddingRight: '16px', fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                              {d.assigned_to}
                            </div>
                            {/* Bar Track */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                              <div style={{ 
                                width: d.wordCount > 0 ? `${widthPercent}%` : '0%', 
                                height: '24px', 
                                backgroundColor: '#3f6212', // Match user screenshot green
                                borderRadius: '0 4px 4px 0', 
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                              }}></div>
                              {/* Value Label */}
                              {d.wordCount > 0 && (
                                <div style={{ 
                                  marginLeft: '12px', 
                                  fontSize: '0.85rem', 
                                  color: '#3f6212', 
                                  fontWeight: 500,
                                  fontVariantNumeric: 'tabular-nums',
                                  animation: 'fadeIn 0.5s ease forwards 0.5s'
                                }}>
                                  {d.wordCount.toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Report 3: Yearly Audio Length Bar Chart */}
              <div className="dashboard-report-card dashboard-report-full-width">
                <div className={`dashboard-report-header ${monthlyLanguage === 'FR' ? 'lang-fr' : 'lang-en'}`}>
                  <span className="dashboard-report-title">{monthlyYear} Monthly Audio Length</span>
                  <span className="dashboard-report-count">
                    <BarChart3 size={13} />
                  </span>
                </div>
                <div className="dashboard-report-body">
                  {loadingM3 ? (
                    <div className="dashboard-empty-state">
                      <p>Loading chart data…</p>
                    </div>
                  ) : errorM3 ? (
                    <div className="dashboard-empty-state">
                      <p style={{ color: '#dc2626' }}>{errorM3}</p>
                    </div>
                  ) : monthlyReport3Data.length === 0 ? (
                    <div className="dashboard-empty-state">
                      <BarChart3 size={28} />
                      <p>No data for this year.</p>
                    </div>
                  ) : (
                    <div className="css-bar-chart-container">
                      <div className="css-bar-chart-bars">
                        {monthlyReport3Data.map((d, i) => {
                          const heightPercent = Math.max((d.audioSeconds / maxAudioSeconds) * 100, 2); // Min 2% height so it's visible
                          return (
                            <div className="css-bar-wrapper" key={i}>
                              <div className="css-bar-value" style={{ opacity: d.audioSeconds > 0 ? undefined : 0 }}>
                                {d.audioSeconds > 0 ? formatSeconds(d.audioSeconds) : ''}
                              </div>
                              <div className="css-bar-fill-container">
                                <div 
                                  className="css-bar-fill" 
                                  style={{ height: `${d.audioSeconds > 0 ? heightPercent : 0}%` }}
                                ></div>
                              </div>
                              <div className="css-bar-label">{d.monthName}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Report 5: Rolling 5-Month Metrics */}
              <div className="dashboard-report-card dashboard-report-full-width">
                <div className={`dashboard-report-header ${monthlyLanguage === 'FR' ? 'lang-fr' : 'lang-en'}`}>
                  <span className="dashboard-report-title">Monthly Rolling Metrics</span>
                  <span className="dashboard-report-count">
                    <BarChart3 size={13} />
                  </span>
                </div>
                <div className="dashboard-report-body">
                  {loadingM5 ? (
                    <div className="dashboard-empty-state">
                      <p>Loading report data…</p>
                    </div>
                  ) : errorM5 ? (
                    <div className="dashboard-empty-state">
                      <p style={{ color: '#dc2626' }}>{errorM5}</p>
                    </div>
                  ) : monthlyReport5Data.length === 0 ? (
                    <div className="dashboard-empty-state">
                      <BarChart3 size={28} />
                      <p>No data for these months.</p>
                    </div>
                  ) : (
                <div className="kanban-card-grid">
                  {monthlyReport5Data.map((row, idx) => (
                    <div key={idx} className="kanban-card" style={row.isCurrentMonth ? { border: '2px solid #3f6212', backgroundColor: '#f8fafc' } : {}}>
                      <div className="kanban-card-header">
                        <span className="kanban-card-title" style={{ color: '#3f6212', fontStyle: row.isCurrentMonth ? 'normal' : 'italic' }}>
                          {row.displayMonth} {row.isCurrentMonth && '(Current)'}
                        </span>
                      </div>
                      <div className="kanban-metrics-grid">
                        <div className="kanban-metric-box">
                          <span className="label">Audio Length</span>
                          <span className="value">{formatSeconds(row.audioSeconds)}</span>
                        </div>
                        <div className="kanban-metric-box">
                          <span className="label">Word Count</span>
                          <span className="value">{row.wordCount.toLocaleString()}</span>
                        </div>
                        <div className="kanban-metric-box">
                          <span className="label">Characters</span>
                          <span className="value">{row.characterSpace.toLocaleString()}</span>
                        </div>
                        <div className="kanban-metric-box">
                          <span className="label">Line Count</span>
                          <span className="value">{row.lineCount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
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
          <h3>Select filters to view reports</h3>
          <p>Choose a language and a date above to generate the dashboard report cards.</p>
        </div>
      ) : (
        <div className="dashboard-kanban">
          {/* ===== Report 1: Done – Not yet Delivered ===== */}
          <div className="dashboard-report-card">
            <div className={`dashboard-report-header ${language === 'FR' ? 'lang-fr' : 'lang-en'}`}>
              <span className="dashboard-report-title">Done – Not yet Delivered</span>
              <span className="dashboard-report-count">
                <Inbox size={13} />
                {loading ? '…' : report1Data.length}
              </span>
            </div>
            <div className="dashboard-report-body">
              {loading ? (
                <div className="dashboard-empty-state">
                  <p>Loading report data…</p>
                </div>
              ) : error ? (
                <div className="dashboard-empty-state">
                  <p style={{ color: '#dc2626' }}>{error}</p>
                </div>
              ) : report1Data.length === 0 ? (
                <div className="dashboard-empty-state">
                  <Inbox size={28} />
                  <p>No records match the criteria.</p>
                </div>
              ) : (
                <div className="kanban-card-grid">
                  {report1Data.map((row, idx) => (
                    <div key={idx} className="kanban-card">
                      <div className="kanban-card-header">
                        <span className="kanban-card-title">{row.work_order_number}</span>
                        <span className="assigned-badge">{row.assigned_to}</span>
                      </div>
                      <div className="kanban-card-body">
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">WO Date</span>
                          <span className="kanban-card-value">{formatDdMmm(row.wo_date)}</span>
                        </div>
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">Due Date</span>
                          <span className="kanban-card-value">{formatDdMmm(row.due_date)}</span>
                        </div>
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">TAT</span>
                          <span className="kanban-card-value">{row.tat}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== Report 2: Work Order Due Today ===== */}
          <div className="dashboard-report-card">
            <div className={`dashboard-report-header ${language === 'FR' ? 'lang-fr' : 'lang-en'}`}>
              <span className="dashboard-report-title">{language} Work Order Due Today</span>
              <span className="dashboard-report-count">
                <CalendarCheck size={13} />
                {loading2 ? '…' : report2Data.length}
              </span>
            </div>
            <div className="dashboard-report-body">
              {loading2 ? (
                <div className="dashboard-empty-state">
                  <p>Loading report data…</p>
                </div>
              ) : error2 ? (
                <div className="dashboard-empty-state">
                  <p style={{ color: '#dc2626' }}>{error2}</p>
                </div>
              ) : report2Data.length === 0 ? (
                <div className="dashboard-empty-state">
                  <CalendarCheck size={28} />
                  <p>No work orders due on this date.</p>
                </div>
              ) : (
                <div className="kanban-card-grid">
                  {report2Data.map((row, idx) => (
                    <div key={idx} className="kanban-card">
                      <div className="kanban-card-header">
                        <span className="kanban-card-title">{row.work_order_number}</span>
                        <span className="assigned-badge">{row.assigned_to}</span>
                      </div>
                      <div className="kanban-card-body">
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">WO Date</span>
                          <span className="kanban-card-value">{formatDdMmm(row.wo_date)}</span>
                        </div>
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">Delivery Date</span>
                          <span className="kanban-card-value">{formatDdMmm(row.delivery_date)}</span>
                        </div>
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">Status</span>
                          <span className={`dash-status-badge ${getStatusClass(row.status)}`}>
                            {row.status || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== Report 3: Work Order Delivered Today ===== */}
          <div className="dashboard-report-card">
            <div className={`dashboard-report-header ${language === 'FR' ? 'lang-fr' : 'lang-en'}`}>
              <span className="dashboard-report-title">{language} Work Order Delivered Today</span>
              <span className="dashboard-report-count">
                <Truck size={13} />
                {loading3 ? '…' : report3Data.length}
              </span>
            </div>
            <div className="dashboard-report-body">
              {loading3 ? (
                <div className="dashboard-empty-state">
                  <p>Loading report data…</p>
                </div>
              ) : error3 ? (
                <div className="dashboard-empty-state">
                  <p style={{ color: '#dc2626' }}>{error3}</p>
                </div>
              ) : report3Data.length === 0 ? (
                <div className="dashboard-empty-state">
                  <Truck size={28} />
                  <p>No work orders delivered on this date.</p>
                </div>
              ) : (
                <div className="kanban-card-grid">
                  {report3Data.map((row, idx) => (
                    <div key={idx} className="kanban-card">
                      <div className="kanban-card-header">
                        <span className="kanban-card-title">{row.work_order_number}</span>
                        <span className="assigned-badge">{row.assigned_to}</span>
                      </div>
                      <div className="kanban-card-body">
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">WO Date</span>
                          <span className="kanban-card-value">{formatDdMmm(row.wo_date)}</span>
                        </div>
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">Due Date</span>
                          <span className="kanban-card-value">{formatDdMmm(row.due_date)}</span>
                        </div>
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">Status</span>
                          <span className={`dash-status-badge ${getStatusClass(row.status)}`}>
                            {row.status || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== Report 4: Work Order Assigned on [date] ===== */}
          <div className="dashboard-report-card">
            <div className={`dashboard-report-header ${language === 'FR' ? 'lang-fr' : 'lang-en'}`}>
              <span className="dashboard-report-title">
                {language} Work Order Assigned on {formatDdMmmYyyy(selectedDate)}
              </span>
              <span className="dashboard-report-count">
                <ClipboardList size={13} />
                {loading4 ? '…' : report4Data.length}
              </span>
            </div>
            <div className="dashboard-report-body">
              {loading4 ? (
                <div className="dashboard-empty-state">
                  <p>Loading report data…</p>
                </div>
              ) : error4 ? (
                <div className="dashboard-empty-state">
                  <p style={{ color: '#dc2626' }}>{error4}</p>
                </div>
              ) : report4Data.length === 0 ? (
                <div className="dashboard-empty-state">
                  <ClipboardList size={28} />
                  <p>No work orders assigned on this date.</p>
                </div>
              ) : (
                <div className="kanban-card-grid">
                  {report4Data.map((row, idx) => (
                    <div key={idx} className="kanban-card">
                      <div className="kanban-card-header">
                        <span className="kanban-card-title">{row.work_order_number}</span>
                        <span className="assigned-badge">{row.assigned_to}</span>
                      </div>
                      <div className="kanban-card-body">
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">TAT</span>
                          <span className="kanban-card-value">{row.tat}</span>
                        </div>
                        <div className="kanban-card-row">
                          <span className="kanban-card-label">Audio Length</span>
                          <span className="kanban-card-value">{formatSeconds(row.totalSeconds)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== Report 5: Grouped by Assigned To & Request Type ===== */}
          <div className="dashboard-report-card">
            <div className={`dashboard-report-header ${language === 'FR' ? 'lang-fr' : 'lang-en'}`}>
              <span className="dashboard-report-title">
                {language} Audio Length by Assignee
              </span>
              <span className="dashboard-report-count">
                <Clock size={13} />
                {loading5 ? '…' : report5Data.length}
              </span>
            </div>
            <div className="dashboard-report-body">
              {loading5 ? (
                <div className="dashboard-empty-state">
                  <p>Loading report data…</p>
                </div>
              ) : error5 ? (
                <div className="dashboard-empty-state">
                  <p style={{ color: '#dc2626' }}>{error5}</p>
                </div>
              ) : report5Data.length === 0 ? (
                <div className="dashboard-empty-state">
                  <Clock size={28} />
                  <p>No audio length data for this date.</p>
                </div>
              ) : (
                <table className="dashboard-mini-table">
                  <thead>
                    <tr>
                      <th>Assigned to</th>
                      <th>Request Type</th>
                      <th>Audio Length</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report5Data.map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className="assigned-badge">{row.assigned_to}</span>
                        </td>
                        <td>{row.request_type || '—'}</td>
                        <td style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                          {formatSeconds(row.totalSeconds)}
                        </td>
                      </tr>
                    ))}
                    {/* Grand Total Row */}
                    {report5Data.length > 0 && (
                      <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                        <td colSpan={2} style={{ fontWeight: 600, textAlign: 'right', paddingRight: '1rem' }}>
                          Grand Total
                        </td>
                        <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>
                          {formatSeconds(report5GrandTotal)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
