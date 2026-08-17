import { Suspense, lazy, useEffect, useLayoutEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
// import ActivityForm from './pages/ActivityForm';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './lib/auth';
import { OrgScopeProvider } from './lib/orgScope';
import PostLoginPrefetch from '@/components/PostLoginPrefetch';
import { canAccessDevTools } from './lib/devToolsConfig';
import TermsAcceptanceGate from '@/components/TermsAcceptanceGate';
import { useTranslation } from 'react-i18next';
import { autoT } from '@/i18n/auto';

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed|error loading dynamically imported module/i.test(
    message,
  );
}

function reloadOnceAfterChunkError() {
  try {
    const key = 'stato_chunk_reload_once';
    const marker = `${window.location.pathname}${window.location.search}`;
    if (window.sessionStorage.getItem(key) === marker) return false;
    window.sessionStorage.setItem(key, marker);
    window.location.reload();
    return true;
  } catch {
    window.location.reload();
    return true;
  }
}

function lazyWithReload<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    factory().catch((error) => {
      if (isChunkLoadError(error) && reloadOnceAfterChunkError()) {
        return new Promise<{ default: T }>(() => undefined);
      }
      throw error;
    }),
  );
}

const Dashboard = lazyWithReload(() => import('./pages/Dashboard'));
const Activities = lazyWithReload(() => import('./pages/Activities'));
const ActivityDetailPage = lazyWithReload(() => import('@/pages/ActivityDetailPage'));
const ActivityEditPage = lazyWithReload(() => import('@/pages/ActivityEditPage'));
const ActivityCreatePage = lazyWithReload(() => import('@/pages/ActivityCreatePage'));
const Statistics = lazyWithReload(() => import('./pages/Statistics'));
const Settings = lazyWithReload(() => import('./pages/Settings'));
const MyProfile = lazyWithReload(() => import('./pages/MyProfile'));
const Projects = lazyWithReload(() => import('./pages/Projects'));
const Calendar = lazyWithReload(() => import('./pages/Calendar'));
const AdminOrgSetup = lazyWithReload(() => import('./pages/AdminOrgSetup'));
const OrgUserManagement = lazyWithReload(() => import('./pages/OrgUserManagement'));
const SuperAdminAudit = lazyWithReload(() => import('./pages/SuperAdminAudit'));
const SuperAdminSystemData = lazyWithReload(() => import('./pages/SuperAdminSystemData'));
const LegalAdministration = lazyWithReload(() => import('./pages/LegalAdministration'));
const SettingsTestData = lazyWithReload(() => import('./pages/SettingsTestData'));
const AcceptInvite = lazyWithReload(() => import('./pages/AcceptInvite'));
const ResetRequest = lazyWithReload(() => import('./pages/ResetRequest'));
const ResetPassword = lazyWithReload(() => import('./pages/ResetPassword'));
const ProjectPickerPage = lazyWithReload(() => import('@/pages/ProjectPickerPage'));
const Logbook = lazyWithReload(() => import('@/pages/Logbook'));
const LogbookEntryPage = lazyWithReload(() => import('@/pages/LogbookEntryPage'));
const Surveys = lazyWithReload(() => import('@/pages/Surveys'));
const Processes = lazyWithReload(() => import('@/pages/Processes'));
const SurveyDetail = lazyWithReload(() => import('@/pages/SurveyDetail'));
const PublicSurvey = lazyWithReload(() => import('@/pages/PublicSurvey'));
const SecurityArchitectureEmbed = lazyWithReload(() => import('@/pages/SecurityArchitectureEmbed'));

function LogbookEditorRoute() {
  return (
    <>
      <Logbook />
      <LogbookEntryPage />
    </>
  );
}

function LazyRouteFallback({ label }: { label: string }) {
  return <AppLoading label={label} />;
}

function RouteBoundary({ children, label }: { children: ReactNode; label: string }) {
  return <Suspense fallback={<LazyRouteFallback label={label} />}>{children}</Suspense>;
}

function AppLoading({ label }: { label: string }) {
  const { t } = useTranslation('common');
  return (
    <div className="flex min-h-screen items-start justify-center px-4 pt-24">
      <div className="modern-card flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600">
        <span className="h-3 w-3 animate-pulse rounded-full bg-viridian" aria-hidden="true" />
        <span>{t('loading.route', { label })}</span>
      </div>
    </div>
  );
}

function App() {
  const { t } = useTranslation('common');
  // App-level providers
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const error = 'reason' in event ? event.reason : event.error;
      if (isChunkLoadError(error) && reloadOnceAfterChunkError()) {
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);
    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
    };
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTopOnPathChange />
      <ToastProvider>
        <Routes>
          {/* Public route for invite acceptance */}
          <Route
            path="/accept-invite"
            element={
              <RouteBoundary label={t('routes.invitation')}>
                <AcceptInvite />
              </RouteBoundary>
            }
          />
          {/* Public routes for password reset */}
          <Route
            path="/reset-password-request"
            element={
              <RouteBoundary label={t('routes.passwordReset')}>
                <ResetRequest />
              </RouteBoundary>
            }
          />
          <Route
            path="/reset-password"
            element={
              <RouteBoundary label={t('routes.passwordReset')}>
                <ResetPassword />
              </RouteBoundary>
            }
          />
          <Route
            path="/survey/:token"
            element={
              <RouteBoundary label={t('routes.survey')}>
                <PublicSurvey />
              </RouteBoundary>
            }
          />
          <Route
            path="/security-architecture"
            element={
              <RouteBoundary label="Sicherheitsarchitektur">
                <SecurityArchitectureEmbed />
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
  const { t } = useTranslation('common');
  const { user, loading } = useAuth();

  if (loading) return <AppLoading label={autoT('ui_148c60ecba84')} />;

  if (!user) return <Login />;

  if (user.mustChangePassword) {
    return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/me" replace />} />
          <Route
            path="me"
            element={
              <RouteBoundary label={t('routes.profile')}>
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
              <RouteBoundary label={t('navigation.dashboard')}>
                <Dashboard />
              </RouteBoundary>
            }
          />
          <Route
            path="activities"
            element={
              <RouteBoundary label={t('navigation.activities')}>
                <Activities />
              </RouteBoundary>
            }
          />
          {/* Mobile-first flow: select project then create */}
          <Route
            path="activities/new/select-project"
            element={
              <RouteBoundary label={t('routes.projectSelection')}>
                <ProjectPickerPage />
              </RouteBoundary>
            }
          />
          <Route
            path="activities/new"
            element={
              <RouteBoundary label={t('routes.newActivity')}>
                <ActivityCreatePage />
              </RouteBoundary>
            }
          />
          <Route
            path="activities/:id"
            element={
              <RouteBoundary label={t('routes.activity')}>
                <ActivityDetailPage />
              </RouteBoundary>
            }
          />
          <Route
            path="activities/:id/edit"
            element={
              <RouteBoundary label={t('routes.editActivity')}>
                <ActivityEditPage />
              </RouteBoundary>
            }
          />
          <Route
            path="logbook"
            element={
              <RouteBoundary label={t('navigation.logbook')}>
                <Logbook />
              </RouteBoundary>
            }
          />
          <Route
            path="logbook/new"
            element={
              <RouteBoundary label={t('routes.newLogbookEntry')}>
                <LogbookEditorRoute />
              </RouteBoundary>
            }
          />
          <Route
            path="logbook/:id"
            element={
              <RouteBoundary label={t('routes.logbookEntry')}>
                <LogbookEntryPage />
              </RouteBoundary>
            }
          />
          <Route
            path="logbook/:id/edit"
            element={
              <RouteBoundary label={t('routes.editLogbookEntry')}>
                <LogbookEditorRoute />
              </RouteBoundary>
            }
          />
          <Route
            path="projects"
            element={
              <RouteBoundary label={t('navigation.projects')}>
                <Projects />
              </RouteBoundary>
            }
          />
          <Route
            path="processes"
            element={
              <RouteBoundary label={t('navigation.processes')}>
                <Processes />
              </RouteBoundary>
            }
          />
          <Route
            path="calendar"
            element={
              <RouteBoundary label={t('navigation.calendar')}>
                <Calendar />
              </RouteBoundary>
            }
          />
          <Route
            path="statistics"
            element={
              <RouteBoundary label={t('navigation.statistics')}>
                <Statistics />
              </RouteBoundary>
            }
          />
          <Route
            path="surveys"
            element={
              <RouteBoundary label={t('navigation.surveys')}>
                <Surveys />
              </RouteBoundary>
            }
          />
          <Route
            path="surveys/:id"
            element={
              <RouteBoundary label={t('routes.survey')}>
                <SurveyDetail />
              </RouteBoundary>
            }
          />
          <Route
            path="me"
            element={
              <RouteBoundary label={t('routes.profile')}>
                <MyProfile />
              </RouteBoundary>
            }
          />
          <Route
            path="settings"
            element={
              <RouteBoundary label={t('navigation.settings')}>
                <Settings />
              </RouteBoundary>
            }
          />
          {/* Admin routes */}
          {(user.role === 'org_admin' || user.role === 'superadmin') && (
            <Route
              path="admin/orgs"
              element={
                <RouteBoundary label={t('userMenu.organizations')}>
                  <AdminOrgSetup />
                </RouteBoundary>
              }
            />
          )}
          {canAccessDevTools(user.role) && (
            <Route
              path="admin/dev-tools"
              element={
                <RouteBoundary label={t('routes.devTools')}>
                  <SettingsTestData />
                </RouteBoundary>
              }
            />
          )}
          {user.role === 'superadmin' && (
            <Route
              path="admin/audit"
              element={
                <RouteBoundary label={t('routes.audit')}>
                  <SuperAdminAudit />
                </RouteBoundary>
              }
            />
          )}
          {user.role === 'superadmin' && (
            <Route
              path="admin/legal"
              element={
                <RouteBoundary label="Rechtstexte">
                  <LegalAdministration />
                </RouteBoundary>
              }
            />
          )}
          {user.role === 'superadmin' && (
            <Route
              path="admin/system-data"
              element={
                <RouteBoundary label={t('routes.systemData')}>
                  <SuperAdminSystemData />
                </RouteBoundary>
              }
            />
          )}
          {(user.role === 'org_admin' || user.role === 'superadmin') && (
            <Route
              path="admin/users"
              element={
                <RouteBoundary label={t('routes.userManagement')}>
                  <OrgUserManagement />
                </RouteBoundary>
              }
            />
          )}
          {/* A scope switch can reduce the effective role (for example from
              org admin to editor). Always leave an unavailable admin route
              for a safe, usable page instead of rendering no matching route. */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </PostLoginPrefetch>
  );
}
