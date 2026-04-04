import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Activity,
  BarChart3,
  Settings,
  Calendar as CalendarIcon,
  Boxes,
  UserCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import logoUrl from '../../assets/Stato_Logo.png';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeyboardOpen } from '@/lib/useKeyboardOpen';
import Modal from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import { listOrgs, type OrgDto, createOrgApi } from '@/lib/orgs';
import { api } from '@/lib/api';
import { canAccessDevTools } from '@/lib/devToolsConfig';
import { useOrgScope } from '@/lib/orgScope';
import { useToast } from '@/components/Toast';
import { QuickTally, QuickTallyMinimizedPill, useQuickTallySession } from '@/components/QuickTally';
import { useSessionTimeout } from '@/lib/sessionTimeout';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const restrictToPasswordChange = user?.mustChangePassword === true;
  const { scope, setScope, switching: orgSwitching } = useOrgScope();
  const { showToast } = useToast(); // ensure toast provider is initialized; also used for feedback

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

  // Org scope switcher
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [orgList, setOrgList] = useState<OrgDto[]>([]);
  const [pendingScope, setPendingScope] = useState<string | null | undefined>(undefined);
  const [activeOrgName, setActiveOrgName] = useState<string | null>(null);
  // Quick-create org modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [parentForNewOrg, setParentForNewOrg] = useState<string | 'root' | ''>('');
  const keyboardOpen = useKeyboardOpen();
  const isActivityFull =
    location.pathname.startsWith('/activities/') && location.pathname !== '/activities';
  const hideBottomNav = isActivityFull || keyboardOpen;
  const hideFooter = isActivityFull || keyboardOpen;

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

  return (
    <div className="min-h-screen">
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
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight truncate">StatO</h1>
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
              className="hidden sm:flex items-center gap-2 hover:bg-black/5 rounded px-1 py-1"
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
            {/* Compact user/org on mobile - entire area clickable */}
            <button
              aria-label="Benutzermenü öffnen"
              className="flex sm:hidden items-center gap-2 hover:bg-black/5 rounded px-1 py-1"
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
                <div className="font-medium truncate max-w-[40vw]">{user?.name || user?.email}</div>
                <div className="text-gray-600 truncate max-w-[40vw]">
                  {activeOrgName ||
                    (typeof scope === 'string' ? `Org ${scope.substring(0, 6)}…` : '')}
                  {orgSwitching ? ' · lädt…' : ''}
                </div>
              </div>
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-2 bg-white text-gray-800 rounded shadow-lg w-56 z-50"
                {...(hoverable ? { onMouseEnter: openMenu, onMouseLeave: scheduleClose } : {})}
              >
                <div className="px-4 py-3 border-b">
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
                      className="w-full text-left px-4 py-2 hover:bg-gray-100"
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
                        className="w-full text-left px-4 py-2 hover:bg-gray-100"
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
                        className="w-full text-left px-4 py-2 hover:bg-gray-100"
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
                        className="w-full text-left px-4 py-2 hover:bg-gray-100"
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
                        className="w-full text-left px-4 py-2 hover:bg-gray-100"
                        onClick={() => {
                          navigate('/admin/audit');
                          setMenuOpen(false);
                        }}
                      >
                        Audit
                      </button>
                    </li>
                  )}
                  {!restrictToPasswordChange && (user?.role === 'org_admin' || user?.role === 'superadmin') && (
                    <li>
                      <button
                        className="w-full text-left px-4 py-2 hover:bg-gray-100"
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
                      className="w-full text-left px-4 py-2 hover:bg-gray-100"
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
                className={`nav-item-tooltip flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 hover:bg-black/5 ${
                  isActive('/dashboard')
                    ? 'bg-black/5 text-viridian'
                    : 'text-gray-700 hover:text-gray-900'
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
                className={`nav-item-tooltip flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 hover:bg-black/5 ${
                  isActive('/activities')
                    ? 'bg-black/5 text-viridian'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Activity className="w-5 h-5 lg:mr-2 flex-shrink-0" />
                <span className={`nav-label ${isActive('/activities') ? 'nav-label-active' : ''}`} data-text="Aktivitäten">Aktivitäten</span>
              </Link>
            </li>
            <li>
              <Link
                to="/calendar"
                data-tooltip="Kalender"
                className={`nav-item-tooltip flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 hover:bg-black/5 ${
                  isActive('/calendar')
                    ? 'bg-black/5 text-viridian'
                    : 'text-gray-700 hover:text-gray-900'
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
                className={`nav-item-tooltip flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 hover:bg-black/5 ${
                  isActive('/projects')
                    ? 'bg-black/5 text-viridian'
                    : 'text-gray-700 hover:text-gray-900'
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
                className={`nav-item-tooltip flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 hover:bg-black/5 ${
                  isActive('/statistics')
                    ? 'bg-black/5 text-viridian'
                    : 'text-gray-700 hover:text-gray-900'
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
                className={`nav-item-tooltip flex items-center px-4 py-3 rounded-t-xl transition-colors duration-200 hover:bg-black/5 ${
                  isActive('/settings')
                    ? 'bg-black/5 text-viridian'
                    : 'text-gray-700 hover:text-gray-900'
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
        className={`container mx-auto px-2 sm:px-3 md:px-4 py-8 pt-24 md:pt-32 ${hideBottomNav ? 'pb-0' : 'pb-[5.5rem]'} md:pb-8`}
      >
        <Outlet context={{ openQuickTally }} />
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
        className={`fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-lg md:hidden z-50 ${hideBottomNav ? 'hidden' : ''}`}
      >
        <ul className="grid grid-cols-6 text-xs">
          <li>
            <Link
              to="/dashboard"
              className={`flex flex-col items-center py-2 transition-all duration-200 ${isActive('/dashboard') ? 'text-viridian font-semibold scale-105' : 'text-gray-500 hover:text-viridian'}`}
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </Link>
          </li>
          <li>
            <Link
              to="/activities"
              className={`flex flex-col items-center py-2 transition-all duration-200 ${isActive('/activities') ? 'text-viridian font-semibold scale-105' : 'text-gray-500 hover:text-viridian'}`}
            >
              <Activity className="w-5 h-5" />
              <span>Aktiv.</span>
            </Link>
          </li>
          <li>
            <Link
              to="/calendar"
              className={`flex flex-col items-center py-2 transition-all duration-200 ${isActive('/calendar') ? 'text-viridian font-semibold scale-105' : 'text-gray-500 hover:text-viridian'}`}
            >
              <CalendarIcon className="w-5 h-5" />
              <span>Kalender</span>
            </Link>
          </li>
          <li>
            <Link
              to="/projects"
              className={`flex flex-col items-center py-2 transition-all duration-200 ${isActive('/projects') ? 'text-viridian font-semibold scale-105' : 'text-gray-500 hover:text-viridian'}`}
            >
              <Boxes className="w-5 h-5" />
              <span>Projekte</span>
            </Link>
          </li>
          <li>
            <Link
              to="/statistics"
              className={`flex flex-col items-center py-2 transition-all duration-200 ${isActive('/statistics') ? 'text-viridian font-semibold scale-105' : 'text-gray-500 hover:text-viridian'}`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Stats</span>
            </Link>
          </li>
          <li>
            <Link
              to="/settings"
              className={`flex flex-col items-center py-2 transition-all duration-200 ${isActive('/settings') ? 'text-viridian font-semibold scale-105' : 'text-gray-500 hover:text-viridian'}`}
            >
              <Settings className="w-5 h-5" />
              <span>Einst.</span>
            </Link>
          </li>
        </ul>
      </nav>}

      {/* Footer (hidden on full activity views or while keyboard open) */}
      {!hideFooter && !restrictToPasswordChange && (
        <footer className="mt-12">
          <div className="w-full px-4 py-6 text-center text-sm text-gray-700 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/45 border-t border-white/50">
            <p>
              © {new Date().getFullYear()} StatO · Version{' '}
              {import.meta.env.VITE_APP_VERSION || '0.8'}
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
          </div>
        </footer>
      )}
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
            <select
              id="parent-org-select"
              value={parentForNewOrg}
              onChange={(e) =>
                setParentForNewOrg(
                  (e.target.value || (user?.role === 'superadmin' ? 'root' : '')) as
                    | 'root'
                    | string
                    | '',
                )
              }
              className="border rounded px-3 py-2 w-full"
            >
              {user?.role === 'superadmin' && <option value="root">(Keine, oberste Ebene)</option>}
              {orgList.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
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
              disabled={!newOrgName.trim() || (user?.role !== 'superadmin' && !parentForNewOrg)}
              onClick={async () => {
                try {
                  const parentId =
                    user?.role === 'superadmin'
                      ? parentForNewOrg === 'root'
                        ? null
                        : parentForNewOrg || null
                      : parentForNewOrg || (user?.orgId as string | undefined) || null;
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
            <div className="flex items-center justify-between p-2 border rounded">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="orgscope"
                  checked={pendingScope === null}
                  onChange={() => setPendingScope(null)}
                />
                <span>Superadmin Bereich (ohne Orga-Daten)</span>
              </label>
            </div>
          )}
          <div className="max-h-64 overflow-auto border rounded">
            <ul>
              {/* For non-superadmin, limit to subtree visually; backend enforces anyway */}
              {orgList.map((o) => (
                <li key={o.id}>
                  <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="orgscope"
                      checked={pendingScope === o.id}
                      onChange={() => setPendingScope(o.id)}
                    />
                    <span className="truncate">{o.name}</span>
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
