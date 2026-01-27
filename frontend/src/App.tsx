import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/Dashboard';
import Activities from './pages/Activities';
// import ActivityForm from './pages/ActivityForm';
import ActivityDetailPage from '@/pages/ActivityDetailPage';
import ActivityEditPage from '@/pages/ActivityEditPage';
import ActivityCreatePage from '@/pages/ActivityCreatePage';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import MyProfile from './pages/MyProfile';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Calendar from './pages/Calendar';
import { AuthProvider, useAuth } from './lib/auth';
import { OrgScopeProvider } from './lib/orgScope';
import AdminOrgSetup from './pages/AdminOrgSetup';
import OrgUserManagement from './pages/OrgUserManagement';
import SuperAdminAudit from './pages/SuperAdminAudit';
import AcceptInvite from './pages/AcceptInvite';
import ResetRequest from './pages/ResetRequest';
import ResetPassword from './pages/ResetPassword';
import ProjectPickerPage from '@/pages/ProjectPickerPage';
import PostLoginPrefetch from '@/components/PostLoginPrefetch';

function App() {
  // App-level providers

  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Public route for invite acceptance */}
          <Route path="/accept-invite" element={<AcceptInvite />} />
          {/* Public routes for password reset */}
          <Route path="/reset-password-request" element={<ResetRequest />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Everything else requires auth */}
          <Route
            path="/*"
            element={
              <AuthProvider>
                <OrgScopeProvider>
                  <AuthedRoutes />
                </OrgScopeProvider>
              </AuthProvider>
            }
          />
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
    <PostLoginPrefetch>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="activities" element={<Activities />} />
          {/* Mobile-first flow: select project then create */}
          <Route path="activities/new/select-project" element={<ProjectPickerPage />} />
          <Route path="activities/new" element={<ActivityCreatePage />} />
          <Route path="activities/:id" element={<ActivityDetailPage />} />
          <Route path="activities/:id/edit" element={<ActivityEditPage />} />
          <Route path="projects" element={<Projects />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="me" element={<MyProfile />} />
          <Route path="settings" element={<Settings />} />
          {/* Admin routes */}
          {(user.role === 'org_admin' || user.role === 'superadmin') && (
            <Route path="admin/orgs" element={<AdminOrgSetup />} />
          )}
          {user.role === 'superadmin' && <Route path="admin/audit" element={<SuperAdminAudit />} />}
          {(user.role === 'org_admin' || user.role === 'superadmin') && (
            <Route path="admin/users" element={<OrgUserManagement />} />
          )}
        </Route>
      </Routes>
    </PostLoginPrefetch>
  );
}
