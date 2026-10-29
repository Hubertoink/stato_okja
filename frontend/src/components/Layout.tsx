import OrganizationAssignmentGate from './OrganizationAssignmentGate';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizationModules } from '@/lib/organizationModules';
import { Button } from '@/components/ui/Button';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Activity,
  BarChart3,
  Settings,
  Calendar as CalendarIcon,
  Boxes,
  Building2,
  GitBranch,
  BookOpen,
  ClipboardList,
  Menu,
  Database,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import logoUrl from '../../assets/Stato_Logo.png';
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { useKeyboardOpen } from '@/lib/useKeyboardOpen';
import { useShellHeaderHeight } from '@/lib/useShellHeaderHeight';
import Modal from '@/components/Modal';
import { useResolvedImageSrc } from '@/components/ProtectedImage';
import { listAccessibleOrgs, listOrgs, type OrgDto, createOrgApi } from '@/lib/orgs';
import { useProcessOAccess } from '@/lib/processes';
import { useOrgScope, useOrgScopeKey } from '@/lib/orgScope';
import { useToast } from '@/components/Toast';
import { ImprintModal, PrivacyNoticeModal, TermsOfUseModal } from '@/components/LegalModals';
import { QuickTally, QuickTallyMinimizedPill, useQuickTallySession } from '@/components/QuickTally';
import { useSessionTimeout } from '@/lib/sessionTimeout';
import { DEFAULT_PUBLIC_CONFIG, fetchPublicConfig } from '@/lib/publicConfig';
import DemoMobilePageGuide, { hasDemoMobileGuideForPath } from '@/demo/DemoMobilePageGuide';
import { demoModeEnabled } from '@/demo/config';
import { setDemoMobileGuideMuted, useDemoMobileGuideMuted } from '@/demo/mobileGuideState';
import {
  getMobileNavLayout,
  MOBILE_NAV_ITEM_IDS,
  type MobileNavItemId,
} from '@/lib/mobileNavigation';
import { useTranslation } from 'react-i18next';
import { compareLocalized } from '@/i18n/formatters';
import { autoT } from '@/i18n/auto';
import { useIsMobile } from '@/lib/useIsMobile';
import Sidebar from '@/components/shell/Sidebar';
import UserMenu from '@/components/shell/UserMenu';
import NavigationLinks from '@/components/shell/NavigationLinks';
import '@/components/shell/sidebar.css';

type OrgScopeTreeNode = { org: OrgDto; children: OrgScopeTreeNode[] };

function parentIdFromOrgPath(org: OrgDto): string | null {
  if (!org.path) return null;
  const segments = org.path.split('/').filter(Boolean);
  const ownIndex = segments.lastIndexOf(org.id);
  if (ownIndex <= 0) return null;
  return segments[ownIndex - 1] || null;
}

function buildOrgScopeTree(orgs: OrgDto[]): OrgScopeTreeNode[] {
  const byId = new Map(orgs.map((org) => [org.id, { org, children: [] as OrgScopeTreeNode[] }]));
  const roots: OrgScopeTreeNode[] = [];

  for (const node of byId.values()) {
    // parentId is the canonical hierarchy field. The path fallback keeps the
    // switcher hierarchical for older or reduced API responses as well.
    const parentId = node.org.parentId ?? parentIdFromOrgPath(node.org);
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortTree = (nodes: OrgScopeTreeNode[]) => {
    nodes.sort((left, right) => compareLocalized(left.org.name, right.org.name));
    nodes.forEach((node) => sortTree(node.children));
  };
  sortTree(roots);

  return roots;
}

function flattenOrgScopeTree(
  nodes: OrgScopeTreeNode[],
  depth = 0,
): Array<{ org: OrgDto; depth: number }> {
  return nodes.flatMap((node) => [
    { org: node.org, depth },
    ...flattenOrgScopeTree(node.children, depth + 1),
  ]);
}

type OrganizationScopeOptionProps = {
  org: OrgDto;
  depth: number;
  selected: boolean;
  onSelect: (orgId: string) => void;
};

/**
 * Shared organisation-row presentation for the scope switcher. It keeps the
 * branding treatment close to the data source and resolves protected banners
 * through the same image helper as the application header.
 */
function OrganizationScopeOption({
  org,
  depth,
  selected,
  onSelect,
}: OrganizationScopeOptionProps) {
  const bannerSrc = useResolvedImageSrc(org.bannerUrl);
  const brandingStyle = {
    '--organization-brand-color': org.brandColor || 'var(--viridian)',
    paddingLeft: `${0.75 + depth * 1.25}rem`,
  } as CSSProperties;

  return (
    <li>
      <label
        className={`org-scope-option org-scope-option-branding flex cursor-pointer items-center gap-3 text-sm ${selected ? 'org-scope-option-active' : ''}`}
        style={brandingStyle}
      >
        {bannerSrc ? (
          <span
            aria-hidden="true"
            className="org-scope-option-banner"
            style={{
              backgroundImage: `url("${bannerSrc}")`,
              backgroundPosition: `center ${org.bannerPosition ?? 50}%`,
            }}
          />
        ) : null}
        <input
          type="radio"
          name="orgscope"
          checked={selected}
          onChange={() => onSelect(org.id)}
          className="h-4 w-4 shrink-0"
        />
        <span className="org-scope-icon-shell">
          {depth === 0 ? (
            <Building2 className="h-4 w-4" />
          ) : (
            <GitBranch className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{org.name}</span>
          <span className="org-scope-depth-label">
            {depth === 0 ? autoT('ui_e96857c58f71') : `Ebene ${depth}`}
          </span>
        </span>
      </label>
    </li>
  );
}

export default function Layout() {
  const headerRef = useShellHeaderHeight();
  const { t } = useTranslation('common');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const appVersion = String(import.meta.env.VITE_APP_VERSION || 'unbekannt');
  const appVersionDisplay = appVersion.replace(/\.0$/, '');
  const restrictToPasswordChange = user?.mustChangePassword === true;
  const { scope, setScope, switching: orgSwitching } = useOrgScope();
  const scopeKey = useOrgScopeKey();
  const queryClient = useQueryClient();
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
  const modules = useOrganizationModules();
  const logbookEnabled = modules.data?.logbook === true;
  const surveysEnabled = modules.data?.surveys === true;
  const processOAccess = useProcessOAccess();
  const processOEnabled = processOAccess.data?.enabled === true;

  const openQuickTally = () => setQuickTallyOpen(true);
  const minimizeQuickTally = () => setQuickTallyOpen(false);

  const [headerCompact, setHeaderCompact] = useState(false);
  useEffect(() => {
    const update = () => setHeaderCompact(window.scrollY > 64);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const availableMobileNavItemIds = useMemo(
    () => MOBILE_NAV_ITEM_IDS.filter((id) => (id !== 'processes' || processOEnabled) && (id !== 'logbook' || logbookEnabled) && (id !== 'surveys' || surveysEnabled)),
    [processOEnabled, logbookEnabled, surveysEnabled],
  );
  const [mobileNavLayout, setMobileNavLayout] = useState(() => getMobileNavLayout(user?.id, availableMobileNavItemIds));
  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const mobileNavItems: Record<MobileNavItemId, { to: string; label: string; icon: typeof Home }> =
    {
      dashboard: { to: '/dashboard', label: t('navigation.dashboard'), icon: Home },
      activities: { to: '/activities', label: t('navigation.activities'), icon: Activity },
      logbook: { to: '/logbook', label: t('navigation.logbook'), icon: BookOpen },
      calendar: { to: '/calendar', label: t('navigation.calendar'), icon: CalendarIcon },
      projects: { to: '/projects', label: t('navigation.projectsShort'), icon: Boxes },
      processes: { to: '/processes', label: t('navigation.processes'), icon: GitBranch },
      surveys: { to: '/surveys', label: t('navigation.surveys'), icon: ClipboardList },
      statistics: { to: '/statistics', label: t('navigation.statistics'), icon: BarChart3 },
      masterData: { to: '/master-data', label: t('navigation.masterData'), icon: Database },
      operations: { to: '/operations', label: t('navigation.operations'), icon: Clock },
      settings: { to: '/settings', label: t('navigation.settings'), icon: Settings },
    };
  const mobileBottomItems = mobileNavLayout.bottom.map((id) => mobileNavItems[id]);
  const mobileMoreItems = [
    ...availableMobileNavItemIds.filter(
      (id) => !mobileNavLayout.bottom.includes(id),
    ).map((id) => mobileNavItems[id]),
  ];

  useEffect(() => {
    const syncMobileLayout = () => setMobileNavLayout(getMobileNavLayout(user?.id, availableMobileNavItemIds));
    syncMobileLayout();
    window.addEventListener('stato:mobile-nav-layout', syncMobileLayout);
    return () => window.removeEventListener('stato:mobile-nav-layout', syncMobileLayout);
  }, [availableMobileNavItemIds, user?.id]);

  // Org scope switcher
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [imprintModalOpen, setImprintModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [orgList, setOrgList] = useState<OrgDto[]>([]);
  const [pendingScope, setPendingScope] = useState<string | null | undefined>(undefined);
  const [activeOrgName, setActiveOrgName] = useState<string | null>(null);
  const [activeOrgBranding, setActiveOrgBranding] = useState<OrgDto | null>(null);
  const [branding, setBranding] = useState(DEFAULT_PUBLIC_CONFIG);
  // Quick-create org modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [parentForNewOrg, setParentForNewOrg] = useState<string | 'root' | ''>('');
  const isSuperadmin = user?.role === 'superadmin';
  const canSwitchOrganization = isSuperadmin || (user?.memberships?.length ?? 0) > 1;
  const assignedOrgs = useMemo<OrgDto[]>(() => (user?.memberships || []).map((membership) => ({
    id: membership.orgId,
    name: membership.orgName,
  })), [user?.memberships]);
  const fixedParentOrgName =
    orgList.find((o) => o.id === user?.orgId)?.name || user?.orgName || autoT('ui_89e32a6a5474');
  // Keep the visible organisation structure in the switcher for every role.
  // This affects presentation only: orgList for non-superadmins contains
  // exclusively their own explicit memberships (see /orgs/subtree).
  const scopeOrgRows = useMemo(
    () => flattenOrgScopeTree(buildOrgScopeTree(orgList)),
    [orgList],
  );
  const keyboardOpen = useKeyboardOpen();
  const isActivityFull =
    location.pathname.startsWith('/activities/') && location.pathname !== '/activities';
  const isLogbookDetail = location.pathname.startsWith('/logbook/');
  const hideBottomNav = isActivityFull || isLogbookDetail || keyboardOpen;
  const hideFooter = isActivityFull || isLogbookDetail || keyboardOpen;
  const showDemoGuideRestore =
    demoModeEnabled && demoGuidesMutedForPageLoad && hasDemoMobileGuideForPath(location.pathname);
  const restoreDemoGuides = () => {
    setDemoMobileGuideMuted(false);
  };
  const activeBannerSrc = useResolvedImageSrc(activeOrgBranding?.bannerUrl);

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
      // Use the account role to label an unselected context.
      setActiveOrgName(user?.role === 'superadmin' ? t('shell.globalOrganization') : t('workflow.noOrganizationAssigned'));
      return;
    }
    if (scope === null) {
      setActiveOrgName(user?.role === 'superadmin' ? t('shell.globalOrganization') : t('workflow.noOrganizationAssigned'));
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
        } else {
          list = assignedOrgs;
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
  }, [scope, user?.id, user?.role, user?.orgId, user?.orgName, assignedOrgs, t]);

  // Banner data is loaded independently from the name cache so an organisation
  // switch never briefly shows the preceding organisation's visual identity.
  useEffect(() => {
    if (typeof scope !== 'string') {
      setActiveOrgBranding(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const orgs = user?.role === 'superadmin' ? await listOrgs() : await listAccessibleOrgs();
        const active = orgs.find((org) => org.id === scope) || null;
        if (!cancelled) setActiveOrgBranding(active);
      } catch {
        if (!cancelled) setActiveOrgBranding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, user?.id, user?.role]);

  useEffect(() => {
    const onBrandingChanged = (event: Event) => {
      const updated = (event as CustomEvent<OrgDto>).detail;
      if (updated?.id && updated.id === scope) setActiveOrgBranding(updated);
    };
    window.addEventListener('stato:organization-branding-changed', onBrandingChanged);
    return () => window.removeEventListener('stato:organization-branding-changed', onBrandingChanged);
  }, [scope]);
  useEffect(() => {
    if (!scopeModalOpen) return;
    (async () => {
      try {
        if (user?.role === 'superadmin') {
          setOrgList(await listOrgs());
        } else {
          setOrgList(await listAccessibleOrgs());
        }
      } catch {
        /* ignore */
      }
      // Default selection to current scope; for legacy undefined use null (safe)
      setPendingScope(typeof scope === 'undefined' ? null : scope);
    })();
  }, [scopeModalOpen, user?.role, assignedOrgs, scope]);
  // Load org list when opening quick-create modal as well
  useEffect(() => {
    if (!createModalOpen) return;
    (async () => {
      try {
        if (user?.role === 'superadmin') {
          setOrgList(await listOrgs());
        } else {
          setOrgList(assignedOrgs);
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
  }, [createModalOpen, user?.role, user?.orgId, assignedOrgs]);

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

  const mobileViewport = useIsMobile(768, { touchIsMobile: false });
  const sidebarActive = !restrictToPasswordChange && !mobileViewport && user?.navigationLayout !== 'top';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const desktopItems = availableMobileNavItemIds.map(id => ({ ...mobileNavItems[id], label: t(`navigation.${id}`) }));
  const userMenuProps = {
    activeOrgName, orgSwitching, canSwitchOrganization,
    onSwitchOrganization: () => setScopeModalOpen(true),
    showDemoGuideRestore, onRestoreDemoGuides: restoreDemoGuides,
  };

  // Keep the document canvas at layout-viewport height. Shrinking this wrapper to the
  // VisualViewport exposes a strip below the app when Android opens its keyboard UI.
  return (
    <div className={`min-h-screen flex flex-col app-shell ${sidebarActive ? 'app-shell-sidebar' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {sidebarActive && <Sidebar items={desktopItems} userMenu={userMenuProps} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} />}
      {/* Header and desktop navigation share the banner background. */}
      <div
        ref={headerRef}
        className={`header-navigation-shell fixed inset-x-0 top-0 z-40 ${headerCompact ? 'header-navigation-shell-compact' : ''} ${activeBannerSrc ? 'header-navigation-shell-with-banner' : ''}`}
        style={{
          display: sidebarActive ? 'none' : undefined,
          '--organization-banner-position': `${activeOrgBranding?.bannerPosition ?? 50}%`,
        } as CSSProperties}
      >
        {activeBannerSrc ? (
          <div
            aria-hidden="true"
            className="header-organization-banner"
            style={{ backgroundImage: `url("${activeBannerSrc}")` }}
          />
        ) : null}
        <header className={`relative z-20 header-surface overflow-visible text-gray-900 ${activeBannerSrc ? 'header-surface-with-banner' : ''}`}>
        {activeOrgBranding?.brandColor ? (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 z-10 h-1"
            style={{ backgroundColor: activeOrgBranding.brandColor }}
          />
        ) : null}
        <div className="mobile-header-row relative z-20 container mx-auto px-2 sm:px-3 md:px-4 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="mobile-header-brand flex items-center gap-3 min-w-0">
            <img
              src={logoUrl}
              alt={autoT('ui_dc03855eb505')}
              className="w-9 h-9 md:w-11 md:h-11 shrink-0 object-contain select-none drop-shadow-lg"
            />
            {branding.orgName ? (
              <span
                className="min-w-0 line-clamp-2 text-xs font-medium leading-tight md:hidden"
                title={branding.orgName}
              >
                {branding.orgName}
              </span>
            ) : null}
            <div className="desktop-header-brand-copy hidden md:block leading-tight min-w-0">
              <div className="flex min-w-0 items-baseline gap-2">
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight truncate">
                  {autoT('ui_3abd120bdece')}
                </h1>
                {branding.orgName ? (
                  <span className="hidden md:block min-w-0 truncate text-xs md:text-sm font-medium text-gray-600">
                    {branding.orgName}
                  </span>
                ) : null}
              </div>
              <p className="hidden md:block text-[11px] md:text-sm text-gray-600 truncate">
                {autoT('ui_86922bad66e8')}
              </p>
            </div>
          </div>
          {!restrictToPasswordChange && canSwitchOrganization ? (
            <Button variant="secondary" size="sm" className="mobile-header-organization max-w-[40vw] min-w-0" onClick={() => setScopeModalOpen(true)} title={activeOrgName || t('workflow.chooseOrganization')} aria-label={`${t('workflow.chooseOrganization')}: ${activeOrgName || t('workflow.noOrganization')}`}>
              <span className="truncate">{scope ? activeOrgName || t('workflow.organization') : t('workflow.noOrganization')}</span>
            </Button>
          ) : (
            <span className="mobile-header-organization mobile-header-organization-static md:hidden" title={activeOrgName || user?.orgName || t('workflow.noOrganization')}>
              <span className="truncate">{activeOrgName || user?.orgName || t('workflow.noOrganization')}</span>
            </span>
          )}
          {!sidebarActive && <UserMenu {...userMenuProps} />}
        </div>
        </header>

      {!restrictToPasswordChange && !sidebarActive && (
        <nav className={`nav-surface relative z-10 hidden md:block ${activeBannerSrc ? 'nav-surface-with-banner' : ''}`}>
          <div className="container mx-auto px-4"><NavigationLinks items={desktopItems} /></div>
        </nav>
      )}
      </div>

      {/* Tiny spacer below fixed desktop nav for visual breathing room */}
      {!restrictToPasswordChange && !sidebarActive && <div className="hidden md:block h-[5px]" aria-hidden="true" />}

      {/* Main Content */}
      <main
        className={`container mx-auto min-w-0 w-full flex-1 overflow-x-clip px-2 sm:px-3 md:px-4 py-8 pt-[4.25rem] md:pt-32 ${hideBottomNav ? 'pb-0' : 'pb-24'} md:pb-8`}
      >
        <OrganizationAssignmentGate>
          {!restrictToPasswordChange && isSuperadmin && !scope && /^\/(dashboard|activities|projects|calendar|logbook|statistics|surveys|master-data|operations)(\/|$)/.test(location.pathname) ? (
            <section className="mx-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 md:mx-2">
              <h2 className="text-xl font-semibold">{t('workflow.noOrganization')}</h2>
              <p className="my-3">{t('workflow.contextHelp')}</p>
              <Button onClick={() => setScopeModalOpen(true)}>{t('workflow.chooseOrganization')}</Button>
            </section>
          ) : <Outlet key={`${scopeKey}:${location.pathname}`} context={{ openQuickTally }} />}
        </OrganizationAssignmentGate>
      </main>

      {/* QuickTally overlay (global) */}
      {quickTallyOpen && (
        <QuickTally onClose={() => setQuickTallyOpen(false)} onMinimize={minimizeQuickTally} />
      )}
      {!restrictToPasswordChange && !!quickTallySession && !quickTallyOpen && (
        <QuickTallyMinimizedPill onRestore={openQuickTally} />
      )}

      {/* Bottom Navigation (mobile) */}
      {!restrictToPasswordChange && (
        <nav
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
                <span>{t('navigation.more')}</span>
              </button>
            </li>
          </ul>
          {mobileMoreOpen && (
            <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+3.9rem)] right-2 w-52 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
              {mobileMoreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMoreOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Icon className="h-5 w-5 text-viridian" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      )}

      {!restrictToPasswordChange && !hideBottomNav && <DemoMobilePageGuide />}

      {/* Footer (hidden on full activity views or while keyboard open) */}
      {!hideFooter && !restrictToPasswordChange && (
        <footer className="mt-12">
          <div
            className={`footer-surface w-full px-4 py-6 text-center text-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/45 ${hideBottomNav ? '' : 'pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] md:pb-6'}`}
          >
            <div className="flex items-center justify-center gap-1 flex-wrap">
              <p>
                © {new Date().getFullYear()} {autoT('ui_2ed433a6e527')} {appVersionDisplay}
                {import.meta.env.VITE_COMMIT_SHA
                  ? ` (${String(import.meta.env.VITE_COMMIT_SHA).substring(0, 7)})`
                  : ''}{' '}
                ·{' '}
                <a href="mailto:hubertoink@outlook.com" className="underline hover:text-viridian">
                  {autoT('ui_cb4a3ac0211d')}
                </a>
              </p>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setImprintModalOpen(true)}
                className="text-sm font-medium underline underline-offset-2 hover:text-viridian"
              >
                {t('legal.imprint')}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setPrivacyModalOpen(true)}
                className="text-sm font-medium underline underline-offset-2 hover:text-viridian"
              >
                {t('legal.privacy')}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setTermsModalOpen(true)}
                className="text-sm font-medium underline underline-offset-2 hover:text-viridian"
              >
                {t('legal.terms')}
              </button>
            </div>
          </div>
        </footer>
      )}
      <ImprintModal open={imprintModalOpen} onClose={() => setImprintModalOpen(false)} />
      <PrivacyNoticeModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
      <TermsOfUseModal open={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
      {/* Quick Create Organisation Modal (org_admin) */}
      <Modal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setNewOrgName('');
        }}
        title={autoT('ui_bf524c1f1672')}
        maxWidth="sm"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{autoT('ui_974360ef7462')}</label>
            <input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              placeholder={autoT('ui_c07736c0505f')}
            />
          </div>
          <div>
            <label htmlFor="parent-org-select" className="block text-sm font-medium mb-1">
              {autoT('ui_ff5ba4d2f6c1')}
            </label>
            {isSuperadmin ? (
              <select
                id="parent-org-select"
                value={parentForNewOrg}
                onChange={(e) =>
                  setParentForNewOrg((e.target.value || 'root') as 'root' | string | '')
                }
                className="border rounded px-3 py-2 w-full"
              >
                <option value="root">{autoT('ui_89639351aea7')}</option>
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
                <p className="mt-1 text-xs text-gray-500">{autoT('ui_264e18d56e8f')}</p>
              </>
            )}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCreateModalOpen(false);
                setNewOrgName('');
              }}
            >
              {autoT('ui_07af7cb30fca')}
            </Button>
            <Button
              disabled={!newOrgName.trim() || (!isSuperadmin && !user?.orgId)}
              onClick={async () => {
                try {
                  const parentId = isSuperadmin
                    ? parentForNewOrg === 'root'
                      ? null
                      : parentForNewOrg || null
                    : (user?.orgId as string | undefined) || null;
                  const created = await createOrgApi(
                    newOrgName.trim(),
                    parentId as string | null | undefined,
                  );
                  void queryClient.invalidateQueries({ queryKey: ['sidebar-organizations'] });
                  setNewOrgName('');
                  setCreateModalOpen(false);
                  showToast(autoT('ui_76783d2c57a3', { value0: created.name }), {
                    type: 'success',
                  });
                } catch (e: unknown) {
                  const msg =
                    (e as { response?: { data?: { message?: unknown } } })?.response?.data
                      ?.message || autoT('ui_fe851ffd3df5');
                  showToast(String(msg), { type: 'error', durationMs: 3500 });
                }
              }}
            >
              {autoT('ui_bf524c1f1672')}
            </Button>
          </div>
        </div>
      </Modal>
      {/* Org Scope Switcher Modal */}
      <Modal
        open={scopeModalOpen}
        onClose={() => setScopeModalOpen(false)}
        title={autoT('ui_0cdb3ac56c8e')}
        maxWidth="sm"
      >
        <div className="space-y-3">
          {user?.role === 'superadmin' && (
            <div
              className={`org-scope-option rounded-lg ${pendingScope === null ? 'org-scope-option-active' : ''}`}
            >
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
                <span className="min-w-0 flex-1 font-medium">{autoT('ui_d672fc0dd1fd')}</span>
              </label>
            </div>
          )}
          <div className="max-h-72 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]">
            <ul className="divide-y divide-[var(--border-subtle)]">
              {/* Non-superadmins only see their explicitly assigned organizations. */}
              {scopeOrgRows.map(({ org, depth }) => (
                <OrganizationScopeOption
                  key={org.id}
                  org={org}
                  depth={depth}
                  selected={pendingScope === org.id}
                  onSelect={setPendingScope}
                />
              ))}
            </ul>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setScopeModalOpen(false)}
            >
              {autoT('ui_07af7cb30fca')}
            </Button>
            <Button
              onClick={() => {
                setScope(pendingScope);
                setScopeModalOpen(false);
              }}
              disabled={orgSwitching}
            >
              {orgSwitching ? autoT('ui_8877cfeced3f') : autoT('ui_594308426372')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
