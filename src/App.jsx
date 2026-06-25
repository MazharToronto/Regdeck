import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Login from './pages/Login';
import CreateRecord from './pages/CreateRecord';
import Reports from './pages/Reports';
import Home from './pages/Home';
import AdminScreen from './pages/AdminScreen';
import AllUsersScreen from './pages/AllUsersScreen';
import AudioLengthCalculator from './pages/AudioLengthCalculator';
import ProfileSettings from './pages/ProfileSettings';
import GroupedWorkOrders from './pages/GroupedWorkOrders';
import CreativeGroupedView from './pages/CreativeGroupedView';
import Dashboard from './pages/Dashboard';
import MyGroupViewRequest from './pages/MyGroupViewRequest';
import InvoiceGeneration from './pages/InvoiceGeneration';
import InvoiceDashboard from './pages/InvoiceDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ReferenceRates from './pages/ReferenceRates';
import BulkUpdateWorkOrders from './pages/BulkUpdateWorkOrders';

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="loading-screen">Loading...</div>;

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  // Extract roles from JWT
  const decodedToken = parseJwt(session.access_token);
  const userRoles = decodedToken?.user_roles || [];
  const isAdmin = userRoles.includes('admin');
  const isManager = userRoles.includes('manager');
  const canCreate = isAdmin || isManager;
  const canManageUsers = isAdmin || isManager;
  const isEmployee = !isAdmin && !isManager;
  const defaultRoute = isEmployee ? '/records' : '/create';

  return (
    <div className={`app-shell ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      <Sidebar 
        canManageUsers={canManageUsers} 
        canCreate={canCreate} 
        isManager={isManager}
        isAdmin={isAdmin}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <div className="app-main">
        <TopBar user={session?.user} userRoles={userRoles} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to={defaultRoute} />} />
            <Route path="/home" element={<Home canCreate={canCreate} />} />
            {canCreate && (
              <Route path="/create" element={<CreateRecord user={session?.user} />} />
            )}
            {isEmployee && (
              <Route path="/ee-dashboard" element={<EmployeeDashboard user={session?.user} />} />
            )}
            <Route path="/records" element={<Reports userRoles={userRoles} user={session?.user} />} />
            <Route path="/audio-calculator" element={<AudioLengthCalculator />} />
            <Route path="/grouped-view" element={<GroupedWorkOrders />} />
            <Route path="/board-view" element={<CreativeGroupedView userRoles={userRoles} user={session?.user} />} />
            <Route path="/group-view-request" element={<MyGroupViewRequest userRoles={userRoles} user={session?.user} />} />
            <Route path="/profile" element={<ProfileSettings user={session?.user} />} />
            {canManageUsers && (
              <>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admin/users" element={<AllUsersScreen />} />
                <Route path="/admin/create" element={<AdminScreen />} />
                <Route path="/invoice-generation" element={<InvoiceGeneration userRoles={userRoles} />} />
                <Route path="/bulk-update" element={<BulkUpdateWorkOrders />} />
                <Route path="/admin" element={<Navigate to="/admin/users" />} />
              </>
            )}
            {isAdmin && (
              <Route path="/admin/rates" element={<ReferenceRates />} />
            )}
            {isManager && (
              <Route path="/invoice-dashboard" element={<InvoiceDashboard />} />
            )}
            <Route path="*" element={<Navigate to={defaultRoute} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
