import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { Users, Edit2, AlertCircle, CheckCircle, Search, Mail, Phone, Briefcase, User, X } from 'lucide-react';

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

  // Fetch users and roles on mount
  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('*').order('role_name');
    if (data) setRoles(data);
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
      <h1 className="page-title">Manage Users</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
        View and manage all system users and their roles.
      </p>

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
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                        onClick={() => setEditingUser(user)}
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
    </div>
  );
}
