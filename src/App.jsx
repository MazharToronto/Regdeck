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

  return (
    <div className="app-shell">
      <Sidebar isAdmin={isAdmin} />
      <div className="app-main">
        <TopBar user={session?.user} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/home" />} />
            <Route path="/home" element={<Home />} />
            <Route path="/create" element={<CreateRecord user={session?.user} />} />
            <Route path="/records" element={<Reports />} />
            {isAdmin && (
              <>
                <Route path="/admin/users" element={<AllUsersScreen />} />
                <Route path="/admin/create" element={<AdminScreen />} />
                <Route path="/admin" element={<Navigate to="/admin/users" />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/home" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
