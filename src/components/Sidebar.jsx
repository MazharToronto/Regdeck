import { NavLink, useNavigate } from 'react-router-dom';
import { Home, FileText, PlusCircle, LogOut, Shield, Users, UserPlus, Headphones, Settings, Menu, ChevronLeft, Layers, LayoutGrid, BarChart3, List, FileSpreadsheet, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Sidebar({ canManageUsers, canCreate, isManager, isAdmin, isOpen, onToggle }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <nav className={`sidebar ${!isOpen ? 'collapsed' : ''}`}>
      <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '1.5rem', padding: '0 0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
          <div className="sidebar-logo" style={{ flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          {isOpen && <span className="sidebar-brand-text">InvoiceGen</span>}
        </div>
        <button 
          className="sidebar-toggle-btn" 
          onClick={onToggle} 
          style={{ background: 'rgba(99,102,241,0.1)', border: 'none', cursor: 'pointer', color: '#6366f1', borderRadius: '6px', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div className="sidebar-nav">
        <NavLink to="/home" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Home size={18} />
          <span>Home</span>
        </NavLink>

        {!canManageUsers && (
          <NavLink to="/ee-dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <LayoutGrid size={18} />
            <span>Dashboard</span>
          </NavLink>
        )}

        <NavLink to="/records" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <FileText size={18} />
          <span>My Requests</span>
        </NavLink>

        <NavLink to="/board-view" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <LayoutGrid size={18} />
          <span>Board View</span>
        </NavLink>

        <NavLink to="/group-view-request" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <List size={18} />
          <span>My Group View</span>
        </NavLink>

        {canCreate && (
          <NavLink to="/create" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <PlusCircle size={18} />
            <span>Create work order</span>
          </NavLink>
        )}

        {canManageUsers && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section-title">Admin</div>
            <NavLink to="/dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <BarChart3 size={18} />
              <span>Reports</span>
            </NavLink>
            <NavLink to="/admin/users" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Users size={18} />
              <span>Manage Users</span>
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin/rates" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <DollarSign size={18} />
                <span>Manage Rates</span>
              </NavLink>
            )}
            <NavLink to="/invoice-generation" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <FileSpreadsheet size={18} />
              <span>Invoice Gen</span>
            </NavLink>
            <NavLink to="/bulk-update" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <RefreshCw size={18} />
              <span>Bulk Update</span>
            </NavLink>
          </>
        )}

        {isManager && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section-title">Manager</div>
            <NavLink to="/invoice-dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <TrendingUp size={18} />
              <span>Invoice Dashboard</span>
            </NavLink>
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Settings size={18} />
          <span>Profile Settings</span>
        </NavLink>
        <button className="sidebar-link" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );
}
