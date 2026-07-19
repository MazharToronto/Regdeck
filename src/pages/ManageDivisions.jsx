import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Navigate } from 'react-router-dom';
import { Layers, Plus, Trash2, Edit2, X, Search, AlertCircle } from 'lucide-react';

export default function ManageDivisions({ userRoles = [] }) {
  const isAdmin = userRoles.includes('admin');
  const isManager = userRoles.includes('manager');
  const hasAccess = isAdmin || isManager;

  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // id of row being edited
  const [formData, setFormData] = useState({
    division: '',
    gl: '',
    cc: '',
    fa: '',
    fund: '',
    io: ''
  });

  useEffect(() => {
    if (hasAccess) {
      fetchMappings();
    }
  }, [hasAccess]);

  const fetchMappings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('division_mappings')
      .select('*')
      .order('division', { ascending: true });

    if (error) {
      console.error('Error fetching division mappings:', error);
      showToast('Failed to load division mappings.');
    } else {
      setMappings(data || []);
    }
    setLoading(false);
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormData({
      division: '',
      gl: '',
      cc: '',
      fa: '',
      fund: '',
      io: ''
    });
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingId(item.id);
    setFormData({
      division: item.division,
      gl: item.gl,
      cc: item.cc,
      fa: item.fa,
      fund: item.fund,
      io: item.io || ''
    });
    setShowForm(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.division.trim() || !formData.gl.trim() || !formData.cc.trim() || !formData.fa.trim() || !formData.fund.trim()) {
      showToast('Please fill all required fields.');
      return;
    }

    setSaving(true);
    const payload = {
      division: formData.division.trim().toUpperCase(),
      gl: formData.gl.trim(),
      cc: formData.cc.trim(),
      fa: formData.fa.trim(),
      fund: formData.fund.trim(),
      io: formData.io.trim() || null
    };

    if (editingId) {
      // Update
      const { error } = await supabase
        .from('division_mappings')
        .update(payload)
        .eq('id', editingId);

      if (error) {
        console.error('Error updating mapping:', error);
        showToast('Failed to update mapping. Make sure Division is unique.');
      } else {
        showToast('Mapping updated successfully!');
        setShowForm(false);
        fetchMappings();
      }
    } else {
      // Create
      const { error } = await supabase
        .from('division_mappings')
        .insert([payload]);

      if (error) {
        console.error('Error creating mapping:', error);
        showToast('Failed to create mapping. Make sure Division is unique.');
      } else {
        showToast('Mapping created successfully!');
        setShowForm(false);
        fetchMappings();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this division mapping?')) return;

    const { error } = await supabase
      .from('division_mappings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting mapping:', error);
      showToast('Failed to delete mapping.');
    } else {
      showToast('Mapping deleted successfully!');
      fetchMappings();
    }
  };

  if (!hasAccess) {
    return <Navigate to="/records" replace />;
  }

  const filteredMappings = mappings.filter(item => 
    item.division.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.gl.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.cc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--text)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Layers size={28} style={{ color: 'var(--accent)' }} />
            Manage Division Codes
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Configure default accounting and billing codes (GL, CC, FA, Fund, IO) mapped to each work order Division.
          </p>
        </div>
        
        <button 
          onClick={openAddForm}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--r-md)',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-deep)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
        >
          <Plus size={16} />
          Add Division
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: 'var(--text)', color: 'var(--surface)', padding: '12px 24px',
          borderRadius: 'var(--r-md)', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Main card */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        
        {/* Search Strip */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', background: 'var(--canvas)' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            <input 
              type="text" 
              placeholder="Search by division, GL, CC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 1rem 0.55rem 2.25rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                fontSize: '13px',
                outline: 'none',
                background: '#fff'
              }}
            />
          </div>
        </div>

        {/* Table representation */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <div style={{ marginBottom: '1rem', fontWeight: '600' }}>Loading division mappings...</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--canvas)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Division</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>GL</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>CC</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>FA</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Fund</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>IO</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappings.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '3rem 1.25rem', textAlign: 'center', color: 'var(--text-faint)' }}>
                      <AlertCircle size={28} style={{ display: 'block', margin: '0 auto 0.75rem', color: 'var(--text-faint)' }} />
                      No division mappings found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredMappings.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }} className="table-row-hover">
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text)' }}>
                        <span style={{ display: 'inline-block', background: 'var(--subtle)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.85rem' }}>
                          {item.division}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.gl}</td>
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.cc}</td>
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.fa}</td>
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.fund}</td>
                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.io || '—'}</td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => openEditForm(item)}
                            title="Edit division mapping"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '4px', borderRadius: '4px' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-tint)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            title="Delete division mapping"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-fg)', padding: '4px', borderRadius: '4px' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--red-bg)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation / Edit Form Overlay Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(28,31,42,0.4)', backdropFilter: 'blur(4px)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', border: '1px solid var(--border)',
            width: '100%', maxWidth: '500px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            overflow: 'hidden', animation: 'scaleIn 0.25s ease'
          }}>
            {/* Modal header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
                {editingId ? 'Edit Division Mapping' : 'Add New Division Mapping'}
              </h2>
              <button 
                onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal content */}
            <form onSubmit={handleFormSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    Division Name *
                  </label>
                  <input 
                    type="text" 
                    name="division"
                    placeholder="e.g. RPD"
                    value={formData.division}
                    onChange={handleInputChange}
                    disabled={saving}
                    required
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      fontSize: '13px',
                      outline: 'none',
                      textTransform: 'uppercase'
                    }}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      GL Code *
                    </label>
                    <input 
                      type="text" 
                      name="gl"
                      placeholder="e.g. 504046"
                      value={formData.gl}
                      onChange={handleInputChange}
                      disabled={saving}
                      required
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-md)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      CC Code *
                    </label>
                    <input 
                      type="text" 
                      name="cc"
                      placeholder="e.g. 816232"
                      value={formData.cc}
                      onChange={handleInputChange}
                      disabled={saving}
                      required
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-md)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      FA Code *
                    </label>
                    <input 
                      type="text" 
                      name="fa"
                      placeholder="e.g. 4301"
                      value={formData.fa}
                      onChange={handleInputChange}
                      disabled={saving}
                      required
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-md)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      Fund *
                    </label>
                    <input 
                      type="text" 
                      name="fund"
                      placeholder="e.g. 8110"
                      value={formData.fund}
                      onChange={handleInputChange}
                      disabled={saving}
                      required
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-md)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    IO Code (Optional)
                  </label>
                  <input 
                    type="text" 
                    name="io"
                    placeholder="e.g. 5050"
                    value={formData.io}
                    onChange={handleInputChange}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
              
              {/* Modal action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: 'var(--subtle)',
                    color: 'var(--text)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--r-md)',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : 'Save Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
