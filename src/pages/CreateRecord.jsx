import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { UploadCloud, File, AlertCircle, CheckCircle } from 'lucide-react';

export default function CreateRecord({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successCount, setSuccessCount] = useState(0);
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('EN');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && (selected.name.endsWith('.xlsx') || selected.name.endsWith('.csv'))) {
      setFile(selected);
      setError(null);
      setSuccessCount(0);
    } else {
      setFile(null);
      setError('Please select a valid .xlsx or .csv file');
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
              due_date: parseDdMon(row["Due Date"]),
              audio_length: row["Audio Length"],
              created_by: user?.id
            });
          }

          if (recordsToInsert.length === 0) {
            throw new Error("No valid records found to insert. Ensure headers match exactly (e.g., 'Work Order Date', 'WorkOrder #').");
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

        <div className="upload-zone" style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '40px', backgroundColor: '#f8fafc', transition: 'all 0.2s' }}>
          <UploadCloud size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#334155' }}>Upload Excel File</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
            Drag and drop your .xlsx or .csv file here, or click to browse.
          </p>
          
          <input 
            type="file" 
            accept=".xlsx, .csv" 
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
