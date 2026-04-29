import { useState, useRef, useEffect } from 'react';
import { User } from 'lucide-react';

export default function ProfileDropdown({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const fullName = user?.user_metadata?.full_name || 'User';
  const email = user?.email || '';
  const initial = fullName.charAt(0).toUpperCase();

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="profile-wrapper" ref={ref}>
      <button className="profile-trigger" onClick={() => setOpen(!open)} title="Profile">
        <div className="profile-avatar">
          <User size={20} />
        </div>
      </button>

      {open && (
        <div className="profile-dropdown">
          <div className="profile-dropdown-header">
            <div className="profile-dropdown-avatar">{initial}</div>
            <div className="profile-dropdown-info">
              <span className="profile-dropdown-name">{fullName}</span>
              <span className="profile-dropdown-email">{email}</span>
            </div>
          </div>
          <div className="profile-dropdown-meta">
            <div className="profile-meta-row">
              <span className="profile-meta-label">User ID</span>
              <span className="profile-meta-value">{user?.id?.slice(0, 8)}...</span>
            </div>
            <div className="profile-meta-row">
              <span className="profile-meta-label">Joined</span>
              <span className="profile-meta-value">{new Date(user?.created_at).toLocaleDateString()}</span>
            </div>
            <div className="profile-meta-row">
              <span className="profile-meta-label">Provider</span>
              <span className="profile-meta-value">{user?.app_metadata?.provider || 'email'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
