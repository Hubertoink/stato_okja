import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Activity,
  BarChart3,
  Settings,
  Calendar as CalendarIcon,
  Boxes,
  UserCircle2,
  Building2,
  GitBranch,
  Lightbulb,
  BookOpen,
  Menu,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import logoUrl from '../../assets/Stato_Logo.png';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKeyboardOpen } from '@/lib/useKeyboardOpen';
import Modal from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import { listOrgs, type OrgDto, createOrgApi } from '@/lib/orgs';
import { api } from '@/lib/api';
import { canAccessDevTools } from '@/lib/devToolsConfig';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import { useToast } from '@/components/Toast';
import { ImprintModal } from '@/components/LegalModals';
import { QuickTally, QuickTallyMinimizedPill, useQuickTallySession } from '@/components/QuickTally';
import { useSessionTimeout } from '@/lib/sessionTimeout';
import { DEFAULT_PUBLIC_CONFIG, fetchPublicConfig } from '@/lib/publicConfig';
import DemoMobilePageGuide, { hasDemoMobileGuideForPath } from '@/demo/DemoMobilePageGuide';
import { demoModeEnabled } from '@/demo/config';
import { setDemoMobileGuideMuted, useDemoMobileGuideMuted } from '@/demo/mobileGuideState';
import { getMobileNavLayout, MOBILE_NAV_ITEM_IDS, type MobileNavItemId } from '@/lib/mobileNavigation';

type OrgScopeTreeNode = { org: OrgDto; children: OrgScopeTreeNode[] };

function buildOrgScopeTree(orgs: OrgDto[]): OrgScopeTreeNode[] {
  const byId = new Map(orgs.map((org) => [org.id, { org, children: [] as OrgScopeTreeNode[] }]));
  const roots: OrgScopeTreeNode[] = [];

  for (const node of byId.values()) {
    const parent = node.org.parentId ? byId.get(node.org.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortTree = (nodes: OrgScopeTreeNode[]) => {
    nodes.sort((left, right) => left.org.name.localeCompare(right.org.name, 'de'));
    nodes.forEach((node) => sortTree(node.children));
  };
  sortTree(roots);

  return roots;
}

function flattenOrgScopeTree(nodes: OrgScopeTreeNode[], depth = 0): Array<{ org: OrgDto; depth: number }> {
  return nodes.flatMap((node) => [
    { org: node.org, depth },
    ...flattenOrgScopeTree(node.children, depth + 1),
  ]);
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const appVersion = String(import.meta.env.VITE_APP_VERSION || '1.0.0');
  const appVersionDisplay = appVersion.replace(/\.0$/, '');
  const restrictToPasswordChange = user?.mustChangePassword === true;
  const { scope, setScope, switching: orgSwitching } = useOrgScope();
  const scopeKey = useOrgScopeKey();
  const { showToast } = useToast(); // ensure toast provider is initialized; also used for feedback
  const demoGuidesMutedForPageLoad = useDemoMobileGuideMuted();

  const notifySession = useCallback(
    (msg: string) => showToast(msg, { type: 'info', durationMs: 3500 }),
    [showToast],
  );

  const onSessionLogout = useCallback(
    (reason: 'idle' | 'expired' | 'remote') => {
      // For cross-tab logout, avoid double notifications.
      if (reason === 'remote') {
        logout();
        return;
      }

      logout();
      // AuthedRoutes will render <Login/> once user is null.
      try {
        if (location.pathname !== '/login') navigate('/');
      } catch {
        /* ignore */
      }
    },
    [logout, location.pathname, navigate],
  );

  useSessionTimeout({ enabled: !!user, onNotify: notifySession, onLogout: onSessionLogout });

  const { session: quickTallySession } = useQuickTallySession();
  const [quickTallyOpen, setQuickTallyOpen] = useState(false);

  const openQuickTally = () => setQuickTallyOpen(true);
  const minimizeQuickTally = () => setQuickTallyOpen(false);

  const roleLabel: Record<string, string> = {
    superadmin: 'Superadmin',
    org_admin: 'Org-Admin',
    user: 'Benutzer',
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [mobileNavLayout, setMobileNavLayout] = useState(() => getMobileNavLayout(user?.id));
  const closeTimer = useRef<number | null>(null);
  const [hoverable, setHoverable] = useState(false);
  useEffect(() => {
    // Only enable hover open/close for precise pointers (desktop). On touch we rely on click toggle.
    try {
      const mq = window.matchMedia && window.matchMedia('(pointer: fine)');
      setHoverable(!!mq?.matches);
    } catch {
      setHoverable(false);
    }
  }, []);
  const openMenu = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setMenuOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMenuOpen(false), 300);
  };

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const mobileNavItems: Record<MobileNavItemId, { to: string; label: string; icon: typeof Home }> = {
    dashboard: { to: '/dashboard', label: 'Home', icon: Home },
    activities: { to: '/activities', label: 'Aktiv.', icon: Activity },
    logbook: { to: '/logbook', label: 'Logbuch', icon: BookOpen },
    calendar: { to: '/calendar', label: 'Kalender', icon: CalendarIcon },
    projects: { to: '/projects', label: 'Projekte', icon: Boxes },
    statistics: { to: '/statistics', label: 'Statistik', icon: BarChart3 },
    settings: { to: '/settings', label: 'Einstell.', icon: Settings },
  };
  const mobileBottomItems = mobileNavLayout.bottom.map((id) => mobileNavItems[id]);
  const mobileMoreItems = MOBILE_NAV_ITEM_IDS
    .filter((id) => !mobileNavLayout.bottom.includes(id))
    .map((id) => mobileNavItems[id]);

  useEffect(() => {
    const syncMobileLayout = () => setMobileNavLayout(getMobileNavLayout(user?.id));
    syncMobileLayout();
    window.addEventListener('stato:mobile-nav-layout', syncMobileLayout);
    return () => window.removeEventListener('stato:mobile-nav-layout', syncMobileLayout);
  }, [user?.id]);

  // Org scope switcher
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [imprintModalOpen, setImprintModalOpen] = useState(false);
  const [orgList, setOrgList] = useState<OrgDto[]>([]);
  const [pendingScope, setPendingScope] = useState<string | null | undefined>(undefined);
  const [activeOrgName, setActiveOrgName] = useState<string | null>(null);
  const [branding, setBranding] = useState(DEFAULT_PUBLIC_CONFIG);
  // Quick-create org modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [parentForNewOrg, setParentForNewOrg] = useState<string | 'root' | ''>('');
  const isSuperadmin = user?.role === 'superadmin';
  const fixedParentOrgName = orgList.find((o) => o.id === user?.orgId)?.name || user?.orgName || 'Eigene Organisation';
  const scopeOrgRows = useMemo(() => flattenOrgScopeTree(buildOrgScopeTree(orgList)), [orgList]);
  const keyboardOpen = useKeyboardOpen();
  const isActivityFull =
    location.pathname.startsWith('/activities/') && location.pathname !== '/activities';
  const isLogbookDetail = location.pathname.startsWith('/logbook/');
  const hideBottomNav = isActivityFull || isLogbookDetail || keyboardOpen;
  const hideFooter = isActivityFull || isLogbookDetail || keyboardOpen;
  const showDemoGuideRestore = demoModeEnabled && demoGuidesMutedForPageLoad && hasDemoMobileGuideForPath(location.pathname);
  const restoreDemoGuides = () => {
    setDemoMobileGuideMuted(false);
    setMenuOpen(false);
  };

  // Resolve the active org name once on load and whenever scope/user changes
  useEffect(() => {
    const ORG_NAME_CACHE_KEY = 'org_name_cache';
    const readCache = (): Record<string, string> => {
      try {
        return JSON.parse(localStorage.getItem(ORG_NAME_CACHE_KEY) || '{}') as Record<
          string,
          string
        >;
      } catch {
        return {};
      }
    };
    const writeCache = (map: Record<string, string>) => {
      try {
        localStorage.setItem(ORG_NAME_CACHE_KEY, JSON.stringify(map));
      } catch {
        /* ignore */
      }
    };

    if (typeof scope === 'undefined') {
      // Should be rare (legacy). Treat as safe superadmin area.
      setActiveOrgName('Superadmin Bereich');
      return;
    }
    if (scope === null) {
      setActiveOrgName('Superadmin Bereich');
      return;
    }
    // scope is an orgId string
    if (user?.orgId === scope && user?.orgName) {
      setActiveOrgName(user.orgName);
      return;
    }
    const cache = readCache();
    if (cache[scope]) {
      setActiveOrgName(cache[scope]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let list: OrgDto[] = [];
        if (user?.role === 'superadmin') {
          list = await listOrgs();
        } else if (user?.orgId) {
          const res = await api.get<OrgDto[]>('/orgs/subtree');
          list = res.data;
        }
        const found = list.find((o) => o.id === scope);
        if (!cancelled) {
          if (found?.name) {
            setActiveOrgName(found.name);
            cache[scope] = found.name;
            writeCache(cache);
          } else {
            setActiveOrgName(`Org ${scope.substring(0, 6)}…`);
          }
        }
      } catch {
        if (!cancelled) setActiveOrgName(`Org ${scope.substring(0, 6)}…`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, user?.id, user?.role, user?.orgId, user?.orgName]);
  useEffect(() => {
    if (!scopeModalOpen) return;
    (async () => {
      try {
        if (user?.role === 'superadmin') {
          setOrgList(await listOrgs());
        } else if (user?.orgId) {
          const res = await api.get<OrgDto[]>('/orgs/subtree');
          setOrgList(res.data);
        } else {
          setOrgList([]);
        }
      } catch {
        /* ignore */
      }
      // Default selection to current scope; for legacy undefined use null (safe)
      setPendingScope((typeof scope === 'undefined') ? null : scope);
    })();
  }, [scopeModalOpen]);
  // Load org list when opening quick-create modal as well
  useEffect(() => {
    if (!createModalOpen) return;
    (async () => {
      try {
        if (user?.role === 'superadmin') {
          setOrgList(await listOrgs());
        } else if (user?.orgId) {
          const res = await api.get<OrgDto[]>('/orgs/subtree');
          setOrgList(res.data);
        } else {
          setOrgList([]);
        }
        // Default parent to user's org for org_admins; allow 'root' only for superadmin
        if (user?.role !== 'superadmin') {
          setParentForNewOrg((user?.orgId as string | undefined) ?? '');
        } else {
          setParentForNewOrg('root');
        }
      } catch {
        /* ignore */
      }
    })();
  }, [createModalOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await fetchPublicConfig();
        if (!cancelled) setBranding(config);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 header-surface text-gray-900">
        <div className="container mx-auto px-2 sm:px-3 md:px-4 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoUrl}
              alt="StatO Logo"
              className="w-9 h-9 md:w-11 md:h-11 object-contain select-none drop-shadow-lg"
            />
            <div className="leading-tight min-w-0">
              <div className="flex min-w-0 items-baseline gap-2">
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight truncate">StatO</h1>
                {branding.orgName ? (
                  <span className="min-w-0 truncate text-xs md:text-sm font-medium text-gray-600">
                    {branding.orgName}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] md:text-sm text-gray-600 truncate">
                OKJA Statistik & Dokumentation
              </p>
            </div>
          </div>
          {/* Current user and org summary (moved next to avatar on desktop) */}
          <div className="hidden"></div>
          {/* User menu */}
          <div
            className="relative flex items-center"
            {...(hoverable ? { onMouseEnter: openMenu, onMouseLeave: scheduleClose } : {})}
          >
            {/* Summary on sm+ placed just left of the avatar */}
            <div className="hidden sm:flex flex-col items-end text-sm mr-3">
              <div className="font-medium truncate max-w-[40vw]">{user?.name || user?.email}</div>
              <div className="text-gray-600 truncate max-w-[40vw]">
                {roleLabel[user?.role || 'user']}
                {activeOrgName ? ` · ${activeOrgName}` : ''}
                {orgSwitching ? ' · lädt…' : ''}
              </div>
            </div>
            <button
              aria-label="Benutzer"
              className="hidden sm:flex items-center gap-2 rounded px-1 py-1 transition-colors theme-header-action"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {user?.avatarUrl ? (
                <ProtectedImage
                  src={user.avatarUrl}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <UserCircle2 className="w-8 h-8" />
              )}
            </button>
            {showDemoGuideRestore && (
              <button
                type="button"
                aria-label="Demo-Hinweise wieder einblenden"
                title="Demo-Hinweise wieder einblenden"
                className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white/75 text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                onClick={restoreDemoGuides}
              >
                <Lightbulb aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
            {/* Compact user/org on mobile - entire area clickable */}
            <div className="flex sm:hidden items-center gap-1">
              <button
                aria-label="Benutzermenü öffnen"
                className="flex items-center gap-2 rounded px-1 py-1 transition-colors theme-header-action"
                onClick={() => setMenuOpen((v) => !v)}
              >
                {user?.avatarUrl ? (
                  <ProtectedImage
                    src={user.avatarUrl}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <UserCircle2 className="w-8 h-8" />
                )}
                <div className="flex flex-col items-end text-[11px] leading-4">
                  <div className="font-medium truncate max-w-[34vw]">{user?.name || user?.email}</div>
                  <div className="text-gray-600 truncate max-w-[34vw]">
                    {activeOrgName ||
                      (typeof scope === 'string' ? `Org ${scope.substring(0, 6)}…` : '')}
                    {orgSwitching ? ' · lädt…' : ''}
                  </div>
                </div>
              </button>
              {showDemoGuideRestore && (
                <button
                  type="button"
                  aria-label="Demo-Hinweise wieder einblenden"
                  title="Demo-Hinweise wieder einblenden"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white/75 text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  onClick={restoreDemoGuides}
                >
                  <Lightbulb aria-hidden="true" className="h-4 w-4" />
                </button>
              )}
            </div>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-56 z-50 rounded-xl theme-menu-panel"
                {...(hoverable ? { onMouseEnter: openMenu, onMouseLeave: scheduleClose } : {})}
              >
                <div className="px-4 py-3 border-b theme-menu-section">
                  <div className="font-semibold">{user?.name || user?.email}</div>
                  <div className="text-xs text-gray-500">
                    {roleLabel[user?.role || 'user']}
                    {user?.orgName
                      ? ` · ${user.orgName}`
                      : user?.orgId
                        ? ` · Org ${user.orgId}`
                        : ''}
                  </div>
                </div>
                <ul className="py-1 text-sm">
                  <li>
                    <button
                      className="w-full px-4 py-2 text-left theme-menu-item"
                      onClick={() => {
                        navigate('/me');
                        setMenuOpen(false);
                      }}
                    >
                      Meine Daten
                    </button>
                  </li>
                  {!restrictToPasswordChange && (user?.role === 'org_admin' || user?.role === 'superadmin') && (
                    <li>
                      <button
                        className="w-full px-4 py-2 text-left theme-menu-item"
                        onClick={() => {
                          setScopeModalOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        Organisation wechseln
                      </button>
                    </li>
                  )}
                  {!restrictToPasswordChange && (user?.role === 'org_admin' || user?.role === 'superadmin') && (
                    <li>
                      <button
                        className="w-full px-4 py-2 text-left theme-menu-item"
                        onClick={() => {
                          navigate('/admin/orgs');
                          setMenuOpen(false);
                        }}
                      >
                        Organisationen
                      </button>
                    </li>
                  )}
                  {!restrictToPasswordChange && canAccessDevTools(user?.role) && (
                    <li>
                      <button
                        className="w-full px-4 py-2 text-left theme-menu-item"
                        onClick={() => {
                          navigate('/admin/dev-tools');
                          setMenuOpen(false);
                        }}
                      >
                        Dev Tools
                      </button>
                    </li>
                  )}
                  {!restrictToPasswordChange && user?.role === 'superadmin' && (
                    <li>
                      <button
                        className="w-full px-4 py-2 text-left theme-menu-item"
                        onClick={() => {
                          navigate('/admin/audit');
                          setMenuOpen(false);
                        }}
                      >
                        Audit
                      </button>
                    </li>
                  )}
                  {!restrictToPasswordChange && user?.role === 'superadmin' && (
                    <li>
                      <button
                        className="w-full px-4 py-2 text-left theme-menu-item"
                        onClick={() => {
                          navigate('/admin/system-data');
                          setMenuOpen(false);
                        }}
                      >
                        Datenverwaltung
                      </button>
                    </li>
                  )}
                  {!restrictToPasswordChange && (user?.role === 'org_admin' || user?.role === 'superadmin') && (
                    <li>
                      <button
                        className="w-full px-4 py-2 text-left theme-menu-item"
                        onClick={() => {
                          navigate('/admin/users');
                          setMenuOpen(false);
                        }}
                      >
                        Benutzer
                      </button>
                    </li>
                  )}
                  <li>
                    <button
                      className="w-full px-4 py-2 text-left theme-menu-item"
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                    >
                      Abmelden
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation (desktop) - fixed under header */}
      {!restrictToPasswordChange && <nav className="nav-surface hidden md:block fixed top-14 md:top-20 inset-x-0 z-30">
        <div className="container mx-auto px-4">
          <ul className="flex space-x-1">
            <li>
              <Link
                to="/dashboard"
                data-tooltip="Dashboard"
                className={`nav-item-tooltip theme-nav-item flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 ${
                  isActive('/dashboard')
                    ? 'theme-nav-item-active'
                    : ''
                }`}
              >
                <Home className="w-5 h-5 lg:mr-2 flex-shrink-0" />
                <span className={`nav-label ${isActive('/dashboard') ? 'nav-label-active' : ''}`} data-text="Dashboard">Dashboard</span>
              </Link>
            </li>
            <li>
              <Link
                to="/activities"
                data-tooltip="Aktivitäten"
                className={`nav-item-tooltip theme-nav-item flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 ${
                  isActive('/activities')
                    ? 'theme-nav-item-active'
                    : ''
                }`}
              >
                <Activity className="w-5 h-5 lg:mr-2 flex-shrink-0" />
                <span className={`nav-label ${isActive('/activities') ? 'nav-label-active' : ''}`} data-text="Aktivitäten">Aktivitäten</span>
              </Link>
            </li>
            <li>
              <Link
                to="/logbook"
                data-tooltip="Logbuch"
                className={`nav-item-tooltip theme-nav-item flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 ${
                  isActive('/logbook')
                    ? 'theme-nav-item-active'
                    : ''
                }`}
              >
                <BookOpen className="w-5 h-5 lg:mr-2 flex-shrink-0" />
                <span className={`nav-label ${isActive('/logbook') ? 'nav-label-active' : ''}`} data-text="Logbuch">Logbuch</span>
              </Link>
            </li>
            <li>
              <Link
                to="/calendar"
                data-tooltip="Kalender"
                className={`nav-item-tooltip theme-nav-item flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 ${
                  isActive('/calendar')
                    ? 'theme-nav-item-active'
                    : ''
                }`}
              >
                <CalendarIcon className="w-5 h-5 lg:mr-2 flex-shrink-0" />
                <span className={`nav-label ${isActive('/calendar') ? 'nav-label-active' : ''}`} data-text="Kalender">Kalender</span>
              </Link>
            </li>
            <li>
              <Link
                to="/projects"
                data-tooltip="Projekte"
                className={`nav-item-tooltip theme-nav-item flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 ${
                  isActive('/projects')
                    ? 'theme-nav-item-active'
                    : ''
                }`}
              >
                <Boxes className="w-5 h-5 lg:mr-2 flex-shrink-0" />
                <span className={`nav-label ${isActive('/projects') ? 'nav-label-active' : ''}`} data-text="Projekte">Projekte</span>
              </Link>
            </li>
            <li>
              <Link
                to="/statistics"
                data-tooltip="Statistiken"
                className={`nav-item-tooltip theme-nav-item flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 ${
                  isActive('/statistics')
                    ? 'theme-nav-item-active'
                    : ''
                }`}
              >
                <BarChart3 className="w-5 h-5 lg:mr-2 flex-shrink-0" />
                <span className={`nav-label ${isActive('/statistics') ? 'nav-label-active' : ''}`} data-text="Statistiken">Statistiken</span>
              </Link>
            </li>
            <li>
              <Link
                to="/settings"
                data-tooltip="Einstellungen"
                className={`nav-item-tooltip theme-nav-item flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 ${
                  isActive('/settings')
                    ? 'theme-nav-item-active'
                    : ''
                }`}
              >
                <Settings className="w-5 h-5 lg:mr-2 flex-shrink-0" />
                <span className={`nav-label ${isActive('/settings') ? 'nav-label-active' : ''}`} data-text="Einstellungen">Einstellungen</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>}

      {/* Tiny spacer below fixed desktop nav for visual breathing room */}
      {!restrictToPasswordChange && <div className="hidden md:block h-[5px]" aria-hidden="true" />}

      {/* Main Content */}
      <main
        className={`container mx-auto w-full flex-1 px-2 sm:px-3 md:px-4 py-8 pt-24 md:pt-32 ${hideBottomNav ? 'pb-0' : 'pb-24'} md:pb-8`}
      >
        <Outlet key={scopeKey} context={{ openQuickTally }} />
      </main>

      {/* QuickTally overlay (global) */}
      {quickTallyOpen && (
        <QuickTally onClose={() => setQuickTallyOpen(false)} onMinimize={minimizeQuickTally} />
      )}
      {!restrictToPasswordChange && !!quickTallySession && !quickTallyOpen && (
        <QuickTallyMinimizedPill onRestore={openQuickTally} />
      )}

      {/* Bottom Navigation (mobile) */}
      {!restrictToPasswordChange && <nav
        className={`mobile-bottom-nav fixed inset-x-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-lg md:hidden z-50 ${hideBottomNav ? 'hidden' : ''}`}
      >
        <ul className="grid grid-cols-5 text-xs pb-[max(env(safe-area-inset-bottom,0px),0.25rem)]">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setMobileMoreOpen(false)}
                  className={`flex flex-col items-center py-2.5 transition-all duration-200 ${isActive(item.to) ? 'text-viridian font-semibold scale-105' : 'text-gray-500 hover:text-viridian'}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMobileMoreOpen((value) => !value)}
              className={`flex w-full flex-col items-center py-2.5 transition-all duration-200 ${mobileMoreItems.some((item) => isActive(item.to)) ? 'text-viridian font-semibold scale-105' : 'text-gray-500 hover:text-viridian'}`}
            >
              <Menu className="w-5 h-5" />
              <span>Mehr</span>
            </button>
          </li>
        </ul>
        {mobileMoreOpen && (
          <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+3.9rem)] right-2 w-52 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
            {mobileMoreItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} onClick={() => setMobileMoreOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Icon className="h-5 w-5 text-viridian" />{item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>}

      {!restrictToPasswordChange && !hideBottomNav && <DemoMobilePageGuide />}

      {/* Footer (hidden on full activity views or while keyboard open) */}
      {!hideFooter && !restrictToPasswordChange && (
        <footer className={`mt-12 ${hideBottomNav ? '' : 'mb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:mb-0'}`}>
          <div className="footer-surface w-full px-4 py-6 text-center text-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/45">
            <div className="flex items-center justify-center gap-1 flex-wrap">
              <p>
                © {new Date().getFullYear()} StatO · Version{' '}
                {appVersionDisplay}
                {import.meta.env.VITE_COMMIT_SHA
                  ? ` (${String(import.meta.env.VITE_COMMIT_SHA).substring(0, 7)})`
                  : ''}{' '}
                ·{' '}
                <a
                  href="mailto:hubertoink@outlook.com"
                  className="underline hover:text-viridian"
                >
                  Nikolas Häfner
                </a>
              </p>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setImprintModalOpen(true)}
                className="text-sm font-medium underline underline-offset-2 hover:text-viridian"
              >
                Impressum
              </button>
            </div>
          </div>
        </footer>
      )}
      <ImprintModal open={imprintModalOpen} onClose={() => setImprintModalOpen(false)} />
      {/* Quick Create Organisation Modal (org_admin) */}
      <Modal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setNewOrgName('');
        }}
        title="Organisation anlegen"
        maxWidth="sm"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name der Organisation</label>
            <input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              placeholder="z. B. Jugendzentrum Nord"
            />
          </div>
          <div>
            <label htmlFor="parent-org-select" className="block text-sm font-medium mb-1">
              Übergeordnete Organisation
            </label>
            {isSuperadmin ? (
              <select
                id="parent-org-select"
                value={parentForNewOrg}
                onChange={(e) =>
                  setParentForNewOrg(
                    (e.target.value || 'root') as 'root' | string | '',
                  )
                }
                className="border rounded px-3 py-2 w-full"
              >
                <option value="root">(Keine, oberste Ebene)</option>
                {orgList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  id="parent-org-select"
                  value={fixedParentOrgName}
                  disabled
                  className="border rounded px-3 py-2 w-full bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">Org-Admins können neue Organisationen nur direkt unter ihrer eigenen Organisation anlegen.</p>
              </>
            )}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              className="px-3 py-1.5 rounded bg-gray-200 text-gray-700"
              onClick={() => {
                setCreateModalOpen(false);
                setNewOrgName('');
              }}
            >
              Abbrechen
            </button>
            <button
              className="px-3 py-1.5 rounded bg-viridian text-white disabled:opacity-60"
              disabled={!newOrgName.trim() || (!isSuperadmin && !user?.orgId)}
              onClick={async () => {
                try {
                  const parentId =
                    isSuperadmin
                      ? parentForNewOrg === 'root'
                        ? null
                        : parentForNewOrg || null
                      : (user?.orgId as string | undefined) || null;
                  const created = await createOrgApi(
                    newOrgName.trim(),
                    parentId as string | null | undefined,
                  );
                  setNewOrgName('');
                  setCreateModalOpen(false);
                  showToast(`Organisation „${created.name}” angelegt.`, { type: 'success' });
                } catch (e: unknown) {
                  const msg =
                    (e as { response?: { data?: { message?: unknown } } })?.response?.data
                      ?.message || 'Anlegen fehlgeschlagen';
                  showToast(String(msg), { type: 'error', durationMs: 3500 });
                }
              }}
            >
              Organisation anlegen
            </button>
          </div>
        </div>
      </Modal>
      {/* Org Scope Switcher Modal */}
      <Modal
        open={scopeModalOpen}
        onClose={() => setScopeModalOpen(false)}
        title="Organisation wechseln"
        maxWidth="sm"
      >
        <div className="space-y-3">
          {user?.role === 'superadmin' && (
            <div className={`org-scope-option rounded-lg ${pendingScope === null ? 'org-scope-option-active' : ''}`}>
              <label className="flex w-full cursor-pointer items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="orgscope"
                  checked={pendingScope === null}
                  onChange={() => setPendingScope(null)}
                  className="h-4 w-4 shrink-0"
                />
                <span className="org-scope-icon-shell">
                  <Settings className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 font-medium">Superadmin Bereich (ohne Orga-Daten)</span>
              </label>
            </div>
          )}
          <div className="max-h-72 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]">
            <ul className="divide-y divide-[var(--border-subtle)]">
              {/* For non-superadmin, limit to subtree visually; backend enforces anyway */}
              {scopeOrgRows.map(({ org, depth }) => (
                <li key={org.id}>
                  <label
                    className={`org-scope-option flex cursor-pointer items-center gap-3 text-sm ${pendingScope === org.id ? 'org-scope-option-active' : ''}`}
                    style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
                  >
                    <input
                      type="radio"
                      name="orgscope"
                      checked={pendingScope === org.id}
                      onChange={() => setPendingScope(org.id)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="org-scope-icon-shell">
                      {depth === 0 ? <Building2 className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{org.name}</span>
                      <span className="org-scope-depth-label">{depth === 0 ? 'Root' : `Ebene ${depth}`}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              className="px-3 py-1.5 rounded bg-gray-200 text-gray-700"
              onClick={() => setScopeModalOpen(false)}
            >
              Abbrechen
            </button>
            <button
              className="px-3 py-1.5 rounded bg-viridian text-white"
              onClick={() => {
                setScope(pendingScope);
                setScopeModalOpen(false);
              }}
              disabled={orgSwitching}
            >
              {orgSwitching ? 'Lade…' : 'Übernehmen'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
