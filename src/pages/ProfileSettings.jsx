import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  User,
  Phone,
  Lock,
  Save,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Settings,
} from 'lucide-react';

export default function ProfileSettings({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile fields
  const [phone, setPhone] = useState('');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Track original values to detect changes
  const [originalPhone, setOriginalPhone] = useState('');

  useEffect(() => {
    if (user) {
      const ph = user.phone || '';
      setPhone(ph);
      setOriginalPhone(ph);
    }
  }, [user]);

  const clearMessages = () => {
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const hasProfileChanges = phone !== originalPhone;
  const hasPasswordChanges = newPassword.length > 0 || confirmPassword.length > 0;

  const handleCancel = () => {
    navigate('/');
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validate password if user is trying to change it
    if (hasPasswordChanges) {
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }
    }

    if (!hasProfileChanges && !hasPasswordChanges) {
      setError('No changes detected.');
      setLoading(false);
      return;
    }

    try {
      // Build the update payload for the Edge Function (uses admin API, no SMS verification)
      const updatePayload = {
        id: user.id,
      };

      if (hasProfileChanges) {
        updatePayload.phone = phone.trim();
      }

      if (hasPasswordChanges) {
        updatePayload.password = newPassword;
      }

      const { data, error: invokeError } = await supabase.functions.invoke('create-user', {
        method: 'PUT',
        body: updatePayload,
      });

      if (invokeError) {
        setError(invokeError.message || 'Failed to update profile.');
      } else if (data?.error) {
        setError(data.error);
      } else {
        const messages = [];
        if (hasProfileChanges) messages.push('Profile updated');
        if (hasPasswordChanges) messages.push('Password changed');
        setSuccess(messages.join(' and ') + ' successfully!');

        // Update originals so "no changes" works correctly
        setOriginalPhone(phone.trim());

        // Clear password fields
        setNewPassword('');
        setConfirmPassword('');

        // Refresh the session so updated phone is reflected in the UI
        await supabase.auth.refreshSession();
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    }

    setLoading(false);
  };

  const email = user?.email || '';
  const initial = (user?.user_metadata?.full_name || email || 'U').charAt(0).toUpperCase();

  return (
    <div className="page-container">
      <h1 className="page-title">Profile Settings</h1>

      <div className="admin-layout">
        <div className="content-card admin-card">
          <div className="admin-card-header">
            <div className="admin-card-icon">
              <Settings size={22} />
            </div>
            <div>
              <h2 className="admin-card-title">Update Your Profile</h2>
              <p className="admin-card-desc">
                Manage your personal information and security settings.
              </p>
            </div>
          </div>

          {/* Current User Info Banner */}
          <div className="profile-settings-banner">
            <div className="profile-settings-avatar">{initial}</div>
            <div className="profile-settings-info">
              <span className="profile-settings-name">{user?.user_metadata?.full_name || 'User'}</span>
              <span className="profile-settings-email">{email}</span>
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

          <form onSubmit={handleUpdateProfile} className="admin-form profile-settings-form">
            {/* Section: Personal Information */}
            <div className="profile-section-label">
              <User size={15} />
              <span>Personal Information</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="profile-phone">
                  <Phone size={14} className="form-label-icon" />
                  Mobile Number
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  className="form-input"
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); clearMessages(); }}
                />
              </div>
            </div>

            {/* Section: Change Password */}
            <div className="profile-section-label" style={{ marginTop: '12px' }}>
              <Lock size={15} />
              <span>Change Password</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="profile-new-password">
                  <Lock size={14} className="form-label-icon" />
                  New Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="profile-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); clearMessages(); }}
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-confirm-password">
                  <Lock size={14} className="form-label-icon" />
                  Confirm Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="profile-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); clearMessages(); }}
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="admin-form-actions">
              <button
                type="submit"
                className="btn-primary admin-submit-btn"
                disabled={loading || (!hasProfileChanges && !hasPasswordChanges)}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
