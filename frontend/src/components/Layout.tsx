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
import { useEffect, useRef, useState } from 'react';
import { useKeyboardOpen } from '@/lib/useKeyboardOpen';
import { useVisualViewportCssVar } from '@/lib/useVisualViewportCssVar';
import Modal from '@/components/Modal';
import { listOrgs, type OrgDto, createOrgApi } from '@/lib/orgs';
import { api } from '@/lib/api';
import { useOrgScope } from '@/lib/orgScope';
import { useToast } from '@/components/Toast';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { scope, setScope } = useOrgScope();
  const { showToast } = useToast(); // ensure toast provider is initialized; also used for feedback
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
  // Keep a CSS var --vvh in sync with the real visual viewport height to avoid gaps above the keyboard
  useVisualViewportCssVar();
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
      setActiveOrgName('Alle Organisationen');
      return;
    }
    if (scope === null) {
      setActiveOrgName('Ohne Organisation');
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
      // If current scope is null but we removed the null option from UI, default selection to undefined (superadmin) or keep user's scope
      setPendingScope(scope === null ? undefined : scope);
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
    <div
      className="bg-mint-cream min-h-[var(--vvh,100vh)]"
      // Use dynamic visual viewport height to size the app shell and prevent bottom gaps when the keyboard opens
    >
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 header-surface text-white shadow-lg">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={logoUrl}
              alt="StatO Logo"
              className="w-8 h-8 md:w-10 md:h-10 object-contain select-none"
            />
            <div className="leading-tight min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate">StatO</h1>
              <p className="text-[11px] md:text-sm text-mint-green truncate">
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
              <div className="opacity-90 text-mint-green truncate max-w-[40vw]">
                {roleLabel[user?.role || 'user']}
                {activeOrgName ? ` · ${activeOrgName}` : ''}
              </div>
            </div>
            <button
              aria-label="Benutzer"
              className="flex items-center gap-2 hover:bg-white/10 rounded px-1 py-1"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <UserCircle2 className="w-8 h-8" />
              )}
            </button>
            {/* Compact user/org on mobile */}
            <div className="flex sm:hidden flex-col items-end ml-2 text-[11px] leading-4">
              <div className="font-medium truncate max-w-[40vw]">{user?.name || user?.email}</div>
              <div className="opacity-90 text-mint-green truncate max-w-[40vw]">
                {activeOrgName ||
                  (typeof scope === 'string' ? `Org ${scope.substring(0, 6)}…` : '')}
              </div>
            </div>
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
                  {(user?.role === 'org_admin' || user?.role === 'superadmin') && (
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
                  {user?.role === 'org_admin' && (
                    <li>
                      <button
                        className="w-full text-left px-4 py-2 hover:bg-gray-100"
                        onClick={() => {
                          setCreateModalOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        Organisation anlegen
                      </button>
                    </li>
                  )}
                  {user?.role === 'superadmin' && (
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
                  {(user?.role === 'org_admin' || user?.role === 'superadmin') && (
                    <li>
                      <button
                        className="w-full text-left px-4 py-2 hover:bg-gray-100"
                        onClick={() => navigate('/admin/users')}
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
      <nav className="nav-surface text-white shadow-md hidden md:block fixed top-14 md:top-20 inset-x-0 z-30">
        <div className="container mx-auto px-4">
          <ul className="flex space-x-1">
            <li>
              <Link
                to="/dashboard"
                className={`flex items-center px-4 py-3 hover:bg-white/10 transition-colors ${
                  isActive('/dashboard') ? 'bg-viridian' : ''
                }`}
              >
                <Home className="w-5 h-5 mr-2" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/activities"
                className={`flex items-center px-4 py-3 hover:bg-white/10 transition-colors ${
                  isActive('/activities') ? 'bg-viridian' : ''
                }`}
              >
                <Activity className="w-5 h-5 mr-2" />
                Aktivitäten
              </Link>
            </li>
            <li>
              <Link
                to="/calendar"
                className={`flex items-center px-4 py-3 hover:bg-white/10 transition-colors ${
                  isActive('/calendar') ? 'bg-viridian' : ''
                }`}
              >
                <CalendarIcon className="w-5 h-5 mr-2" />
                Kalender
              </Link>
            </li>
            <li>
              <Link
                to="/projects"
                className={`flex items-center px-4 py-3 hover:bg-white/10 transition-colors ${
                  isActive('/projects') ? 'bg-viridian' : ''
                }`}
              >
                <Boxes className="w-5 h-5 mr-2" />
                Projekte
              </Link>
            </li>
            <li>
              <Link
                to="/statistics"
                className={`flex items-center px-4 py-3 hover:bg-white/10 transition-colors ${
                  isActive('/statistics') ? 'bg-viridian' : ''
                }`}
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                Statistiken
              </Link>
            </li>
            <li>
              <Link
                to="/settings"
                className={`flex items-center px-4 py-3 hover:bg-white/10 transition-colors ${
                  isActive('/settings') ? 'bg-viridian' : ''
                }`}
              >
                <Settings className="w-5 h-5 mr-2" />
                Einstellungen
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Tiny spacer below fixed desktop nav for visual breathing room */}
      <div className="hidden md:block h-[5px]" aria-hidden="true" />

      {/* Main Content */}
      <main
        className={`container mx-auto px-4 py-8 pt-24 md:pt-32 ${hideBottomNav ? 'pb-0' : 'pb-[5.5rem]'} md:pb-8`}
      >
        <Outlet />
      </main>

      {/* Bottom Navigation (mobile) */}
      <nav
        className={`fixed bottom-0 inset-x-0 bg-white border-t shadow md:hidden z-50 ${hideBottomNav ? 'hidden' : ''}`}
      >
        <ul className="grid grid-cols-6 text-xs">
          <li>
            <Link
              to="/dashboard"
              className={`flex flex-col items-center py-2 hover:bg-black/5 ${isActive('/dashboard') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </Link>
          </li>
          <li>
            <Link
              to="/activities"
              className={`flex flex-col items-center py-2 hover:bg-black/5 ${isActive('/activities') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <Activity className="w-5 h-5" />
              <span>Aktiv.</span>
            </Link>
          </li>
          <li>
            <Link
              to="/calendar"
              className={`flex flex-col items-center py-2 hover:bg-black/5 ${isActive('/calendar') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <CalendarIcon className="w-5 h-5" />
              <span>Kalender</span>
            </Link>
          </li>
          <li>
            <Link
              to="/projects"
              className={`flex flex-col items-center py-2 hover:bg-black/5 ${isActive('/projects') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <Boxes className="w-5 h-5" />
              <span>Projekte</span>
            </Link>
          </li>
          <li>
            <Link
              to="/statistics"
              className={`flex flex-col items-center py-2 hover:bg-black/5 ${isActive('/statistics') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Stats</span>
            </Link>
          </li>
          <li>
            <Link
              to="/settings"
              className={`flex flex-col items-center py-2 hover:bg-black/5 ${isActive('/settings') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <Settings className="w-5 h-5" />
              <span>Einst.</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* Footer (hidden on full activity views or while keyboard open) */}
      {!hideFooter && (
        <footer className="bg-azure-web text-gray-600 mt-12">
          <div className="container mx-auto px-4 py-6 text-center text-sm">
            <p>
              © {new Date().getFullYear()} StatO · Version{' '}
              {import.meta.env.VITE_APP_VERSION || '0.7'}
              {import.meta.env.VITE_COMMIT_SHA
                ? ` (${String(import.meta.env.VITE_COMMIT_SHA).substring(0, 7)})`
                : ''}{' '}
              ·{' '}
              <a
                href="mailto:nikolas.haefner@mannheim.de"
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
                  checked={typeof pendingScope === 'undefined'}
                  onChange={() => setPendingScope(undefined)}
                />
                <span>Alle Organisationen (global)</span>
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
            >
              Übernehmen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
