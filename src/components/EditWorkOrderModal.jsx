import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { X } from 'lucide-react';

// Fallbacks while ref tables load
const FB_LANGUAGES = [{ value: 'EN', label: 'EN (English)' }, { value: 'FR', label: 'FR (French)' }];
const FB_REGIONS = ['Central', 'Eastern', 'Rexdale', 'Western'];
const FB_DIVISIONS = ['ID', 'RPD', 'RAD', 'IAD'];
const FB_REQUEST_TYPES = ['Full', 'Bench'];
const FB_TAT = [10, 5, 4, 3, 2, 1];
const FB_STATUSES = ['Pending', 'In progress', 'Done'];

export default function EditWorkOrderModal({ record, onClose, onSaved, userRoles = [] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Reference data
  const [languages, setLanguages] = useState(FB_LANGUAGES);
  const [regions, setRegions] = useState(FB_REGIONS);
  const [divisions, setDivisions] = useState(FB_DIVISIONS);
  const [requestTypes, setRequestTypes] = useState(FB_REQUEST_TYPES);
  const [tatValues, setTatValues] = useState(FB_TAT);
  const [statuses, setStatuses] = useState(FB_STATUSES);
  const [users, setUsers] = useState([]);
  const [holidays, setHolidays] = useState([]);

  const [formData, setFormData] = useState({
    language: record.language || 'EN',
    wo_date: record.wo_date || '',
    work_order_number: record.work_order_number || '',
    region: record.region || 'Central',
    assigned_to: record.assigned_to || '',
    file_number: record.file_number || '',
    hearing_date: record.hearing_date || '',
    division: record.division || 'RPD',
    request_type: record.request_type || 'Bench',
    tat: record.tat || 5,
    due_date: record.due_date || '',
    audio_length: record.audio_length || '',
    word_count: record.word_count || '',
    character_wz_space: record.character_wz_space || '',
    line_count: record.line_count || '',
    status: record.status || 'Pending',
    delivery_date: record.delivery_date || record.del_date || '',
    employee_comments: record.employee_comments || '',
    regdeck_admin_comments: record.regdeck_admin_comments || '',
    additional_comments: record.additional_comments || '',
    days_late: record.days_late || ''
  });

  useEffect(() => {
    const fetchRefData = async () => {
      const { data: langData } = await supabase.from('ref_languages').select('code, label');
      if (langData?.length) setLanguages(langData.map(l => ({ value: l.code, label: `${l.code} (${l.label})` })));

      const { data: regData } = await supabase.from('ref_regions').select('name');
      if (regData?.length) setRegions(regData.map(r => r.name));

      const { data: divData } = await supabase.from('ref_divisions').select('name');
      if (divData?.length) setDivisions(divData.map(d => d.name));

      const { data: rtData } = await supabase.from('ref_request_types').select('name');
      if (rtData?.length) setRequestTypes(rtData.map(rt => rt.name));

      const { data: tatData } = await supabase.from('ref_tat_scores').select('value').order('value', { ascending: false });
      if (tatData?.length) setTatValues(tatData.map(t => t.value));

      const { data: statusData } = await supabase.from('ref_work_order_statuses').select('name').order('name');
      if (statusData?.length) setStatuses(statusData.map(s => s.name));

      const { data: userData } = await supabase.from('ref_users').select('name').order('name');
      if (userData?.length) {
        setUsers(userData.map(u => ({ value: u.name, label: u.name })));
      } else {
        setUsers([{ value: record.assigned_to, label: record.assigned_to }]);
      }

      const { data: holidayData } = await supabase.from('holidays').select('holiday_date');
      if (holidayData?.length) setHolidays(holidayData.map(h => h.holiday_date));
    };
    fetchRefData();
  }, []);

  const canEditAll = userRoles.includes('admin') || userRoles.includes('manager');

  const calculateBusinessDays = (startStr, endStr) => {
    if (!startStr || !endStr) return '';
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start) || isNaN(end)) return '';
    
    if (end <= start) return 0;
    
    let count = 0;
    let cur = new Date(start);
    cur.setDate(cur.getDate() + 1);
    
    while (cur <= end) {
      const day = cur.getDay();
      const isWeekend = day === 0 || day === 6;

      // Extract YYYY-MM-DD from current date safely (avoid timezone UTC shift)
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const curDateStr = `${y}-${m}-${d}`;
      
      const isHoliday = holidays.includes(curDateStr);

      if (!isWeekend && !isHoliday) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto-calculate line count when character w/ space changes
      if (name === 'character_wz_space') {
        const chars = parseInt(value, 10);
        if (!isNaN(chars)) {
          updated.line_count = Math.floor(chars / 65);
        } else {
          updated.line_count = '';
        }
      }

      // Auto-calculate days late
      if (name === 'delivery_date' || name === 'due_date') {
        updated.days_late = calculateBusinessDays(updated.due_date, updated.delivery_date);
      }
      
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const updatePayload = {
      language: formData.language,
      work_order_number: formData.work_order_number,
      region: formData.region,
      assigned_to: formData.assigned_to,
      file_number: formData.file_number || null,
      hearing_date: formData.hearing_date || null,
      division: formData.division,
      request_type: formData.request_type,
      tat: parseInt(formData.tat, 10),
      due_date: formData.due_date || null,
      audio_length: formData.audio_length || null,
      word_count: formData.word_count,
      character_wz_space: formData.character_wz_space,
      line_count: formData.line_count ? parseInt(formData.line_count, 10) : 0,
      status: formData.status,
      delivery_date: formData.delivery_date || null,
      employee_comments: formData.employee_comments || null,
      regdeck_admin_comments: formData.regdeck_admin_comments || null,
      additional_comments: formData.additional_comments || null,
      days_late: formData.days_late ? parseInt(formData.days_late, 10) : 0
    };

    const { error } = await supabase
      .from('work_orders')
      .update(updatePayload)
      .eq('id', record.id);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1200);
    }
    setLoading(false);
  };

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Edit Work Order</h2>
          <span className="modal-subtitle">{record.id}</span>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">Record updated successfully!</div>}

          <form onSubmit={handleSubmit}>
            {/* Language */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Language</label>
                <select name="language" className="form-select" value={formData.language} onChange={handleChange} disabled={!canEditAll}>
                  {languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            {/* Row 1 */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Work Order Date</label>
                <input type="text" className="form-input" value={formData.wo_date ? (() => { const d = new Date(formData.wo_date); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${mm}${dd}`; })() : '—'} readOnly disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Work Order #</label>
                <input type="text" name="work_order_number" className="form-input" value={formData.work_order_number} onChange={handleChange} required disabled={!canEditAll} />
              </div>
              <div className="form-group">
                <label className="form-label">File Number</label>
                <input type="text" name="file_number" className="form-input" value={formData.file_number} onChange={handleChange} disabled={!canEditAll} />
              </div>
            </div>

            {/* Row 2: Dropdowns */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Region</label>
                <select name="region" className="form-select" value={formData.region} onChange={handleChange} disabled={!canEditAll}>
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <select name="assigned_to" className="form-select" value={formData.assigned_to} onChange={handleChange} disabled={!canEditAll}>
                  {users.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Division</label>
                <select name="division" className="form-select" value={formData.division} onChange={handleChange} disabled={!canEditAll}>
                  {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3 */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Request Type</label>
                <select name="request_type" className="form-select" value={formData.request_type} onChange={handleChange} disabled={!canEditAll}>
                  {requestTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">TAT (Days)</label>
                <select name="tat" className="form-select" value={formData.tat} onChange={handleChange} disabled={!canEditAll}>
                  {tatValues.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Hearing Date</label>
                <input type="date" name="hearing_date" className="form-input" value={formData.hearing_date} onChange={handleChange} disabled={!canEditAll} />
              </div>
            </div>

            {/* Row 4 */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" name="due_date" className="form-input" value={formData.due_date} onChange={handleChange} disabled={!canEditAll} />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Date</label>
                <input type="date" name="delivery_date" className="form-input" value={formData.delivery_date} onChange={handleChange} disabled={!canEditAll} />
              </div>
              <div className="form-group">
                <label className="form-label">Audio Length</label>
                <input type="text" name="audio_length" className="form-input" placeholder="e.g., 0:15" value={formData.audio_length} onChange={handleChange} disabled={!canEditAll} />
              </div>
            </div>

            {/* Row 5 */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Word Count</label>
                <input type="text" name="word_count" className="form-input" value={formData.word_count} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Characters w/ Space</label>
                <input type="text" name="character_wz_space" className="form-input" value={formData.character_wz_space} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Line Count</label>
                <input type="number" name="line_count" className="form-input" value={formData.line_count} readOnly disabled />
              </div>
            </div>

            {/* Row 6 */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select name="status" className="form-select" value={formData.status} onChange={handleChange}>
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Days Late</label>
                <input type="number" name="days_late" className="form-input" value={formData.days_late} readOnly disabled />
              </div>
            </div>

            {/* Comments */}
            <div className="form-group">
              <label className="form-label">Employee Comments</label>
              <textarea name="employee_comments" className="form-input" rows="2" value={formData.employee_comments} onChange={handleChange}></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">RegDeck Admin Comments</label>
              <textarea name="regdeck_admin_comments" className="form-input" rows="2" value={formData.regdeck_admin_comments} onChange={handleChange} disabled={!canEditAll}></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Additional Comments</label>
              <textarea name="additional_comments" className="form-input" rows="2" value={formData.additional_comments} onChange={handleChange}></textarea>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading} style={{ width: 'auto' }}>
                {loading ? 'Updating...' : 'Update Record'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
