import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

// Fallback values (used while reference tables load)
const FALLBACK_LANGUAGES = [{ value: 'EN', label: 'EN (English)' }, { value: 'FR', label: 'FR (French)' }];
const FALLBACK_REGIONS = ['Central', 'Eastern', 'Rexdale', 'Western'];
const FALLBACK_DIVISIONS = ['ID', 'RPD', 'RAD', 'IAD'];
const FALLBACK_REQUEST_TYPES = ['Full', 'Bench'];
const FALLBACK_TAT_VALUES = [10, 5, 4, 3, 2, 1];

export default function CreateRecord({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [users, setUsers] = useState([]);

  // Reference data from Supabase
  const [languages, setLanguages] = useState(FALLBACK_LANGUAGES);
  const [regions, setRegions] = useState(FALLBACK_REGIONS);
  const [divisions, setDivisions] = useState(FALLBACK_DIVISIONS);
  const [requestTypes, setRequestTypes] = useState(FALLBACK_REQUEST_TYPES);
  const [tatValues, setTatValues] = useState(FALLBACK_TAT_VALUES);

  const [formData, setFormData] = useState({
    language: 'EN',
    wo_id: '',
    work_order_number: '',
    region: 'Central',
    assigned_to: '',
    file_number: '',
    hearing_date: '',
    division: 'RPD',
    request_type: 'Bench',
    tat: 5,
    due_date: '',
    audio_length: '',
    word_count: '',
    character_wz_space: '',
    line_count: '',
    status: '',
    delivery_date: '',
    transcriptionist_comments: '',
    regdeck_admin_comments: '',
    delivery_status: '',
    days_late: ''
  });

  const handleCancel = () => {
    const isDirty = 
      formData.wo_id !== '' ||
      formData.work_order_number !== '' ||
      formData.file_number !== '' ||
      formData.hearing_date !== '' ||
      formData.due_date !== '' ||
      formData.audio_length !== '' ||
      formData.word_count !== '' ||
      formData.status !== '' ||
      formData.transcriptionist_comments !== '' ||
      formData.regdeck_admin_comments !== '';

    if (isDirty) {
      if (!window.confirm("Unsaved data will be lost. Are you sure you want to cancel?")) {
        return;
      }
    }
    navigate('/home');
  };

  // Fetch all reference data + users on mount
  useEffect(() => {
    const fetchRefData = async () => {
      // Languages
      const { data: langData } = await supabase.from('ref_languages').select('code, label');
      if (langData?.length) setLanguages(langData.map(l => ({ value: l.code, label: `${l.code} (${l.label})` })));

      // Regions
      const { data: regData } = await supabase.from('ref_regions').select('name');
      if (regData?.length) setRegions(regData.map(r => r.name));

      // Divisions
      const { data: divData } = await supabase.from('ref_divisions').select('name');
      if (divData?.length) setDivisions(divData.map(d => d.name));

      // Request Types
      const { data: rtData } = await supabase.from('ref_request_types').select('name');
      if (rtData?.length) setRequestTypes(rtData.map(rt => rt.name));

      // TAT Scores
      const { data: tatData } = await supabase.from('ref_tat_scores').select('value').order('value', { ascending: false });
      if (tatData?.length) setTatValues(tatData.map(t => t.value));

      // Users (from user_profiles view, fallback to current user)
      const { data: userData, error: userError } = await supabase.from('user_profiles').select('id, full_name, email');
      if (!userError && userData?.length) {
        setUsers(userData.map(u => ({ value: u.full_name || u.email, label: u.full_name || u.email })));
      } else {
        const name = user?.user_metadata?.full_name || user?.email || 'User';
        setUsers([{ value: name, label: name }]);
      }
    };
    fetchRefData();
  }, [user]);

  // Set default assigned_to when users are loaded
  useEffect(() => {
    if (users.length > 0 && !formData.assigned_to) {
      setFormData(prev => ({ ...prev, assigned_to: users[0].value }));
    }
  }, [users]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Generate the composite ID: WorkOrder_Assignee_SeqNum
  const generateId = async (workOrder, assignee) => {
    // Get the current max sequence number for this work order + assignee combo
    const prefix = `${workOrder}_${assignee}_`;
    const { data } = await supabase
      .from('work_orders')
      .select('id')
      .like('id', `${prefix}%`)
      .order('id', { ascending: false })
      .limit(1);

    let seq = 1;
    if (data && data.length > 0) {
      const lastId = data[0].id;
      const lastSeq = parseInt(lastId.split('_').pop(), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const compositeId = await generateId(
        formData.work_order_number.replace(/\s+/g, ' ').trim(),
        formData.assigned_to
      );

      const record = {
        id: compositeId,
        language: formData.language,
        wo_id: formData.wo_id || null,
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
        word_count: formData.word_count ? parseInt(formData.word_count, 10) : 0,
        character_wz_space: formData.character_wz_space ? parseInt(formData.character_wz_space, 10) : 0,
        line_count: formData.line_count ? parseInt(formData.line_count, 10) : 0,
        status: formData.status || null,
        delivery_date: formData.delivery_date || null,
        transcriptionist_comments: formData.transcriptionist_comments || null,
        regdeck_admin_comments: formData.regdeck_admin_comments || null,
        delivery_status: formData.delivery_status || null,
        days_late: formData.days_late ? parseInt(formData.days_late, 10) : 0,
        created_by: user?.id
      };

      const { error } = await supabase.from('work_orders').insert([record]);

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        // Reset form but keep dropdowns
        setFormData(prev => ({
          ...prev,
          wo_id: '',
          work_order_number: '',
          file_number: '',
          hearing_date: '',
          due_date: '',
          audio_length: '',
          word_count: '',
          character_wz_space: '',
          line_count: '',
          status: '',
          delivery_date: '',
          transcriptionist_comments: '',
          regdeck_admin_comments: '',
          delivery_status: '',
          days_late: ''
        }));
        setTimeout(() => navigate('/reports'), 2000);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Create work order</h1>

      <div className="content-card">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">Record created successfully! Redirecting...</div>}

        <form onSubmit={handleSubmit}>
          {/* Language selector */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Language *</label>
              <select name="language" className="form-select" value={formData.language} onChange={handleChange}>
                {languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row 1: Core fields */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">WO ID *</label>
              <input type="text" name="wo_id" className="form-input" placeholder="e.g., 0401" value={formData.wo_id} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Work Order # *</label>
              <input type="text" name="work_order_number" className="form-input" placeholder="e.g., RCE-8034-BB" value={formData.work_order_number} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">File Number</label>
              <input type="text" name="file_number" className="form-input" placeholder="Optional" value={formData.file_number} onChange={handleChange} />
            </div>
          </div>

          {/* Row 2: Dropdowns */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Region *</label>
              <select name="region" className="form-select" value={formData.region} onChange={handleChange}>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assigned To *</label>
              <select name="assigned_to" className="form-select" value={formData.assigned_to} onChange={handleChange}>
                {users.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Division *</label>
              <select name="division" className="form-select" value={formData.division} onChange={handleChange}>
                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Request details */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Request Type *</label>
              <select name="request_type" className="form-select" value={formData.request_type} onChange={handleChange}>
                {requestTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">TAT (Days) *</label>
              <select name="tat" className="form-select" value={formData.tat} onChange={handleChange}>
                {tatValues.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Hearing Date</label>
              <input type="date" name="hearing_date" className="form-input" value={formData.hearing_date} onChange={handleChange} />
            </div>
          </div>

          {/* Row 4: Dates */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input type="date" name="due_date" className="form-input" value={formData.due_date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Date</label>
              <input type="date" name="delivery_date" className="form-input" value={formData.delivery_date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Audio Length</label>
              <input type="text" name="audio_length" className="form-input" placeholder="e.g., 0:15" value={formData.audio_length} onChange={handleChange} />
            </div>
          </div>

          {/* Row 5: Counts */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Word Count</label>
              <input type="number" name="word_count" className="form-input" placeholder="0" value={formData.word_count} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Characters w/ Space</label>
              <input type="number" name="character_wz_space" className="form-input" placeholder="0" value={formData.character_wz_space} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Line Count</label>
              <input type="number" name="line_count" className="form-input" placeholder="0" value={formData.line_count} onChange={handleChange} />
            </div>
          </div>

          {/* Row 6: Status */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <input type="text" name="status" className="form-input" placeholder="Optional" value={formData.status} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Status</label>
              <select name="delivery_status" className="form-select" value={formData.delivery_status} onChange={handleChange}>
                <option value="">-- Select --</option>
                <option value="On Time">On Time</option>
                <option value="Late">Late</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Days Late</label>
              <input type="number" name="days_late" className="form-input" placeholder="0" value={formData.days_late} onChange={handleChange} />
            </div>
          </div>

          {/* Row 7: Comments */}
          <div className="form-group">
            <label className="form-label">Transcriptionist Comments</label>
            <textarea name="transcriptionist_comments" className="form-input" rows="2" placeholder="Optional" value={formData.transcriptionist_comments} onChange={handleChange}></textarea>
          </div>
          <div className="form-group">
            <label className="form-label">RegDeck Admin Comments</label>
            <textarea name="regdeck_admin_comments" className="form-input" rows="2" placeholder="Optional" value={formData.regdeck_admin_comments} onChange={handleChange}></textarea>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={handleCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: 'auto' }}>
              {loading ? 'Saving...' : 'Save Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
