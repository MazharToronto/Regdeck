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
  const [report2Data, setReport2Data] = useState([]);
  const [report3Data, setReport3Data] = useState([]);
  const [report4Data, setReport4Data] = useState([]);
  const [report5Data, setReport5Data] = useState([]);
  const [report6Data, setReport6Data] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [loading3, setLoading3] = useState(false);
  const [loading4, setLoading4] = useState(false);
  const [loading5, setLoading5] = useState(false);
  const [loading6, setLoading6] = useState(false);
  const [error, setError] = useState(null);
  const [error2, setError2] = useState(null);
  const [error3, setError3] = useState(null);
  const [error4, setError4] = useState(null);
  const [error5, setError5] = useState(null);
  const [error6, setError6] = useState(null);
  const [report5GrandTotal, setReport5GrandTotal] = useState(0);

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
          .select('wo_date, work_order_number, due_date, tat, assigned_to, status')
          .eq('language', language)
          .is('delivery_date', null)
          .eq('status', 'Done')
          .gt('due_date', selectedDate)
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
        } else {
          // Group by 5 columns: work_order_number, assigned_to, wo_date, due_date, status
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
    fetchReport2();
    fetchReport3();
    fetchReport4();
    fetchReport5();
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
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Region</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Audio Length</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Word Count</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Characters</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Line Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyReport1Data.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: idx === monthlyReport1Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                                <span className={`pill ${getRegionPillClass(row.region)}`} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
                                  {row.region}
                                </span>
                              </td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', fontWeight: '700', color: '#6366f1', fontFamily: 'monospace' }}>{formatSeconds(row.audioSeconds)}</td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.wordCount.toLocaleString()}</td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.characterSpace.toLocaleString()}</td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.lineCount.toLocaleString()}</td>
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
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Assignee</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Audio Length</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Word Count</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Characters</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Line Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyReport2Data.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: idx === monthlyReport2Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                                <span className={`pill ${getEmployeePillClass(row.assigned_to)}`}>
                                  {row.assigned_to}
                                </span>
                              </td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', fontWeight: '700', color: '#6366f1', fontFamily: 'monospace' }}>{formatSeconds(row.audioSeconds)}</td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.wordCount.toLocaleString()}</td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.characterSpace.toLocaleString()}</td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.lineCount.toLocaleString()}</td>
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
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                              }}></div>
                              {/* Value Label */}
                              {d.wordCount > 0 && (
                                <div style={{ 
                                  marginLeft: '12px', 
                                  fontSize: '0.85rem', 
                                  color: '#c2410c', 
                                  fontWeight: 600,
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
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Month</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Audio Length</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Word Count</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Characters</th>
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Line Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyReport5Data.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: idx === monthlyReport5Data.length - 1 ? 'none' : '1px solid #f1f5f9', backgroundColor: row.isCurrentMonth ? '#fdf4ff' : 'transparent' }}>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: row.isCurrentMonth ? '#8b5cf6' : '#334155' }}>
                                {row.displayMonth} {row.isCurrentMonth && <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#8b5cf6', color: '#fff', borderRadius: '4px', marginLeft: '6px' }}>Current</span>}
                              </td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', fontWeight: '700', color: '#6366f1', fontFamily: 'monospace' }}>{formatSeconds(row.audioSeconds)}</td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.wordCount.toLocaleString()}</td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.characterSpace.toLocaleString()}</td>
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.lineCount.toLocaleString()}</td>
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
          <h3>Select filters to view reports</h3>
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
                  Done - Not Delivered {formatDdMmm(selectedDate)}
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
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>WO #</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Assigned To</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>WO Date</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Due</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>TAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report1Data.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report1Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={14} color="#94a3b8" /> {row.work_order_number}</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.assigned_to}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatDdMmm(row.wo_date)}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatDdMmm(row.due_date)}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.tat}</td>
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
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>WO #</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Assigned To</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>WO Date</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Delivery Date</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report2Data.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report2Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={14} color="#94a3b8" /> {row.work_order_number}</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.assigned_to}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatDdMmm(row.wo_date)}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatDdMmm(row.delivery_date)}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>
                            <span className={`dash-status-badge ${getStatusClass(row.status)}`}>{row.status || '—'}</span>
                          </td>
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
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>WO #</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Assigned To</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>WO Date</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Due</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report3Data.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report3Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={14} color="#94a3b8" /> {row.work_order_number}</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.assigned_to}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatDdMmm(row.wo_date)}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatDdMmm(row.due_date)}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>
                            <span className={`dash-status-badge ${getStatusClass(row.status)}`}>{row.status || '—'}</span>
                          </td>
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
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
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
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#ede9fe', color: '#6d28d9', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                <Clock size={14} />
                {loading4 ? '…' : report4Data.length} Records
              </span>
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
              ) : report4Data.length === 0 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <Clock size={28} color="#94a3b8" />
                  <p>No work orders assigned on this date.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>WO #</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Assigned To</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Type</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>TAT</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Total Audio Length</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report4Data.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report4Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={14} color="#94a3b8" /> {row.work_order_number}</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.assigned_to}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>
                            <span className={`pill ${row.request_type?.toLowerCase() === 'bench' ? 'req-bench' : 'req-full'}`} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
                              {row.request_type || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.tat}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', fontWeight: '700', color: '#6366f1', fontFamily: 'monospace' }}>{formatSeconds(row.totalSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ===== Report 5: Work Order Assigned on [date] (by Assignee & Type) ===== */}
          <div className="work-order-card" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', borderTop: '6px solid #ec4899', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); navigate(`/records?report=5&date=${selectedDate}&lang=${language}`); }} 
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
                  Assigned Audio Length {formatDdMmm(selectedDate)}
                </a>
              </h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: '#fce7f3', color: '#be185d', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600' }}>
                <Sparkles size={14} />
                Grand Total: {formatSeconds(report5GrandTotal)}
              </span>
            </div>
            <div style={{ padding: '1.25rem', background: '#f8fafc' }}>
              {loading5 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p>Loading report data…</p>
                </div>
              ) : error5 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p style={{ color: '#dc2626' }}>{error5}</p>
                </div>
              ) : report5Data.length === 0 ? (
                <div className="dashboard-empty-state" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <Sparkles size={28} color="#94a3b8" />
                  <p>No records to calculate audio length.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Assigned To</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Request Type</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Total Audio Length</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report5Data.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report5Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>{row.assigned_to}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.request_type}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', fontWeight: '700', color: '#6366f1', fontFamily: 'monospace' }}>{formatSeconds(row.totalSeconds)}</td>
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
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>WO Date</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Assigned To</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>TAT</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Type</th>
                        <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Audio Length</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report6Data.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === report6Data.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{formatDdMmm(row.wo_date)}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.assigned_to}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>{row.tat}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>
                            <span className={`pill ${row.request_type?.toLowerCase() === 'bench' ? 'req-bench' : 'req-full'}`} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
                              {row.request_type || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.9rem', fontWeight: '700', color: '#6366f1', fontFamily: 'monospace' }}>{formatSeconds(row.totalSeconds)}</td>
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
