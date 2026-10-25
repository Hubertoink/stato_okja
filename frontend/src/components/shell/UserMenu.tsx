import SidebarTooltip from './SidebarTooltip';
import { Button } from '@/components/ui/Button';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Lightbulb, UserCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { useDesktopUpdates } from '@/lib/desktopUpdates';
import ProtectedImage from '@/components/ProtectedImage';
import { administrationItems } from './navigationItems';

export type UserMenuProps = {
  sidebar?: boolean;
  activeOrgName: string | null;
  orgSwitching: boolean;
  canSwitchOrganization: boolean;
  onSwitchOrganization: () => void;
  showDemoGuideRestore: boolean;
  onRestoreDemoGuides: () => void;
};

export default function UserMenu({
  sidebar = false,
  activeOrgName,
  orgSwitching,
  canSwitchOrganization,
  onSwitchOrganization,
  showDemoGuideRestore,
  onRestoreDemoGuides,
}: UserMenuProps) {
  const { t } = useTranslation('common');
  const { user, logout } = useAuth();
  const updates = useDesktopUpdates();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const restricted = user?.mustChangePassword === true;
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>('.shell-user-trigger')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const action = (callback: () => void) => {
    setOpen(false);
    callback();
  };
  return (
    <div
      ref={root}
      className={`shell-user ${sidebar ? 'shell-user-sidebar' : 'shell-user-header mobile-header-user'}`}
    >
      <SidebarTooltip text={t('navigation.userMenu')} suppress={!sidebar || open}>
        <Button
          variant="ghost"
          type="button"
          className="shell-user-trigger theme-header-action"
          aria-label={t('navigation.userMenu')}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {user?.avatarUrl ? (
            <ProtectedImage
              src={user.avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <UserCircle2 className="w-8 h-8 shrink-0" aria-hidden="true" />
          )}
          <span className={`shell-user-copy ${sidebar ? '' : 'desktop-header-user-copy'}`}>
            <strong>{user?.name || user?.email}</strong>
            <small>
              {t(`roles.${user?.role || 'user'}`)}
              {!sidebar && activeOrgName ? ` · ${activeOrgName}` : ''}
              {orgSwitching ? ' …' : ''}
            </small>
          </span>
        </Button>
      </SidebarTooltip>
      {open && (
        <div id={id} className="shell-user-panel theme-menu-panel" onClick={() => setOpen(false)}>
          <div className="px-4 py-3 border-b theme-menu-section">
            <strong>{user?.name || user?.email}</strong>
            <p className="text-xs">{activeOrgName}</p>
          </div>
          <Link className="shell-menu-item theme-menu-item" to="/me">
            {t('userMenu.profile')}
          </Link>
          {updates.available && (
            <Button
              variant="ghost"
              type="button"
              data-stato-desktop-updates
              className="shell-menu-item theme-menu-item"
              onClick={() => action(updates.open)}
            >
              Desktop-Updates · {updates.state?.currentVersion ?? '…'}
            </Button>
          )}
          {!restricted && !sidebar && canSwitchOrganization && (
            <Button
              variant="ghost"
              type="button"
              className="shell-menu-item theme-menu-item"
              onClick={() => action(onSwitchOrganization)}
            >
              {t('userMenu.switchOrganization')}
            </Button>
          )}
          {!restricted &&
            !sidebar &&
            administrationItems(user?.role, t).map((item) => (
              <Link key={item.to} to={item.to} className="shell-menu-item theme-menu-item">
                {item.label}
              </Link>
            ))}
          {showDemoGuideRestore && (
            <Button
              variant="ghost"
              type="button"
              className="shell-menu-item theme-menu-item"
              onClick={() => action(onRestoreDemoGuides)}
            >
              <Lightbulb className="h-4 w-4" />
              {t('navigation.demoHints')}
            </Button>
          )}
          <Button
            variant="ghost"
            type="button"
            className="shell-menu-item theme-menu-item"
            onClick={() => action(logout)}
          >
            {t('userMenu.logout')}
          </Button>
        </div>
      )}
    </div>
  );
}
