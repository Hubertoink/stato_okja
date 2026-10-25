import { Button } from '@/components/ui/Button';
import { useEffect, useState } from 'react';
import { Building2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import logoUrl from '../../../assets/Stato_Logo.png';
import NavigationLinks from './NavigationLinks';
import UserMenu, { type UserMenuProps } from './UserMenu';
import { administrationItems, type NavigationItem } from './navigationItems';

export default function Sidebar({
  items,
  userMenu,
  collapsed,
  onToggle,
}: {
  items: NavigationItem[];
  userMenu: UserMenuProps;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const admins = administrationItems(user?.role, t);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  return (
    <>
      {expanded && (
        <Button
          variant="ghost"
          className="sidebar-backdrop"
          aria-label={t('shell.collapse')}
          onClick={() => setExpanded(false)}
        >
          {null}
        </Button>
      )}
      <aside
        className={`app-sidebar ${collapsed ? 'is-collapsed' : ''} ${expanded ? 'is-expanded' : ''}`}
        aria-label={t('shell.navigation')}
      >
        <div className="sidebar-brand">
          <img src={logoUrl} alt="StatO" />
          <strong className="sidebar-label">StatO</strong>
        </div>
        <Button
          variant="ghost"
          type="button"
          className="sidebar-toggle sidebar-toggle-wide"
          onClick={onToggle}
          aria-label={t(collapsed ? 'shell.expand' : 'shell.collapse')}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
        <Button
          variant="ghost"
          type="button"
          className="sidebar-toggle sidebar-toggle-narrow"
          onClick={() => setExpanded(!expanded)}
          aria-label={t(expanded ? 'shell.collapse' : 'shell.expand')}
          aria-expanded={expanded}
        >
          {expanded ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>
        <Button
          variant="ghost"
          type="button"
          className="sidebar-organization"
          title={userMenu.activeOrgName || t('workflow.noOrganization')}
          disabled={!userMenu.canSwitchOrganization}
          onClick={userMenu.onSwitchOrganization}
        >
          <Building2 className="h-5 w-5 shrink-0" />
          <span className="sidebar-label">
            {userMenu.activeOrgName || t('workflow.noOrganization')}
          </span>
        </Button>
        <div className="sidebar-scroll">
          <nav aria-label={t('shell.navigation')}>
            <NavigationLinks
              sidebar
              items={items.filter((item) => item.to !== '/settings')}
              onNavigate={() => setExpanded(false)}
            />
          </nav>
          {admins.length > 0 && (
            <nav className="sidebar-admin" aria-label={t('shell.administration')}>
              <p className="sidebar-label">{t('shell.administration')}</p>
              <NavigationLinks sidebar items={admins} onNavigate={() => setExpanded(false)} />
            </nav>
          )}
        </div>
        <nav aria-label={t('navigation.settings')}>
          <NavigationLinks
            sidebar
            items={items.filter((item) => item.to === '/settings')}
            onNavigate={() => setExpanded(false)}
          />
        </nav>
        <UserMenu {...userMenu} sidebar />
      </aside>
    </>
  );
}
