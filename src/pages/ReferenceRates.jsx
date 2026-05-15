import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ReferenceRates() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inlineEdits, setInlineEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reference_rate')
      .select('id, language, tat, rate_per_word')
      .order('language', { ascending: true })
      .order('tat', { ascending: true });

    if (error) {
      console.error('Error fetching reference rates:', error);
      showToast('Failed to load reference rates.');
    } else {
      setRates(data || []);
    }
    setLoading(false);
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const toggleInlineEdit = (record) => {
    if (!inlineEdits[record.id]) {
      setInlineEdits(prev => ({
        ...prev,
        [record.id]: { ...record }
      }));
    }
  };

  const handleInlineChange = (recordId, value) => {
    setInlineEdits(prev => ({
      ...prev,
      [recordId]: { ...prev[recordId], rate_per_word: value }
    }));
  };

  const handleRowSave = async (id) => {
    const draft = inlineEdits[id];
    if (!draft) return;

    setSaving(true);
    const parsedValue = parseFloat(draft.rate_per_word);
    
    if (isNaN(parsedValue)) {
      showToast('Please enter a valid numeric rate.');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('reference_rate')
      .update({ rate_per_word: parsedValue })
      .eq('id', id);

    if (error) {
      console.error('Error updating rate:', error);
      showToast('Failed to update rate.');
    } else {
      showToast('Rate updated successfully!');
      setRates(rates.map(r => r.id === id ? { ...r, rate_per_word: parsedValue } : r));
      
      setInlineEdits(prev => {
        const newEdits = { ...prev };
        delete newEdits[id];
        return newEdits;
      });
    }
    setSaving(false);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Manage Reference Rates</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>
        View and update the rate per word for specific languages and turnaround times (TAT).
      </p>

      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: '#1e293b', color: '#fff', padding: '12px 24px',
          borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {toastMessage}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading rates...</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600' }}>Language</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600' }}>TAT</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600' }}>Rate per word</th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    No reference rates found in the database.
                  </td>
                </tr>
              ) : (
                rates.map(rate => {
                  const isEditing = !!inlineEdits[rate.id];
                  const draft = inlineEdits[rate.id] || rate;

                  return (
                    <tr 
                      key={rate.id} 
                      onClick={() => { if (!isEditing) toggleInlineEdit(rate); }}
                      onBlur={(e) => {
                        if (isEditing && !e.currentTarget.contains(e.relatedTarget)) {
                          handleRowSave(rate.id);
                        }
                      }}
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        cursor: isEditing ? 'default' : 'pointer',
                        ...(isEditing ? { backgroundColor: 'rgba(99, 102, 241, 0.04)' } : {})
                      }}
                    >
                      <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: '500' }}>{rate.language}</td>
                      <td style={{ padding: '12px 16px', color: '#1e293b' }}>{rate.tat}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.001"
                            value={draft.rate_per_word}
                            onChange={(e) => handleInlineChange(rate.id, e.target.value)}
                            disabled={saving}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #3b82f6',
                              borderRadius: '4px',
                              width: '100px',
                              outline: 'none',
                              backgroundColor: '#fff'
                            }}
                            autoFocus
                          />
                        ) : (
                          <span style={{ color: '#0f172a', fontWeight: '500' }}>
                            ${parseFloat(rate.rate_per_word).toFixed(3)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
