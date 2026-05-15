import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  UserPlus,
  Mail,
  Lock,
  User,
  Phone,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Briefcase,
} from 'lucide-react';

export default function AdminScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Roles fetched from DB
  const [roles, setRoles] = useState([]);
  const [fetchingRoles, setFetchingRoles] = useState(true);

  // Auth user fields mapped to Supabase auth.users table
  const [form, setForm] = useState({
    email: '',
    password: '',
    phone: '',
    full_name: '',
    role_id: '',
    email_confirm: true,
    phone_confirm: false,
    is_active: true,
  });

  useEffect(() => {
    const fetchRoles = async () => {
      setFetchingRoles(true);
      const { data, error: fetchError } = await supabase
        .from('roles')
        .select('id, role_name')
        .order('role_name');
        
      if (!fetchError && data) {
        setRoles(data);
        // Auto-select the first role if available
        if (data.length > 0) {
          setForm((prev) => ({ ...prev, role_id: data[0].id }));
        }
      } else if (fetchError) {
        console.error('Failed to fetch roles:', fetchError);
      }
      setFetchingRoles(false);
    };

    fetchRoles();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear messages when user starts editing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const resetForm = () => {
    setForm({
      email: '',
      password: '',
      phone: '',
      full_name: '',
      role_id: roles.length > 0 ? roles[0].id : '',
      email_confirm: true,
      phone_confirm: false,
      is_active: true,
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Basic validation
    if (!form.email.trim()) {
      setError('Email is required.');
      setLoading(false);
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }
    if (!form.role_id) {
      setError('Please select a role.');
      setLoading(false);
      return;
    }

    try {
      // Call the Edge Function — the service_role key stays server-side
      const { data, error: invokeError } = await supabase.functions.invoke('create-user', {
        body: {
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          full_name: form.full_name.trim() || undefined,
          role_id: form.role_id,
          email_confirm: form.email_confirm,
          phone_confirm: form.phone_confirm,
          is_active: form.is_active,
        },
      });

      if (invokeError) {
        setError(invokeError.message || 'Failed to create user.');
      } else if (data?.error) {
        setError(data.error);
      } else {
        setSuccess(
          `User "${data.user.email}" created successfully! (ID: ${data.user.id.slice(0, 8)}…)`
        );
        resetForm();
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    }

    setLoading(false);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Admin</h1>

      <div className="admin-layout">
        {/* Create User Card */}
        <div className="content-card admin-card">
          <div className="admin-card-header">
            <div className="admin-card-icon">
              <UserPlus size={22} />
            </div>
            <div>
              <h2 className="admin-card-title">Create New User</h2>
              <p className="admin-card-desc">
                Add a new user to the system. Fields map to Supabase auth schema.
              </p>
            </div>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="admin-alert admin-alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="admin-alert admin-alert-success">
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="admin-form">
            {/* Email */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="admin-email">
                  <Mail size={14} className="form-label-icon" />
                  Email <span className="required-star">*</span>
                </label>
                <input
                  id="admin-email"
                  type="email"
                  className="form-input"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="admin-password">
                  <Lock size={14} className="form-label-icon" />
                  Password <span className="required-star">*</span>
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Min. 6 characters"
                    value={form.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="admin-fullname">
                  <User size={14} className="form-label-icon" />
                  Full Name
                </label>
                <input
                  id="admin-fullname"
                  type="text"
                  className="form-input"
                  placeholder="John Doe"
                  value={form.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                />
              </div>
            </div>

            {/* Role & Phone */}
            <div className="form-row">
              {/* Role */}
              <div className="form-group">
                <label className="form-label" htmlFor="admin-role">
                  <Briefcase size={14} className="form-label-icon" />
                  Role <span className="required-star">*</span>
                </label>
                <select
                  id="admin-role"
                  className="form-input form-select"
                  value={form.role_id}
                  onChange={(e) => handleChange('role_id', e.target.value)}
                  required
                  disabled={fetchingRoles}
                >
                  <option value="" disabled>
                    {fetchingRoles ? 'Loading roles...' : 'Select a role'}
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.role_name.charAt(0).toUpperCase() + role.role_name.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone */}
              <div className="form-group">
                <label className="form-label" htmlFor="admin-phone">
                  <Phone size={14} className="form-label-icon" />
                  Phone
                </label>
                <input
                  id="admin-phone"
                  type="tel"
                  className="form-input"
                  placeholder="+1234567890"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>

              {/* Confirm Toggles Container */}
              <div className="form-group">
                <div style={{ display: 'flex', gap: '20px' }}>
                  {/* Email Confirm Toggle */}
                  <div>
                    <label className="form-label">Auto-confirm Email</label>
                    <div className="toggle-wrapper">
                      <button
                        type="button"
                        className={`toggle-btn ${form.email_confirm ? 'active' : ''}`}
                        onClick={() => handleChange('email_confirm', !form.email_confirm)}
                        aria-pressed={form.email_confirm}
                      >
                        <span className="toggle-knob" />
                      </button>
                    </div>
                  </div>

                  {/* Phone Confirm Toggle */}
                  <div>
                    <label className="form-label">Auto-confirm Phone</label>
                    <div className="toggle-wrapper">
                      <button
                        type="button"
                        className={`toggle-btn ${form.phone_confirm ? 'active' : ''}`}
                        onClick={() => handleChange('phone_confirm', !form.phone_confirm)}
                        aria-pressed={form.phone_confirm}
                      >
                        <span className="toggle-knob" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Status */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label className="form-label">Account Status</label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px',
                  border: `1px solid ${form.is_active ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '8px',
                  background: form.is_active ? '#f0fdf4' : '#fff1f2',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                  />
                  <span style={{
                    fontSize: '14px', fontWeight: '600',
                    color: form.is_active ? '#166534' : '#991b1b'
                  }}>
                    {form.is_active ? '✓ Active' : '✗ Disabled'}
                  </span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="admin-form-actions">
              <button type="submit" className="btn-primary admin-submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    Creating User…
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Create User
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={resetForm}
                disabled={loading}
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
