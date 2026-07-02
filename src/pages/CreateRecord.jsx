import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { UploadCloud, File, AlertCircle, CheckCircle, Download } from 'lucide-react';

export default function CreateRecord({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successCount, setSuccessCount] = useState(0);
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('EN');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.name.endsWith('.xlsx')) {
      setFile(selected);
      setError(null);
      setSuccessCount(0);
    } else {
      setFile(null);
      setError('Please select a valid .xlsx file');
    }
  };



  // Timezone-safe date parser: handles Date objects, DD-Mon-YY, DD-Mon-YYYY, DD-MM-YYYY, and fallback
  const parseSafeDate = (dateVal) => {
    if (!dateVal) return null;

    // Handle Date objects (from XLSX cellDates: true)
    if (dateVal instanceof Date) {
      if (isNaN(dateVal.getTime())) return null;
      const y = dateVal.getFullYear();
      const m = String(dateVal.getMonth() + 1).padStart(2, '0');
      const d = String(dateVal.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    const str = String(dateVal).trim();
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

    // DD-Mon-YY (e.g., "03-Feb-26")
    let match = str.match(/^(\d{1,2})-(\w{3})-(\d{2})$/i);
    if (match) {
      const day = String(match[1]).padStart(2, '0');
      const mon = months[match[2].toLowerCase()];
      const year = '20' + match[3];
      if (mon) return `${year}-${mon}-${day}`;
    }

    // DD-Mon-YYYY (e.g., "03-Feb-2026")
    match = str.match(/^(\d{1,2})-(\w{3})-(\d{4})$/i);
    if (match) {
      const day = String(match[1]).padStart(2, '0');
      const mon = months[match[2].toLowerCase()];
      if (mon) return `${match[3]}-${mon}-${day}`;
    }

    // DD-MM-YYYY or DD/MM/YYYY
    match = str.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
    if (match) {
      const day = String(match[1]).padStart(2, '0');
      const month = String(match[2]).padStart(2, '0');
      return `${match[3]}-${month}-${day}`;
    }

    // M/D/YY or M/D/YYYY (XLSX default US format output)
    match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      const month = String(match[1]).padStart(2, '0');
      const day = String(match[2]).padStart(2, '0');
      let year = match[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }

    // YYYY-MM-DD (already db format)
    match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) return str;

    // Fallback: parse but avoid timezone shift
    const d = new Date(dateVal + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  // Parse "dd-MON" format (e.g., "02-Mar") → YYYY-MM-DD using current year
  const parseDdMon = (dateStr) => {
    if (!dateStr) return null;
    const str = String(dateStr).trim();
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    // Try dd-MON format
    const match = str.match(/^(\d{1,2})-(\w{3})$/i);
    if (match) {
      const day = String(match[1]).padStart(2, '0');
      const mon = months[match[2].toLowerCase()];
      if (mon) {
        const year = new Date().getFullYear();
        return `${year}-${mon}-${day}`;
      }
    }
    // Fallback to safe date parsing
    return parseSafeDate(dateStr);
  };

  // Derive region from work order number prefix
  const deriveRegion = (workOrderNum) => {
    if (!workOrderNum) return null;
    const prefix = String(workOrderNum).substring(0, 3).toUpperCase();
    switch (prefix) {
      case 'RCE': return 'Eastern';
      case 'RCW': return 'Western';
      case 'REX': return 'Rexdale';
      case 'RCC': return 'Central';
      default: return null;
    }
  };

  // Helper to normalize keys (handles newlines and extra spaces from Excel headers)
  const cleanKeys = (row) => {
    const cleaned = {};
    for (let key in row) {
      const cleanKey = key.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      cleaned[cleanKey] = row[key];
    }
    return cleaned;
  };



  // Function to fetch the next sequence number for a given wo+assignee combination
  const getNextSequence = async (prefix) => {
    const { data } = await supabase
      .from('work_orders')
      .select('id')
      .like('id', `${prefix}%`)
      .order('id', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastId = data[0].id;
      const lastSeq = parseInt(lastId.split('_').pop(), 10);
      if (!isNaN(lastSeq)) return lastSeq + 1;
    }
    return 1;
  };

  const handleDownloadTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all dropdown data in parallel
      const [usersResult, divResult, rtResult, tatResult] = await Promise.all([
        // Active employee users via edge function (service role key — no RLS issues)
        supabase.functions.invoke('create-user', { method: 'GET' }),
        // Division values from ref_divisions
        supabase.from('ref_divisions').select('name'),
        // Request Type values from ref_request_types
        supabase.from('ref_request_types').select('name'),
        // TAT values from ref_tat_scores (descending order)
        supabase.from('ref_tat_scores').select('value').order('value', { ascending: false }),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (usersResult.data?.error) throw new Error(usersResult.data.error);
      if (divResult.error) throw divResult.error;
      if (rtResult.error) throw rtResult.error;
      if (tatResult.error) throw tatResult.error;

      // Filter to only active users with the 'employee' role
      const userNames = (usersResult.data || [])
        .filter(u => u.role_name?.toLowerCase() === 'employee' && u.is_active !== false)
        .map(u => u.full_name)
        .filter(Boolean)
        .sort();

      const divisionNames = (divResult.data || []).map(d => d.name).filter(Boolean);
      const requestTypes = (rtResult.data || []).map(r => r.name).filter(Boolean);
      const tatValues = (tatResult.data || []).map(t => String(t.value)).filter(Boolean);

      // Initialize ExcelJS workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'InvoiceGen';
      workbook.created = new Date();

      // Create the main Template sheet FIRST
      const templateSheet = workbook.addWorksheet('Template');
      const headers = [
        "Work Order Date", "WorkOrder #", "Assigned to", "File Number", 
        "Hearing Date", "Division", "Request Type", "TAT", "Due", "Audio Length"
      ];

      templateSheet.addRow(headers);
      templateSheet.getRow(1).font = { bold: true };
      templateSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

      templateSheet.columns.forEach((col, idx) => {
        if (idx === 0) col.width = 18;
        else if (idx === 1) col.width = 20;
        else if (idx === 2) col.width = 25;
        else col.width = 15;
      });

      // Set date format dd-MMM-yy for Work Order Date (Col A) and Due (Col I), and dd-mmm-yyyy for Hearing Date (Col E)
      templateSheet.getColumn(1).numFmt = 'dd-mmm-yy';
      templateSheet.getColumn(5).numFmt = 'dd-mmm-yyyy';
      templateSheet.getColumn(9).numFmt = 'dd-mmm-yy';
      // Set custom time format hh:mm for Audio Length (Col J)
      templateSheet.getColumn(10).numFmt = 'hh:mm';

      // Create a hidden Data sheet for all dropdown sources
      const dataSheet = workbook.addWorksheet('Data', { state: 'veryHidden' });

      // Column A: User names (for "Assigned to")
      userNames.forEach((name, index) => {
        dataSheet.getCell(`A${index + 1}`).value = name;
      });

      // Column B: Division values
      divisionNames.forEach((name, index) => {
        dataSheet.getCell(`B${index + 1}`).value = name;
      });

      // Column C: Request Type values
      requestTypes.forEach((name, index) => {
        dataSheet.getCell(`C${index + 1}`).value = name;
      });

      // Column D: TAT values
      tatValues.forEach((val, index) => {
        dataSheet.getCell(`D${index + 1}`).value = val;
      });

      // Build range references for data validation
      const usersRange = `Data!$A$1:$A$${userNames.length}`;
      const divisionRange = `Data!$B$1:$B$${divisionNames.length}`;
      const requestTypeRange = `Data!$C$1:$C$${requestTypes.length}`;
      const tatRange = `Data!$D$1:$D$${tatValues.length}`;

      // Apply Data Validation to dropdown columns for rows 2 to 1000
      for (let i = 2; i <= 1000; i++) {
        // Column C: Assigned to
        templateSheet.getCell(`C${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [usersRange],
          showErrorMessage: true,
          errorTitle: 'Invalid Entry',
          error: 'Please select a name from the dropdown list.'
        };

        // Column F: Division
        templateSheet.getCell(`F${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [divisionRange],
          showErrorMessage: true,
          errorTitle: 'Invalid Entry',
          error: 'Please select a division from the dropdown list.'
        };

        // Column G: Request Type
        templateSheet.getCell(`G${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [requestTypeRange],
          showErrorMessage: true,
          errorTitle: 'Invalid Entry',
          error: 'Please select a request type from the dropdown list.'
        };

        // Column H: TAT
        templateSheet.getCell(`H${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [tatRange],
          showErrorMessage: true,
          errorTitle: 'Invalid Entry',
          error: 'Please select a TAT value from the dropdown list.'
        };
      }

      // Generate buffer and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'WorkOrder_Upload_Template.xlsx');
      
    } catch (err) {
      console.error(err);
      setError("Failed to generate template: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccessCount(0);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, cellDates: true }); 

          if (!jsonData || jsonData.length === 0) {
            throw new Error("The selected file is empty or invalid.");
          }

          const recordsToInsert = [];
          const sequenceCache = {}; // Track sequences in memory to handle duplicates within the same file safely

          for (const rawRow of jsonData) {
            const row = cleanKeys(rawRow);
            
            const workOrderDateStr = row["Work Order Date"];
            const workOrderNum = row["WorkOrder #"];
            const assignedTo = row["Assigned to"];

            if (!workOrderDateStr || !workOrderNum) {
              // Skip invalid rows missing primary identification
              continue;
            }

            const prefix = `${workOrderNum.replace(/\s+/g, ' ').trim()}_${assignedTo || 'Unassigned'}_`;
            
            let currentSeq;
            if (sequenceCache[prefix]) {
              currentSeq = sequenceCache[prefix];
            } else {
              currentSeq = await getNextSequence(prefix);
            }
            
            sequenceCache[prefix] = currentSeq + 1;
            const compositeId = `${prefix}${String(currentSeq).padStart(4, '0')}`;

            recordsToInsert.push({
              id: compositeId,
              language: language,
              wo_date: parseDdMon(workOrderDateStr),
              work_order_number: workOrderNum,
              region: deriveRegion(workOrderNum),
              assigned_to: assignedTo,
              file_number: row["File Number"],
              hearing_date: parseSafeDate(row["Hearing Date"]),
              division: row["Division"],
              request_type: row["Request Type"],
              tat: parseInt(row["TAT"], 10) || null,
              due_date: parseDdMon(row["Due"]),
              audio_length: row["Audio Length"],
              created_by: user?.id
            });
          }

          if (recordsToInsert.length === 0) {
            throw new Error("No valid records found to insert. Ensure headers match exactly (e.g., 'Work Order Date', 'WorkOrder #').");
          }

          // Fetch potentially duplicate work order numbers from DB
          const uploadWoNumbers = Array.from(new Set(recordsToInsert.map(r => r.work_order_number).filter(Boolean)));
          const { data: existingRecords, error: checkError } = await supabase
            .from('work_orders')
            .select('work_order_number, file_number, hearing_date')
            .in('work_order_number', uploadWoNumbers);

          if (checkError) {
            throw new Error("Failed to check for existing records: " + checkError.message);
          }

          const existingKeys = new Set(
            (existingRecords || []).map(r => {
              const wo = (r.work_order_number || '').trim().toLowerCase();
              const fn = (r.file_number || '').trim().toLowerCase();
              const hd = (r.hearing_date || '').trim();
              return `${wo}|${fn}|${hd}`;
            })
          );

          const seenInUpload = new Set();
          for (const rec of recordsToInsert) {
            const wo = (rec.work_order_number || '').trim().toLowerCase();
            const fn = (rec.file_number || '').trim().toLowerCase();
            const hd = (rec.hearing_date || '').trim();
            const key = `${wo}|${fn}|${hd}`;

            if (existingKeys.has(key)) {
              throw new Error(`The work order combination already exists: Work Order #: ${rec.work_order_number}, File #: ${rec.file_number || '—'}, Hearing Date: ${rec.hearing_date || '—'}`);
            }

            if (seenInUpload.has(key)) {
              throw new Error(`The work order combination appears multiple times in the uploaded file: Work Order #: ${rec.work_order_number}, File #: ${rec.file_number || '—'}, Hearing Date: ${rec.hearing_date || '—'}`);
            }
            seenInUpload.add(key);
          }

          const { error: insertError } = await supabase.from('work_orders').insert(recordsToInsert);

          if (insertError) throw insertError;

          setSuccessCount(recordsToInsert.length);
          setFile(null); // Reset input after success
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setError("Failed to read the file.");
        setLoading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Bulk Upload Work Orders</h1>

      <div className="content-card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '3rem' }}>
        
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '2rem', textAlign: 'left', display: 'flex', alignItems: 'center' }}>
            <AlertCircle size={20} style={{ marginRight: '8px', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        
        {successCount > 0 && (
          <div className="alert alert-success" style={{ marginBottom: '2rem', textAlign: 'left', display: 'flex', alignItems: 'center' }}>
            <CheckCircle size={20} style={{ marginRight: '8px', flexShrink: 0 }} />
            <span>Successfully inserted {successCount} work order record(s).</span>
          </div>
        )}

        {/* Language Radio Buttons */}
        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '600', color: '#334155' }}>Language</label>
          <div style={{ display: 'flex', gap: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#475569', fontWeight: '500' }}>
              <input
                type="radio"
                name="language"
                value="EN"
                checked={language === 'EN'}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ accentColor: '#6366f1', width: '18px', height: '18px' }}
              />
              English (EN)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#475569', fontWeight: '500' }}>
              <input
                type="radio"
                name="language"
                value="FR"
                checked={language === 'FR'}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ accentColor: '#6366f1', width: '18px', height: '18px' }}
              />
              French (FR)
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button 
            onClick={handleDownloadTemplate} 
            disabled={loading}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', fontSize: '0.9rem', backgroundColor: '#e2e8f0', 
              color: '#334155', border: 'none', borderRadius: '8px', 
              cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#cbd5e1'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#e2e8f0'}
          >
            <Download size={18} />
            Download .xlsx Template
          </button>
        </div>

        <div className="upload-zone" style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '40px', backgroundColor: '#f8fafc', transition: 'all 0.2s' }}>
          <UploadCloud size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#334155' }}>Upload Excel File</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
            Drag and drop your .xlsx file here, or click to browse.
          </p>
          
          <input 
            type="file" 
            accept=".xlsx" 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            id="file-upload" 
          />
          
          <label htmlFor="file-upload" className="btn-primary" style={{ display: 'inline-block', cursor: 'pointer', margin: '0' }}>
            Browse Files
          </label>
        </div>

        {file && (
          <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <File size={20} color="#475569" />
            <span style={{ color: '#334155', fontWeight: '500' }}>{file.name}</span>
          </div>
        )}

        <div style={{ marginTop: '30px' }}>
          <button 
            className="btn-primary" 
            onClick={handleUpload} 
            disabled={!file || loading}
            style={{ width: '100%', padding: '14px', fontSize: '1.05rem', opacity: (!file || loading) ? 0.6 : 1 }}
          >
            {loading ? 'Processing...' : 'Upload and Process'}
          </button>
        </div>

      </div>
    </div>
  );
}
