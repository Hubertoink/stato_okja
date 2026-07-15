import { Suspense, lazy, useLayoutEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
// import ActivityForm from './pages/ActivityForm';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './lib/auth';
import { OrgScopeProvider } from './lib/orgScope';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Activities = lazy(() => import('./pages/Activities'));
const ActivityDetailPage = lazy(() => import('@/pages/ActivityDetailPage'));
const ActivityEditPage = lazy(() => import('@/pages/ActivityEditPage'));
const ActivityCreatePage = lazy(() => import('@/pages/ActivityCreatePage'));
import PostLoginPrefetch from '@/components/PostLoginPrefetch';
import { canAccessDevTools } from './lib/devToolsConfig';
import TermsAcceptanceGate from '@/components/TermsAcceptanceGate';

const Statistics = lazy(() => import('./pages/Statistics'));
const Settings = lazy(() => import('./pages/Settings'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const Projects = lazy(() => import('./pages/Projects'));
const Calendar = lazy(() => import('./pages/Calendar'));
const AdminOrgSetup = lazy(() => import('./pages/AdminOrgSetup'));
const OrgUserManagement = lazy(() => import('./pages/OrgUserManagement'));
const SuperAdminAudit = lazy(() => import('./pages/SuperAdminAudit'));
const SuperAdminSystemData = lazy(() => import('./pages/SuperAdminSystemData'));
const SettingsTestData = lazy(() => import('./pages/SettingsTestData'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const ResetRequest = lazy(() => import('./pages/ResetRequest'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ProjectPickerPage = lazy(() => import('@/pages/ProjectPickerPage'));
const Logbook = lazy(() => import('@/pages/Logbook'));
const LogbookEntryPage = lazy(() => import('@/pages/LogbookEntryPage'));

function LazyRouteFallback({ label }: { label: string }) {
  return <div className="p-6 text-sm text-gray-500">{label} wird geladen…</div>;
}

function RouteBoundary({ children, label }: { children: ReactNode; label: string }) {
  return <Suspense fallback={<LazyRouteFallback label={label} />}>{children}</Suspense>;
}

function App() {
  // App-level providers

  return (
    <BrowserRouter>
      <ScrollToTopOnPathChange />
      <ToastProvider>
        <Routes>
          {/* Public route for invite acceptance */}
          <Route
            path="/accept-invite"
            element={
              <RouteBoundary label="Einladung">
                <AcceptInvite />
              </RouteBoundary>
            }
          />
          {/* Public routes for password reset */}
          <Route
            path="/reset-password-request"
            element={
              <RouteBoundary label="Passwort-Reset">
                <ResetRequest />
              </RouteBoundary>
            }
          />
          <Route
            path="/reset-password"
            element={
              <RouteBoundary label="Passwort-Reset">
                <ResetPassword />
              </RouteBoundary>
            }
          />
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
          <Route
            path="me"
            element={
              <RouteBoundary label="Profil">
                <MyProfile />
              </RouteBoundary>
            }
          />
          <Route path="*" element={<Navigate to="/me" replace />} />
        </Route>
      </Routes>
    );
  }

  if (user.termsAcceptanceRequired) return <TermsAcceptanceGate />;

  return (
    <PostLoginPrefetch>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <RouteBoundary label="Dashboard">
                <Dashboard />
              </RouteBoundary>
            }
          />
          <Route
            path="activities"
            element={
              <RouteBoundary label="Aktivitäten">
                <Activities />
              </RouteBoundary>
            }
          />
          {/* Mobile-first flow: select project then create */}
          <Route
            path="activities/new/select-project"
            element={
              <RouteBoundary label="Projektwahl">
                <ProjectPickerPage />
              </RouteBoundary>
            }
          />
          <Route
            path="activities/new"
            element={
              <RouteBoundary label="Neue Aktivität">
                <ActivityCreatePage />
              </RouteBoundary>
            }
          />
          <Route
            path="activities/:id"
            element={
              <RouteBoundary label="Aktivität">
                <ActivityDetailPage />
              </RouteBoundary>
            }
          />
          <Route
            path="activities/:id/edit"
            element={
              <RouteBoundary label="Aktivität bearbeiten">
                <ActivityEditPage />
              </RouteBoundary>
            }
          />
          <Route
            path="logbook"
            element={
              <RouteBoundary label="Logbuch">
                <Logbook />
              </RouteBoundary>
            }
          />
          <Route
            path="logbook/new"
            element={
              <RouteBoundary label="Neuer Logbucheintrag">
                <LogbookEntryPage />
              </RouteBoundary>
            }
          />
          <Route
            path="logbook/:id"
            element={
              <RouteBoundary label="Logbucheintrag">
                <LogbookEntryPage />
              </RouteBoundary>
            }
          />
          <Route
            path="logbook/:id/edit"
            element={
              <RouteBoundary label="Logbucheintrag bearbeiten">
                <LogbookEntryPage />
              </RouteBoundary>
            }
          />
          <Route
            path="projects"
            element={
              <RouteBoundary label="Projekte">
                <Projects />
              </RouteBoundary>
            }
          />
          <Route
            path="calendar"
            element={
              <RouteBoundary label="Kalender">
                <Calendar />
              </RouteBoundary>
            }
          />
          <Route
            path="statistics"
            element={
              <RouteBoundary label="Statistik">
                <Statistics />
              </RouteBoundary>
            }
          />
          <Route
            path="me"
            element={
              <RouteBoundary label="Profil">
                <MyProfile />
              </RouteBoundary>
            }
          />
          <Route
            path="settings"
            element={
              <RouteBoundary label="Einstellungen">
                <Settings />
              </RouteBoundary>
            }
          />
          {/* Admin routes */}
          {(user.role === 'org_admin' || user.role === 'superadmin') && (
            <Route
              path="admin/orgs"
              element={
                <RouteBoundary label="Organisationen">
                  <AdminOrgSetup />
                </RouteBoundary>
              }
            />
          )}
          {canAccessDevTools(user.role) && (
            <Route
              path="admin/dev-tools"
              element={
                <RouteBoundary label="Dev-Tools">
                  <SettingsTestData />
                </RouteBoundary>
              }
            />
          )}
          {user.role === 'superadmin' && (
            <Route
              path="admin/audit"
              element={
                <RouteBoundary label="Audit">
                  <SuperAdminAudit />
                </RouteBoundary>
              }
            />
          )}
          {user.role === 'superadmin' && (
            <Route
              path="admin/system-data"
              element={
                <RouteBoundary label="Systemdaten">
                  <SuperAdminSystemData />
                </RouteBoundary>
              }
            />
          )}
          {(user.role === 'org_admin' || user.role === 'superadmin') && (
            <Route
              path="admin/users"
              element={
                <RouteBoundary label="Benutzerverwaltung">
                  <OrgUserManagement />
                </RouteBoundary>
              }
            />
          )}
        </Route>
      </Routes>
    </PostLoginPrefetch>
  );
}
