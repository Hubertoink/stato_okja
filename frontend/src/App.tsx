import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/Dashboard';
import Activities from './pages/Activities';
import ActivityForm from './pages/ActivityForm';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import MyProfile from './pages/MyProfile';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Calendar from './pages/Calendar';
import { AuthProvider, useAuth } from './lib/auth';
import AdminOrgSetup from './pages/AdminOrgSetup';
import OrgUserManagement from './pages/OrgUserManagement';
import AcceptInvite from './pages/AcceptInvite';

function App() {
  // App-level providers

  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Public route for invite acceptance */}
          <Route path="/accept-invite" element={<AcceptInvite />} />
          {/* Everything else requires auth */}
          <Route path="/*" element={
            <AuthProvider>
              <AuthedRoutes />
            </AuthProvider>
          } />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;

function AuthedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Login />;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="activities" element={<Activities />} />
        <Route path="activities/new" element={<ActivityForm />} />
        <Route path="activities/:id/edit" element={<ActivityForm />} />
        <Route path="projects" element={<Projects />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="statistics" element={<Statistics />} />
  <Route path="me" element={<MyProfile />} />
        <Route path="settings" element={<Settings />} />
        {/* Mock admin routes */}
        {user.role === 'superadmin' && (
          <Route path="admin/orgs" element={<AdminOrgSetup />} />
        )}
        {(user.role === 'org_admin' || user.role === 'superadmin') && (
          <Route path="admin/users" element={<OrgUserManagement />} />
        )}
      </Route>
    </Routes>
  );
}
