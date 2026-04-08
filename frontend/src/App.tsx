import { useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
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
import SettingsTestData from './pages/SettingsTestData';
import AcceptInvite from './pages/AcceptInvite';
import ResetRequest from './pages/ResetRequest';
import ResetPassword from './pages/ResetPassword';
import ProjectPickerPage from '@/pages/ProjectPickerPage';
import PostLoginPrefetch from '@/components/PostLoginPrefetch';
import { canAccessDevTools } from './lib/devToolsConfig';

function App() {
  // App-level providers

  return (
    <BrowserRouter>
      <ScrollToTopOnPathChange />
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

function ScrollToTopOnPathChange() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (hash || navigationType === 'POP') return;

    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash, navigationType]);

  return null;
}

function AuthedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Login />;

  if (user.mustChangePassword) {
    return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/me" replace />} />
          <Route path="me" element={<MyProfile />} />
          <Route path="*" element={<Navigate to="/me" replace />} />
        </Route>
      </Routes>
    );
  }

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
          {canAccessDevTools(user.role) && <Route path="admin/dev-tools" element={<SettingsTestData />} />}
          {user.role === 'superadmin' && <Route path="admin/audit" element={<SuperAdminAudit />} />}
          {(user.role === 'org_admin' || user.role === 'superadmin') && (
            <Route path="admin/users" element={<OrgUserManagement />} />
          )}
        </Route>
      </Routes>
    </PostLoginPrefetch>
  );
}
