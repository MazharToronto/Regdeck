import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart3, CalendarCheck, Truck, Inbox, Clock, Sparkles } from 'lucide-react';

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

// Helper to get status badge class
const getStatusClass = (status) => {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s === 'done') return 'dash-status-done';
  if (s === 'in progress' || s === 'in process') return 'dash-status-inprogress';
  if (s === 'pending') return 'dash-status-pending';
  return '';
};

// Placeholder report titles for reports 4–5
const PLACEHOLDER_REPORTS = [
  { id: 4, title: 'Delivered – On Time' },
  { id: 5, title: 'Delivered – Late' },
];

export default function Dashboard() {
  const [language, setLanguage] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [report1Data, setReport1Data] = useState([]);
  const [report2Data, setReport2Data] = useState([]);
  const [report3Data, setReport3Data] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [loading3, setLoading3] = useState(false);
  const [error, setError] = useState(null);
  const [error2, setError2] = useState(null);
  const [error3, setError3] = useState(null);

  const filtersReady = language && selectedDate;

  // Fetch reports when filters change
  useEffect(() => {
    if (!filtersReady) {
      setReport1Data([]);
      setReport2Data([]);
      setReport3Data([]);
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

    fetchReport1();
    fetchReport2();
    fetchReport3();
  }, [language, selectedDate]);

  return (
    <div className="page-container">
      <h1 className="page-title">Reports</h1>

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
                <table className="dashboard-mini-table">
                  <thead>
                    <tr>
                      <th>WO Date</th>
                      <th>Work Order #</th>
                      <th>Due Date</th>
                      <th>TAT</th>
                      <th>Assigned to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report1Data.map((row, idx) => (
                      <tr key={idx}>
                        <td>{formatDdMmm(row.wo_date)}</td>
                        <td style={{ fontWeight: 600 }}>{row.work_order_number}</td>
                        <td>{formatDdMmm(row.due_date)}</td>
                        <td>{row.tat}</td>
                        <td>
                          <span className="assigned-badge">{row.assigned_to}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <table className="dashboard-mini-table">
                  <thead>
                    <tr>
                      <th>WO Date</th>
                      <th>Work Order #</th>
                      <th>Delivery Date</th>
                      <th>Status</th>
                      <th>Assigned to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report2Data.map((row, idx) => (
                      <tr key={idx}>
                        <td>{formatDdMmm(row.wo_date)}</td>
                        <td style={{ fontWeight: 600 }}>{row.work_order_number}</td>
                        <td>{formatDdMmm(row.delivery_date)}</td>
                        <td>
                          <span className={`dash-status-badge ${getStatusClass(row.status)}`}>
                            {row.status || '—'}
                          </span>
                        </td>
                        <td>
                          <span className="assigned-badge">{row.assigned_to}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <table className="dashboard-mini-table">
                  <thead>
                    <tr>
                      <th>WO Date</th>
                      <th>Work Order #</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Assigned to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report3Data.map((row, idx) => (
                      <tr key={idx}>
                        <td>{formatDdMmm(row.wo_date)}</td>
                        <td style={{ fontWeight: 600 }}>{row.work_order_number}</td>
                        <td>{formatDdMmm(row.due_date)}</td>
                        <td>
                          <span className={`dash-status-badge ${getStatusClass(row.status)}`}>
                            {row.status || '—'}
                          </span>
                        </td>
                        <td>
                          <span className="assigned-badge">{row.assigned_to}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ===== Reports 4–5: Placeholders ===== */}
          {PLACEHOLDER_REPORTS.map((report) => (
            <div className="dashboard-report-card" key={report.id}>
              <div className={`dashboard-report-header placeholder-header ${language === 'FR' ? 'lang-fr' : 'lang-en'}`}>
                <span className="dashboard-report-title">{report.title}</span>
                <span className="dashboard-report-count">
                  <Clock size={13} />
                  —
                </span>
              </div>
              <div className="dashboard-placeholder-body">
                <div className="dashboard-coming-soon-badge">
                  <Sparkles size={14} />
                  Coming Soon
                </div>
                <p className="dashboard-placeholder-text">
                  This report will be available in a future update.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
