import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Filter, Download } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function InvoiceGeneration({ userRoles = [] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [languageOptions, setLanguageOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);

  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  
  const [filters, setFilters] = useState({
    language: '',
    region: '',
    month: MONTHS[currentMonthIndex],
    year: currentYear.toString()
  });

  const years = [(currentYear - 1).toString(), currentYear.toString(), (currentYear + 1).toString()];

  useEffect(() => {
    const loadOptions = async () => {
      const { data: langData } = await supabase.from('ref_languages').select('code, label');
      if (langData) setLanguageOptions(langData.map(l => ({ value: l.code, label: `${l.code} (${l.label})` })));

      const { data: regData } = await supabase.from('ref_regions').select('name');
      if (regData) setRegionOptions(regData.map(r => r.name));
      
      // Set defaults if available
      if (langData?.length > 0) setFilters(prev => ({ ...prev, language: langData[0].code }));
      if (regData?.length > 0) setFilters(prev => ({ ...prev, region: regData[0].name }));
    };
    loadOptions();
  }, []);

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
    setSuccess(null);
  };

  const generateInvoice = async () => {
    if (!filters.language || !filters.region) {
      setError('Please select both Language and Region.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Calculate Start and End Date for the selected month
      const monthIndex = MONTHS.indexOf(filters.month);
      const year = parseInt(filters.year, 10);
      
      // Start of month: Year, Month, 1
      const startDate = new Date(Date.UTC(year, monthIndex, 1));
      // End of month: Year, Month + 1, 0
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // 2. Fetch Work Orders
      const { data, error: dbError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('language', filters.language)
        .eq('region', filters.region)
        .gte('delivery_date', startDateStr)
        .lte('delivery_date', endDateStr)
        .order('division', { ascending: true })
        .order('due_date', { ascending: true });

      if (dbError) throw dbError;
      
      if (!data || data.length === 0) {
        setError(`No work orders found for ${filters.region} (${filters.language}) in ${filters.month} ${filters.year}.`);
        setLoading(false);
        return;
      }

      // 3. Fetch Rates from reference_rate table
      const { data: ratesData, error: ratesError } = await supabase.from('reference_rate').select('language, tat, rate_per_word');
      if (ratesError) console.error("Could not fetch rates:", ratesError);

      // 4. Generate Excel
      await createExcelInvoice(data, ratesData || []);
      setSuccess('Invoice generated successfully.');
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while generating the invoice.');
    } finally {
      setLoading(false);
    }
  };

  const createExcelInvoice = async (records, ratesData = []) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoice', {
      views: [{ showGridLines: false }]
    });

    // Column settings (A=margin, B onwards = data)
    worksheet.columns = [
      { width: 2 },  // A: narrow margin
      { width: 15 }, // B: Work Order Date
      { width: 18 }, // C: Work Order #
      { width: 22 }, // D: File number
      { width: 15 }, // E: Hearing Date
      { width: 12 }, // F: Division
      { width: 12 }, // G: Request Type
      { width: 8 },  // H: TAT
      { width: 12 }, // I: Audio Length
      { width: 14 }, // J: Word Count
      { width: 12 }, // K: Rate Per Word
      { width: 12 }, // L: # of Days Late
      { width: 14 }, // M: Late Deduction
      { width: 14 }, // N: $ TOTAL
    ];

    // --- Header Section ---

    worksheet.mergeCells('B1:D2');
    const titleCell = worksheet.getCell('B1');
    titleCell.value = 'INVOICE';
    titleCell.font = { name: 'Calibri', size: 24, bold: true, color: { argb: 'FF002060' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Format current date as "Month DD, YYYY"
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });

    worksheet.getCell('B3').value = `Date: ${formattedDate}`;
    worksheet.getCell('B3').font = { name: 'Calibri', size: 11, color: { argb: 'FF0070C0' } };
    
    worksheet.getCell('B4').value = `Recording Unit : ${filters.region}`;
    worksheet.getCell('B4').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF002060' } };

    // Generate Invoice Number (e.g. EN-REX-0426)
    const monthIndex = MONTHS.indexOf(filters.month) + 1;
    const mm = monthIndex.toString().padStart(2, '0');
    const yy = filters.year.toString().slice(-2);
    const regionCodeMap = {
      'Eastern': 'RCE',
      'Western': 'RCW',
      'Rexdale': 'REX',
      'Central': 'RCC'
    };
    const regionCode = regionCodeMap[filters.region] || filters.region.substring(0, 3).toUpperCase();
    const invoiceNumber = `${filters.language}-${regionCode}-${mm}${yy}`;

    // Left block details (labels in B, values in C)
    worksheet.getCell('B6').value = 'Company Name:';
    worksheet.getCell('B6').font = { bold: true, color: { argb: 'FF002060' } };
    worksheet.getCell('C6').value = '2151706 Ontario Inc  O/A RegDeck';
    worksheet.getCell('C6').font = { bold: true, color: { argb: 'FF002060' } };

    worksheet.getCell('B7').value = 'Address:';
    worksheet.getCell('B7').font = { bold: true, color: { argb: 'FF002060' } };
    worksheet.getCell('C7').value = '5096 Durie Road Mississauga ON L5M 2C7';
    worksheet.getCell('C7').font = { color: { argb: 'FF0070C0' } };

    worksheet.getCell('B8').value = 'Contact Person:';
    worksheet.getCell('B8').font = { bold: true, color: { argb: 'FF002060' } };
    worksheet.getCell('C8').value = 'Mazhar Khan';
    worksheet.getCell('C8').font = { color: { argb: 'FF0070C0' } };

    worksheet.getCell('B9').value = 'Email Address:';
    worksheet.getCell('B9').font = { bold: true, color: { argb: 'FF002060' } };
    worksheet.getCell('C9').value = 'mazhar@regdeck.com';
    worksheet.getCell('C9').font = { color: { argb: 'FF0070C0' } };

    worksheet.getCell('B10').value = 'Phone number:';
    worksheet.getCell('B10').font = { bold: true, color: { argb: 'FF002060' } };
    worksheet.getCell('C10').value = '416-553-3444';
    worksheet.getCell('C10').font = { color: { argb: 'FF0070C0' } };

    worksheet.getCell('B11').value = 'GST/HST No:';
    worksheet.getCell('B11').font = { bold: true, color: { argb: 'FF002060' } };
    worksheet.getCell('C11').value = '836736959 RT0001';
    worksheet.getCell('C11').font = { color: { argb: 'FF0070C0' } };

    // Right block details (labels in H, values in J)
    worksheet.getCell('H6').value = 'Contract Number:';
    worksheet.getCell('H6').font = { bold: true, color: { argb: 'FF002060' } };
    worksheet.getCell('J6').value = 'CW2381882';
    worksheet.getCell('J6').font = { color: { argb: 'FF0070C0' } };

    worksheet.getCell('H7').value = 'Vendor:';
    worksheet.getCell('H7').font = { bold: true, color: { argb: 'FF002060' } };
    worksheet.getCell('J7').value = '2055988';
    worksheet.getCell('J7').font = { color: { argb: 'FF0070C0' } };

    worksheet.getCell('H8').value = 'Invoice Number:';
    worksheet.getCell('H8').font = { bold: true, color: { argb: 'FF002060' } };
    worksheet.getCell('J8').value = invoiceNumber;
    worksheet.getCell('J8').font = { bold: true, color: { argb: 'FF0070C0' } };

    worksheet.getCell('H9').value = 'Address:';
    worksheet.getCell('H9').font = { bold: true, color: { argb: 'FF002060' } };
    worksheet.getCell('J9').value = 'Immigration and Refugee Board 12th Floor, 344 Slater St';
    worksheet.getCell('J9').font = { color: { argb: 'FF0070C0' } };
    worksheet.getCell('J10').value = 'IRB 12th Floor 344 Slater St.';
    worksheet.getCell('J10').font = { color: { argb: 'FF0070C0' } };
    worksheet.getCell('J11').value = 'Ottawa ON, K1A 0K1';
    worksheet.getCell('J11').font = { color: { argb: 'FF0070C0' } };

    // --- Table Headers ---
    const headers = [
      'Work Order Date', 'Work Order #', 'File number', 'Hearing Date', 
      'Division', 'Request Type', 'TAT', 'Audio Length', 
      'Word Count', 'Rate Per Word', '# of Days Late', 'Late Deduction', '$ TOTAL'
    ];
    
    const headerRow = worksheet.getRow(13);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 2); // Start from column B
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FF002060' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
    });
    headerRow.height = 30;

    // --- Table Data & Subtotals ---
    // Group records by division
    const grouped = {};
    records.forEach(r => {
      const div = r.division || 'Unknown';
      if (!grouped[div]) grouped[div] = [];
      grouped[div].push(r);
    });

    let currentRow = 14;
    let grandTotal = 0;
    const divisionTotals = {};

    const formatWoDate = (dStr) => {
      if (!dStr) return '';
      const d = new Date(dStr);
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
    };

    const formatHearingDate = (dStr) => {
      if (!dStr) return '';
      const d = new Date(dStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate().toString().padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    Object.keys(grouped).forEach(division => {
      let divSubtotal = 0;
      grouped[division].forEach(r => {
        const row = worksheet.getRow(currentRow);
        
        // Find matching rate from reference_rate table based on language + TAT
        const matchingRate = ratesData.find(rt => rt.language === r.language && String(rt.tat) === String(r.tat));
        const rate = matchingRate ? parseFloat(parseFloat(matchingRate.rate_per_word).toFixed(3)) : 0;
        
        const wordCount = typeof r.word_count === 'number' ? r.word_count : (parseInt(String(r.word_count || '0').replace(/,/g, ''), 10) || 0);

        // Use pre-calculated values from work_orders table
        const lateDeduction = parseFloat(r.late_deduction_amount) || 0;
        const finalTotal = parseFloat(r.total_amount) || 0;
        const daysLate = typeof r.days_late === 'number' ? r.days_late : (parseInt(String(r.days_late || '0'), 10) || 0);

        divSubtotal += finalTotal;

        row.getCell(2).value = formatWoDate(r.wo_date);
        row.getCell(3).value = r.work_order_number || '';
        row.getCell(4).value = r.file_number || '';
        row.getCell(5).value = formatHearingDate(r.hearing_date);
        row.getCell(6).value = r.division || '';
        row.getCell(7).value = r.request_type || '';
        row.getCell(8).value = r.tat || '';
        row.getCell(9).value = r.audio_length || '';
        row.getCell(10).value = wordCount;
        row.getCell(11).value = rate;
        row.getCell(12).value = daysLate > 0 ? daysLate : '';
        row.getCell(13).value = lateDeduction > 0 ? lateDeduction : '';
        row.getCell(14).value = finalTotal;

        // Styling for data cells
        row.eachCell((cell, colNumber) => {
          if (colNumber === 1) return; // Skip margin column A
          cell.font = { color: { argb: 'FF0070C0' } };
          cell.alignment = { horizontal: 'center' };
          
          if (colNumber === 10) cell.numFmt = '#,##0'; // Word Count
          if (colNumber === 11) cell.numFmt = '$#,##0.000'; // Rate (3 decimals)
          if (colNumber === 13) cell.numFmt = '$#,##0.00'; // Late Deduction
          if (colNumber === 14) cell.numFmt = '$#,##0.00'; // Total
        });

        currentRow++;
      });

      // Subtotal Row for the division
      divisionTotals[division] = divSubtotal;
      grandTotal += divSubtotal;
      
      const subRow = worksheet.getRow(currentRow);
      subRow.getCell(14).value = divSubtotal;
      subRow.getCell(14).font = { bold: true };
      subRow.getCell(14).numFmt = '$#,##0.00';
      subRow.getCell(14).alignment = { horizontal: 'center' };
      currentRow += 2; // Leave a blank line between divisions
    });

    currentRow += 2; // Space before summary footer

    // --- Footer Summary Table ---
    // Headers: C=Division, E=GL, F=CC, G=FA, H=Fund, I=IO, N=Total
    const footHeaderRow = worksheet.getRow(currentRow);
    const footerMap = { 3: 'Division', 5: 'GL', 6: 'CC', 7: 'FA', 8: 'Fund', 9: 'IO', 14: 'Total' };
    Object.entries(footerMap).forEach(([col, label]) => {
      const cell = footHeaderRow.getCell(parseInt(col));
      cell.value = label;
      cell.font = { bold: true, color: { argb: 'FF002060' } };
      cell.alignment = { horizontal: 'center' };
    });
    currentRow++;

    // Mapping FA constants
    const faMap = {
      'RPD': '4301',
      'RAD': '4321',
      'IAD': '4341',
      'ID': '4361'
    };

    ['RPD', 'RAD', 'IAD', 'ID'].forEach(div => {
      const row = worksheet.getRow(currentRow);
      row.getCell(3).value = div;   // C: Division
      row.getCell(5).value = '504046'; // E: GL
      row.getCell(6).value = '816232'; // F: CC
      row.getCell(7).value = faMap[div] || ''; // G: FA
      row.getCell(8).value = '8110'; // H: Fund
      
      const divTotal = divisionTotals[div] || 0;
      if (divTotal > 0) {
        row.getCell(14).value = divTotal; // N: amount with $ in format
        row.getCell(14).font = { bold: true, color: { argb: 'FF002060' } };
        row.getCell(14).numFmt = '_($* #,##0.00_)';
      }
      
      // Formatting for footer data
      for (let c = 3; c <= 9; c++) {
        row.getCell(c).font = { color: { argb: 'FF0070C0' } };
        row.getCell(c).alignment = { horizontal: 'center' };
      }
      
      currentRow++;
    });

    currentRow++;
    // Grand Totals
    const hst = grandTotal * 0.13;
    
    // Subtotal
    const subtotalRow = worksheet.getRow(currentRow);
    subtotalRow.getCell(13).value = 'Subtotal';
    subtotalRow.getCell(14).value = grandTotal;
    subtotalRow.getCell(13).font = { bold: true, color: { argb: 'FF002060' } };
    subtotalRow.getCell(14).font = { bold: true, color: { argb: 'FF002060' } };
    subtotalRow.getCell(13).alignment = { horizontal: 'right' };
    subtotalRow.getCell(14).numFmt = '_($* #,##0.00_)';
    currentRow++;

    // HST
    const hstRow = worksheet.getRow(currentRow);
    hstRow.getCell(13).value = 'HST 13%';
    hstRow.getCell(14).value = hst;
    hstRow.getCell(13).font = { bold: true, color: { argb: 'FF002060' } };
    hstRow.getCell(14).font = { bold: true, color: { argb: 'FF002060' } };
    hstRow.getCell(13).alignment = { horizontal: 'right' };
    hstRow.getCell(14).numFmt = '_($* #,##0.00_)';
    currentRow++;

    // Total (Subtotal + HST)
    const finalTotalRow = worksheet.getRow(currentRow);
    finalTotalRow.getCell(13).value = 'Total';
    finalTotalRow.getCell(14).value = grandTotal + hst;
    finalTotalRow.getCell(13).font = { bold: true, color: { argb: 'FF002060' } };
    finalTotalRow.getCell(14).font = { bold: true, color: { argb: 'FF002060' } };
    finalTotalRow.getCell(13).alignment = { horizontal: 'right' };
    finalTotalRow.getCell(14).numFmt = '_($* #,##0.00_)';
    currentRow++;

    // Generate blob and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Invoice_${invoiceNumber}.xlsx`);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Invoice Generation</h1>

      <div style={{ maxWidth: '800px', background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
          Select the criteria to generate a monthly invoice. The system will filter work orders based on their delivery date.
        </p>

        {error && <div className="error-banner" style={{ marginBottom: '1.5rem' }}>{error}</div>}
        {success && <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 500 }}>{success}</div>}

        <div className="filter-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="filter-group">
            <label className="filter-label">Language</label>
            <select name="language" className="filter-select" value={filters.language} onChange={handleFilterChange} style={{ width: '100%' }}>
              <option value="" disabled>Select Language</option>
              {languageOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Region</label>
            <select name="region" className="filter-select" value={filters.region} onChange={handleFilterChange} style={{ width: '100%' }}>
              <option value="" disabled>Select Region</option>
              {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Month</label>
            <select name="month" className="filter-select" value={filters.month} onChange={handleFilterChange} style={{ width: '100%' }}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Year</label>
            <select name="year" className="filter-select" value={filters.year} onChange={handleFilterChange} style={{ width: '100%' }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn-primary" 
            onClick={generateInvoice} 
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '1rem' }}
          >
            <Download size={18} />
            {loading ? 'Generating...' : 'Generate Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
