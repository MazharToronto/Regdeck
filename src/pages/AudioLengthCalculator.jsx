import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Headphones, Search, AlertCircle, CheckCircle } from 'lucide-react';

export default function AudioLengthCalculator() {
  const [searchType, setSearchType] = useState('work_order_number');
  const [searchValue, setSearchValue] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const calculateCombinedAudioLength = (records) => {
    let totalSeconds = 0;
    records.forEach(r => {
      if (!r.audio_length) return;
      const parts = String(r.audio_length).split(':').map(Number);
      if (parts.length === 3) {
        totalSeconds += (parts[0] * 3600) + (parts[1] * 60) + (parts[2] || 0);
      } else if (parts.length === 2) {
        totalSeconds += (parts[0] * 60) + (parts[1] || 0);
      } else if (parts.length === 1 && !isNaN(parts[0])) {
        totalSeconds += parts[0] * 60; // Assume plain number means minutes
      }
    });

    if (totalSeconds === 0) return '00:00';

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchValue.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('audio_length')
        .eq(searchType, searchValue.trim());

      if (error) throw error;

      if (!data || data.length === 0) {
        setError(`No records found for ${searchType === 'due_date' ? 'Due' : 'Work Order #'} = "${searchValue}"`);
      } else {
        const totalFormatted = calculateCombinedAudioLength(data);
        setResult({
          count: data.length,
          totalLength: totalFormatted
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Audio Length Calculator</h1>

      <div className="content-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', color: '#4338ca' }}>
          <Headphones size={24} style={{ marginRight: '10px' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Calculate Combined Audio Length</h2>
        </div>

        <form onSubmit={handleSearch}>
          <div className="form-group">
            <label className="form-label">Search By (Exact Match)</label>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500' }}>
                <input 
                  type="radio" 
                  name="searchType" 
                  value="work_order_number" 
                  checked={searchType === 'work_order_number'} 
                  onChange={(e) => { setSearchType(e.target.value); setSearchValue(''); setResult(null); setError(null); }}
                  style={{ accentColor: '#4f46e5' }}
                />
                Work Order #
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500' }}>
                <input 
                  type="radio" 
                  name="searchType" 
                  value="due_date" 
                  checked={searchType === 'due_date'} 
                  onChange={(e) => { setSearchType(e.target.value); setSearchValue(''); setResult(null); setError(null); }}
                  style={{ accentColor: '#4f46e5' }}
                />
                Due
              </label>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">
              {searchType === 'due_date' ? 'Select Due' : 'Enter Work Order #'}
            </label>
            <input
              type={searchType === 'due_date' ? 'date' : 'text'}
              className="form-input"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={searchType === 'due_date' ? '' : 'e.g., RCE-12345-AB'}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading || !searchValue.trim()}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
          >
            <Search size={18} />
            {loading ? 'Calculating...' : 'Calculate Length'}
          </button>
        </form>

        {error && (
          <div className="alert alert-error" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center' }}>
            <AlertCircle size={20} style={{ marginRight: '8px', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div style={{ 
            marginTop: '2rem', 
            padding: '1.5rem', 
            backgroundColor: '#f0fdf4', 
            border: '1px solid #bbf7d0', 
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <CheckCircle size={32} color="#16a34a" style={{ margin: '0 auto 10px' }} />
            <h3 style={{ fontSize: '1.1rem', color: '#166534', marginBottom: '8px' }}>Calculation Complete</h3>
            <p style={{ color: '#15803d', marginBottom: '16px' }}>Found <strong>{result.count}</strong> record(s) matching your search.</p>
            <div style={{ backgroundColor: '#ffffff', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <span style={{ display: 'block', fontSize: '0.9rem', color: '#64748b', marginBottom: '4px' }}>Total Combined Audio Length</span>
              <span style={{ fontSize: '2rem', fontWeight: '700', color: '#16a34a' }}>{result.totalLength}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
