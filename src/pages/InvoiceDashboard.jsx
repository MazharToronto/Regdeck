import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#fff', border: '1px solid #ccc', padding: '10px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <p style={{ margin: '0 0 5px', fontWeight: 'bold' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} style={{ margin: 0, color: entry.color, fontSize: '13px' }}>
            {entry.name}: ${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const REGIONS = ['Central', 'Eastern', 'Rexdale', 'Western'];

export default function InvoiceDashboard() {
  const currentYear = new Date().getFullYear();
  const [language, setLanguage] = useState('EN');
  const [year, setYear] = useState(currentYear.toString());
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [languageOptions, setLanguageOptions] = useState([]);

  const years = [(currentYear - 1).toString(), currentYear.toString(), (currentYear + 1).toString()];

  useEffect(() => {
    const loadOptions = async () => {
      const { data: langData } = await supabase.from('ref_languages').select('code, label');
      if (langData?.length) {
        setLanguageOptions(langData);
        setLanguage(langData[0].code);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const { data, error } = await supabase
        .from('work_orders')
        .select('region, delivery_date, total_amount, language')
        .eq('language', language)
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate);

      if (error) {
        console.error('Error fetching work orders:', error);
        setWorkOrders([]);
      } else {
        setWorkOrders(data || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [language, year]);

  // Build region × month matrix for total_amount
  const reportData = useMemo(() => {
    const matrix = {};
    REGIONS.forEach(region => {
      matrix[region] = {};
      MONTHS.forEach(m => { matrix[region][m] = 0; });
    });

    workOrders.forEach(wo => {
      if (!wo.delivery_date || !wo.region) return;
      const d = new Date(wo.delivery_date);
      const monthName = MONTHS[d.getUTCMonth()];
      const amount = parseFloat(wo.total_amount) || 0;
      if (matrix[wo.region] && monthName) {
        matrix[wo.region][monthName] += amount;
      }
    });

    return matrix;
  }, [workOrders]);

  // Transform matrix into array format for Recharts
  const chartData = useMemo(() => {
    return MONTHS.map(month => {
      const dataPoint = { name: month };
      REGIONS.forEach(region => {
        dataPoint[region] = reportData[region]?.[month] || 0;
      });
      return dataPoint;
    });
  }, [reportData]);

  // Calculate row totals and column (month) totals
  const getRowTotal = (region) => {
    return MONTHS.reduce((sum, m) => sum + (reportData[region]?.[m] || 0), 0);
  };

  const getMonthTotal = (month) => {
    return REGIONS.reduce((sum, r) => sum + (reportData[r]?.[month] || 0), 0);
  };

  const grandTotal = REGIONS.reduce((sum, r) => sum + getRowTotal(r), 0);

  const fmt = (val) => {
    if (val === 0) return '$0.00';
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Table header style matching screenshot
  const thStyle = {
    padding: '8px 12px',
    textAlign: 'right',
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#1e3a5f',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid #0f2640'
  };

  const thStyleLeft = { ...thStyle, textAlign: 'left' };

  const tdStyle = {
    padding: '6px 12px',
    textAlign: 'right',
    fontSize: '12px',
    color: '#1e3a5f',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap'
  };

  const tdStyleLeft = { ...tdStyle, textAlign: 'left', fontWeight: 'bold' };

  const totalRowStyle = {
    ...tdStyle,
    fontWeight: 'bold',
    borderTop: '2px solid #1e3a5f',
    backgroundColor: '#f0f4f8'
  };

  const totalRowLeftStyle = { ...totalRowStyle, textAlign: 'left' };

  const totalColStyle = {
    ...tdStyle,
    fontWeight: 'bold',
    color: '#1e3a5f'
  };

  const renderTable = (title, hstMultiplier = 1) => {
    const isHST = hstMultiplier > 1;
    return (
      <div style={{ marginBottom: '2rem' }}>
        {/* Year Header */}
        <div style={{
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '16px',
          color: '#1e3a5f',
          padding: '8px 0 4px'
        }}>
          {year}
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
            <thead>
              <tr>
                <th style={thStyleLeft}>{isHST ? 'With HST' : title}</th>
                {MONTHS.map(m => (
                  <th key={m} style={thStyle}>{m}</th>
                ))}
                <th style={{ ...thStyle, backgroundColor: '#0f2640' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {REGIONS.map(region => {
                const rowTotal = getRowTotal(region) * hstMultiplier;
                return (
                  <tr key={region}>
                    <td style={tdStyleLeft}>{region}</td>
                    {MONTHS.map(m => {
                      const val = (reportData[region]?.[m] || 0) * hstMultiplier;
                      return (
                        <td key={m} style={val > 0 ? tdStyle : { ...tdStyle, color: '#94a3b8' }}>
                          {val > 0 ? fmt(val) : ''}
                        </td>
                      );
                    })}
                    <td style={totalColStyle}>{fmt(rowTotal)}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={totalRowLeftStyle}>Total</td>
                {MONTHS.map(m => {
                  const val = getMonthTotal(m) * hstMultiplier;
                  return (
                    <td key={m} style={totalRowStyle}>{fmt(val)}</td>
                  );
                })}
                <td style={{ ...totalRowStyle, backgroundColor: '#1e3a5f', color: '#fff' }}>
                  {fmt(grandTotal * hstMultiplier)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Invoice Dashboard</h1>

      {/* Filter Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        marginBottom: '1.5rem',
        padding: '1rem 1.5rem',
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        flexWrap: 'wrap'
      }}>
        {/* Language Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Language:</span>
          <div style={{
            display: 'flex',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #cbd5e1'
          }}>
            {languageOptions.map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                style={{
                  padding: '6px 16px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  backgroundColor: language === lang.code ? '#6366f1' : '#f8fafc',
                  color: language === lang.code ? '#fff' : '#475569'
                }}
              >
                {lang.code}
              </button>
            ))}
          </div>
        </div>

        {/* Year Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Year:</span>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="form-input"
            style={{ width: '120px', padding: '6px 12px', fontSize: '13px' }}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reports */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading data...</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          {/* Chart for Report 1 */}
          <div style={{ width: '100%', height: 400, marginBottom: '4rem' }}>
            <div style={{ textAlign: 'center', backgroundColor: '#2d5a27', color: 'white', padding: '12px', fontWeight: 'bold', fontSize: '16px', marginBottom: '20px', borderRadius: '4px' }}>
              Month on Month Invoiced Amount Per Region
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis 
                  tickFormatter={(val) => '$' + val.toLocaleString()} 
                  axisLine={false} 
                  tickLine={false} 
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
                <Legend layout="vertical" verticalAlign="middle" align="right" iconType="square" wrapperStyle={{ paddingLeft: '20px' }} />
                <Bar dataKey="Central" fill="#f4cccc" name="Central" />
                <Bar dataKey="Eastern" fill="#c9daf8" name="Eastern" />
                <Bar dataKey="Rexdale" fill="#d9d2e9" name="Rexdale" />
                <Bar dataKey="Western" fill="#d9ead3" name="Western" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Report 1: Total Amount by Region × Month */}
          {renderTable(language === 'EN' ? 'English' : language === 'FR' ? 'French' : language)}

          {/* Report 2: With HST (13%) */}
          {renderTable(language === 'EN' ? 'English' : language === 'FR' ? 'French' : language, 1.13)}
        </div>
      )}
    </div>
  );
}
