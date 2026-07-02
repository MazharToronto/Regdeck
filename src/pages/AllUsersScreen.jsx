import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { Users, Edit2, AlertCircle, CheckCircle, Search, Mail, Phone, Briefcase, User, X, UserPlus, Lock, Eye, EyeOff } from 'lucide-react';

export default function AllUsersScreen() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);

  // Add User State
  const [showAddModal, setShowAddModal] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  // Fetch users and roles on mount
  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('*').order('role_name');
    if (data) {
      setRoles(data);
      if (data.length > 0) {
        setForm(prev => ({ ...prev, role_id: data[0].id }));
      }
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('create-user', {
        method: 'GET',
      });

      if (fetchError) throw fetchError;
      if (data?.error) throw new Error(data.error);

      setUsers(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: updateError } = await supabase.functions.invoke('create-user', {
        method: 'PUT',
        body: {
          id: editingUser.id,
          email: editingUser.email,
          phone: editingUser.phone,
          full_name: editingUser.full_name,
          role_id: editingUser.role_id,
          is_active: editingUser.is_active,
        },
      });

      if (updateError) throw updateError;
      if (data?.error) throw new Error(data.error);

      setSuccess(`User ${editingUser.email} updated successfully!`);
      setEditingUser(null);
      fetchUsers(); // Refresh list
    } catch (err) {
      setError(err.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && !saving) setEditingUser(null);
  };

  const handleBackdropAdd = (e) => {
    if (e.target === e.currentTarget && !loadingAdd) setShowAddModal(false);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoadingAdd(true);
    setError(null);
    setSuccess(null);

    // Basic validation
    if (!form.email.trim()) {
      setError('Email is required.');
      setLoadingAdd(false);
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoadingAdd(false);
      return;
    }
    if (!form.role_id) {
      setError('Please select a role.');
      setLoadingAdd(false);
      return;
    }

    try {
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
        setSuccess(`User "${data.user.email}" created successfully!`);
        setShowAddModal(false);
        // Reset form
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
        fetchUsers(); // Refresh list
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoadingAdd(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.full_name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.role_name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Manage Users</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
            View and manage all system users and their roles.
          </p>
        </div>
        <button 
          className="btn-primary" 
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', margin: 0 }}
          onClick={() => setShowAddModal(true)}
        >
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      {/* ===== Filter / Search Bar ===== */}
      <div className="filter-bar" style={{ display: 'flex', justifyContent: 'flex-start', padding: '16px 20px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
          <Search 
            size={18} 
            style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#a0a0b8', pointerEvents: 'none' }} 
          />
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', paddingLeft: '3rem', paddingRight: '1rem' }}
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          <CheckCircle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          {success}
        </div>
      )}

      {/* ===== Data Table ===== */}
      <div className="content-card">
        {loading ? (
          <p className="text-muted" style={{ padding: '20px' }}>Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <p className="text-muted">No users found matching "{searchTerm}"</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-grid">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <button 
                        className="link-btn"
                        onClick={() => setEditingUser(user)}
                        title="Click to edit"
                      >
                        {user.full_name || '—'}
                      </button>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.phone || '—'}</td>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>
                        {user.role_name}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: user.is_active !== false ? '#dcfce7' : '#fee2e2',
                        color: user.is_active !== false ? '#166534' : '#991b1b',
                      }}>
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: user.is_active !== false ? '#16a34a' : '#dc2626',
                          display: 'inline-block'
                        }} />
                        {user.is_active !== false ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                        onClick={() => setEditingUser({ ...user, is_active: user.is_active ?? true })}
                      >
                        <Edit2 size={14} style={{ marginRight: '6px' }} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && createPortal(
        <div className="modal-backdrop" onClick={handleBackdrop}>
          <div className="modal-panel" style={{ maxWidth: '750px', minHeight: '450px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Edit User</h2>
              <button className="modal-close" onClick={() => !saving && setEditingUser(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1 }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label"><User size={14} className="form-label-icon" /> Full Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editingUser.full_name || ''}
                        onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label"><Mail size={14} className="form-label-icon" /> Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={editingUser.email || ''}
                        onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label"><Phone size={14} className="form-label-icon" /> Phone</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={editingUser.phone || ''}
                        onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label"><Briefcase size={14} className="form-label-icon" /> Role</label>
                      <select
                        className="form-input form-select"
                        value={editingUser.role_id || ''}
                        onChange={(e) => setEditingUser({...editingUser, role_id: e.target.value})}
                        required
                      >
                        <option value="" disabled>Select a role</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <label className="form-label">Account Status</label>
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px',
                        border: `1px solid ${editingUser.is_active ? '#bbf7d0' : '#fecaca'}`,
                        borderRadius: '8px',
                        background: editingUser.is_active ? '#f0fdf4' : '#fff1f2',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}>
                        <input
                          type="checkbox"
                          checked={editingUser.is_active ?? true}
                          onChange={(e) => setEditingUser({...editingUser, is_active: e.target.checked})}
                          style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                        />
                        <span style={{
                          fontSize: '14px', fontWeight: '600',
                          color: editingUser.is_active ? '#166534' : '#991b1b'
                        }}>
                          {editingUser.is_active ? '✓ Active' : '✗ Disabled'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: 'auto', justifyContent: 'center' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => setEditingUser(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', marginTop: 0 }}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add User Modal */}
      {showAddModal && createPortal(
        <div className="modal-backdrop" onClick={handleBackdropAdd}>
          <div className="modal-panel" style={{ maxWidth: '750px', minHeight: '450px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Create New User</h2>
              <button className="modal-close" onClick={() => !loadingAdd && setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1 }}>
                  {/* Email & Password & Full Name */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label"><Mail size={14} className="form-label-icon" /> Email <span className="required-star">*</span></label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="user@example.com"
                        value={form.email}
                        onChange={(e) => setForm({...form, email: e.target.value})}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label"><Lock size={14} className="form-label-icon" /> Password <span className="required-star">*</span></label>
                      <div className="password-input-wrapper">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Min. 6 characters"
                          value={form.password}
                          onChange={(e) => setForm({...form, password: e.target.value})}
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label"><User size={14} className="form-label-icon" /> Full Name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="John Doe"
                        value={form.full_name}
                        onChange={(e) => setForm({...form, full_name: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Role & Phone & Status */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label"><Briefcase size={14} className="form-label-icon" /> Role <span className="required-star">*</span></label>
                      <select
                        className="form-input form-select"
                        value={form.role_id}
                        onChange={(e) => setForm({...form, role_id: e.target.value})}
                        required
                      >
                        <option value="" disabled>Select a role</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label"><Phone size={14} className="form-label-icon" /> Phone</label>
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="+1234567890"
                        value={form.phone}
                        onChange={(e) => setForm({...form, phone: e.target.value})}
                      />
                    </div>

                    {/* Auto-confirm and Account Status */}
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: '15px' }}>
                        <div>
                          <label className="form-label">Auto-confirm Email</label>
                          <div className="toggle-wrapper">
                            <button
                              type="button"
                              className={`toggle-btn ${form.email_confirm ? 'active' : ''}`}
                              onClick={() => setForm({...form, email_confirm: !form.email_confirm})}
                            >
                              <span className="toggle-knob" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="form-label">Auto-confirm Phone</label>
                          <div className="toggle-wrapper">
                            <button
                              type="button"
                              className={`toggle-btn ${form.phone_confirm ? 'active' : ''}`}
                              onClick={() => setForm({...form, phone_confirm: !form.phone_confirm})}
                            >
                              <span className="toggle-knob" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

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
                          onChange={(e) => setForm({...form, is_active: e.target.checked})}
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
                </div>

                <div className="modal-actions" style={{ marginTop: 'auto', justifyContent: 'center' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => setShowAddModal(false)}
                    disabled={loadingAdd}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={loadingAdd} style={{ width: 'auto', marginTop: 0 }}>
                    {loadingAdd ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
