import { NavLink, useNavigate } from 'react-router-dom';
import { Home, FileText, PlusCircle, LogOut, User } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <span className="sidebar-brand-text">InvoiceGen</span>
      </div>

      <div className="sidebar-nav">
        <NavLink to="/home" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Home size={18} />
          <span>Home</span>
        </NavLink>

        <NavLink to="/records" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <FileText size={18} />
          <span>My Requests</span>
        </NavLink>

        <NavLink to="/create" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <PlusCircle size={18} />
          <span>Create work order</span>
        </NavLink>
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-link" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );
}
