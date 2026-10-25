import SidebarTooltip from './SidebarTooltip';
import { NavLink } from 'react-router-dom';
import type { NavigationItem } from './navigationItems';

export default function NavigationLinks({
  items,
  sidebar = false,
  onNavigate,
}: {
  items: NavigationItem[];
  sidebar?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className={sidebar ? 'sidebar-links' : 'flex space-x-1'}>
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to}>
          <SidebarTooltip text={label} suppress={!sidebar}>
            <NavLink
              to={to}
              onClick={onNavigate}
              title={sidebar ? undefined : label}
              aria-label={label}
              data-tooltip={label}
              className={({ isActive }) =>
                `${sidebar ? 'sidebar-link' : 'nav-item-tooltip flex items-center px-4 py-3 rounded-t-xl'} theme-nav-item ${isActive ? 'theme-nav-item-active' : ''}`
              }
            >
              <Icon
                className={sidebar ? 'h-5 w-5 shrink-0' : 'w-5 h-5 min-[1400px]:mr-2 shrink-0'}
                aria-hidden="true"
              />
              <span className={sidebar ? 'sidebar-label' : 'nav-label'} data-text={label}>
                {label}
              </span>
            </NavLink>
          </SidebarTooltip>
        </li>
      ))}
    </ul>
  );
}
