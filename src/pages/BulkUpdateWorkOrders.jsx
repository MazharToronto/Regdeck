import { useState } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { UploadCloud, File, AlertCircle, CheckCircle, Play, RefreshCw, X } from 'lucide-react';

export default function BulkUpdateWorkOrders() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [result, setResult] = useState(null);

  // ── Helpers (shared logic with CreateRecord) ──

  const cleanKey = (k) => k.replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();

  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  const parseSafeDate = (dateVal) => {
    if (!dateVal) return null;

    if (dateVal instanceof Date) {
      if (isNaN(dateVal.getTime())) return null;
      const y = dateVal.getFullYear();
      const m = String(dateVal.getMonth() + 1).padStart(2, '0');
      const d = String(dateVal.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    const str = String(dateVal).trim();

    // DD-Mon-YY
    let match = str.match(/^(\d{1,2})-(\w{3})-(\d{2})$/i);
    if (match) {
      const day = match[1].padStart(2, '0');
      const mon = months[match[2].toLowerCase()];
      if (mon) return `20${match[3]}-${mon}-${day}`;
    }

    // DD-Mon-YYYY
    match = str.match(/^(\d{1,2})-(\w{3})-(\d{4})$/i);
    if (match) {
      const day = match[1].padStart(2, '0');
      const mon = months[match[2].toLowerCase()];
      if (mon) return `${match[3]}-${mon}-${day}`;
    }

    // DD-Mon (no year → current year)
    match = str.match(/^(\d{1,2})-(\w{3})$/i);
    if (match) {
      const day = match[1].padStart(2, '0');
      const mon = months[match[2].toLowerCase()];
      if (mon) return `${new Date().getFullYear()}-${mon}-${day}`;
    }

    // DD-MM-YYYY or DD/MM/YYYY
    match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      return `${match[3]}-${month}-${day}`;
    }

    // YYYY-MM-DD (already ISO)
    match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) return str;

    // Fallback
    const d = new Date(dateVal + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const cleanKeys = (row) => {
    const cleaned = {};
    for (let key in row) {
      cleaned[cleanKey(key)] = row[key];
    }
    return cleaned;
  };

  // ── File Handling ──

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.name.endsWith('.xlsx')) {
      setFile(selected);
      setError(null);
      setPreviewData(null);
      setResult(null);
    } else {
      setFile(null);
      setError('Please select a valid .xlsx file');
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreviewData(null);
    setResult(null);
    setError(null);
  };

  // ── Parse Excel → Preview ──

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    setError(null);
    setPreviewData(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const workbook = XLSX.read(data, { type: 'array', raw: false, cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false, cellDates: true });

      if (!jsonData || jsonData.length === 0) {
        throw new Error('The uploaded file is empty or has no valid data rows.');
      }

      // Build composite IDs using row order within each WO group
      const seqMap = {};
      const records = [];

      for (const rawRow of jsonData) {
        const row = cleanKeys(rawRow);

        const workOrderNum = (row['WorkOrder #'] || row['Work Order #'] || '').replace(/\s+/g, ' ').trim();
        const assignedTo = (row['Assigned to'] || row['Assigned To'] || '').trim();

        if (!workOrderNum) continue; // skip rows without WO#

        const prefix = `${workOrderNum}_`;
        if (!seqMap[prefix]) seqMap[prefix] = 1;
        const seq = seqMap[prefix]++;
        const compositeId = `${prefix}${String(seq).padStart(4, '0')}`;

        // Parse update fields
        const wordCountRaw = (row['Word Count'] || '').replace(/,/g, '').trim();
        const charSpaceRaw = (row['Character wz Space'] || '').replace(/,/g, '').trim();
        const status = (row['Status'] || '').trim() || null;
        const delDateRaw = row['Del Date'] || null;
        const empComments = (row['Transcriptionist Comments'] || '').trim() || null;
        const adminComments = (row['RegDeck Admin Comments'] || '').trim() || null;

        records.push({
          id: compositeId,
          word_count: wordCountRaw ? parseInt(wordCountRaw, 10) : null,
          character_wz_space: charSpaceRaw ? parseInt(charSpaceRaw, 10) : null,
          status,
          del_date: parseSafeDate(delDateRaw),
          employee_comments: empComments,
          regdeck_admin_comments: adminComments,
          // Display-only fields for the preview table
          _wo: workOrderNum,
          _assigned: assignedTo,
        });
      }

      if (records.length === 0) {
        throw new Error('No valid records found. Ensure the file has "WorkOrder #" or "Work Order #" column.');
      }

      setPreviewData(records);
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  // ── Execute Batch Updates ──

  const handleExecute = async () => {
    if (!previewData || previewData.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const CHUNK_SIZE = 50;
      let successCount = 0;
      let notFoundCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < previewData.length; i += CHUNK_SIZE) {
        const chunk = previewData.slice(i, i + CHUNK_SIZE);

        // Process each record in the chunk
        const promises = chunk.map(async (record) => {
          const updatePayload = {
            word_count: record.word_count,
            character_wz_space: record.character_wz_space,
            status: record.status,
            delivery_date: record.del_date,
            employee_comments: record.employee_comments,
            regdeck_admin_comments: record.regdeck_admin_comments,
          };

          const { data, error: updateError } = await supabase
            .from('work_orders')
            .update(updatePayload)
            .eq('id', record.id)
            .select('id');

          if (updateError) {
            errors.push({ id: record.id, error: updateError.message });
            errorCount++;
          } else if (!data || data.length === 0) {
            errors.push({ id: record.id, error: 'ID not found in database' });
            notFoundCount++;
          } else {
            successCount++;
          }
        });

        await Promise.all(promises);
      }

      setResult({ successCount, notFoundCount, errorCount, errors });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Format date for display ──
  const formatDisplayDate = (isoDate) => {
    if (!isoDate) return '—';
    try {
      const d = new Date(isoDate + 'T00:00:00');
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch {
      return isoDate;
    }
  };

  // ── Render ──

  return (
    <div className="page-container">
      <h1 className="page-title">Bulk Update Work Orders</h1>

      {/* Status Messages */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
          <AlertCircle size={20} style={{ marginRight: '8px', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div
          className={`alert ${result.errorCount > 0 || result.notFoundCount > 0 ? 'alert-error' : 'alert-success'}`}
          style={{ marginBottom: '1.5rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: result.errors?.length > 0 ? '12px' : 0 }}>
            <CheckCircle size={20} style={{ marginRight: '8px', flexShrink: 0 }} />
            <span>
              <strong>{result.successCount}</strong> updated successfully
              {result.notFoundCount > 0 && <> · <strong>{result.notFoundCount}</strong> ID(s) not found</>}
              {result.errorCount > 0 && <> · <strong>{result.errorCount}</strong> error(s)</>}
            </span>
          </div>
          {result.errors?.length > 0 && (
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', maxHeight: '150px', overflow: 'auto' }}>
              {result.errors.map((e, i) => (
                <div key={i} style={{ padding: '2px 0' }}>
                  <code style={{ color: '#f87171' }}>{e.id}</code>: {e.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Card */}
      <div className="content-card" style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#e2e8f0', fontWeight: 600 }}>
            Upload Excel File
          </h2>
          {file && (
            <button
              onClick={handleClear}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', fontSize: '0.85rem', backgroundColor: 'rgba(239,68,68,0.1)',
                color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {!file ? (
          <div
            className="upload-zone"
            style={{
              border: '2px dashed rgba(99,102,241,0.3)', borderRadius: '12px', padding: '40px',
              backgroundColor: 'rgba(99,102,241,0.05)', textAlign: 'center', transition: 'all 0.2s',
            }}
          >
            <UploadCloud size={48} color="#6366f1" style={{ marginBottom: '16px', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: '#e2e8f0' }}>
              Drop your .xlsx file here
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
              Excel file with Work Order #, Assigned to, Word Count, Status, Del Date, etc.
            </p>
            <input type="file" accept=".xlsx" onChange={handleFileChange} style={{ display: 'none' }} id="bulk-update-upload" />
            <label htmlFor="bulk-update-upload" className="btn-primary" style={{ display: 'inline-block', cursor: 'pointer', margin: 0 }}>
              Browse Files
            </label>
          </div>
        ) : (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '14px',
              backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: '8px', marginBottom: '1.5rem',
            }}>
              <File size={20} color="#818cf8" />
              <span style={{ color: '#e2e8f0', fontWeight: 500, flex: 1 }}>{file.name}</span>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>

            {!previewData && (
              <button
                className="btn-primary"
                onClick={handleParse}
                disabled={parsing}
                style={{ width: '100%', padding: '12px', fontSize: '1rem', opacity: parsing ? 0.6 : 1 }}
              >
                {parsing ? 'Parsing...' : 'Parse & Preview'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Preview Table */}
      {previewData && previewData.length > 0 && (
        <div className="content-card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#e2e8f0', fontWeight: 600 }}>
              Preview — {previewData.length} record(s) to update
            </h2>
            <button
              className="btn-primary"
              onClick={handleExecute}
              disabled={loading || result?.successCount > 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', fontSize: '0.95rem',
                opacity: (loading || result?.successCount > 0) ? 0.6 : 1,
              }}
            >
              {loading ? (
                <><RefreshCw size={16} className="spin" /> Updating...</>
              ) : result?.successCount > 0 ? (
                <><CheckCircle size={16} /> Done</>
              ) : (
                <><Play size={16} /> Execute Updates</>
              )}
            </button>
          </div>

          <div style={{ overflow: 'auto', maxHeight: '500px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.1)' }}>
            <table className="data-table" style={{ width: '100%', minWidth: '900px' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>#</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Composite ID</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Word Count</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Char w/ Space</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Status</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Del Date</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Employee Comments</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Admin Comments</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{idx + 1}</td>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                        {row.id}
                      </code>
                    </td>
                    <td style={{ textAlign: 'right' }}>{row.word_count?.toLocaleString() ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{row.character_wz_space?.toLocaleString() ?? '—'}</td>
                    <td>
                      {row.status ? (
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600,
                          backgroundColor: row.status === 'Done' ? 'rgba(34,197,94,0.15)' : 'rgba(250,204,21,0.15)',
                          color: row.status === 'Done' ? '#22c55e' : '#facc15',
                        }}>
                          {row.status}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDisplayDate(row.del_date)}</td>
                    <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={row.employee_comments || ''}>
                      {row.employee_comments || '—'}
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={row.regdeck_admin_comments || ''}>
                      {row.regdeck_admin_comments || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
