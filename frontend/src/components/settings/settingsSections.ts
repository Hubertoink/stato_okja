import {
  Calendar,
  Clock,
  Folder,
  LayoutTemplate,
  MapPin,
  Monitor,
  Sun,
  Tag,
  Users,
} from 'lucide-react';
import type { Role } from '@/lib/auth';

export type SettingsSection = 'personal' | 'masterData' | 'operations';
export type SettingsTab =
  | 'appearance'
  | 'categories'
  | 'templates'
  | 'tags'
  | 'cohorts'
  | 'team'
  | 'locations'
  | 'holidays'
  | 'openingHours';
export const SETTINGS_PATHS: Record<SettingsSection, string> = {
  personal: '/settings',
  masterData: '/master-data',
  operations: '/operations',
};
const TABS = [
  { id: 'appearance', section: 'personal', icon: Monitor },
  { id: 'categories', section: 'masterData', icon: Folder },
  { id: 'tags', section: 'masterData', icon: Tag },
  { id: 'cohorts', section: 'masterData', icon: Calendar },
  { id: 'team', section: 'masterData', icon: Users },
  { id: 'locations', section: 'masterData', icon: MapPin },
  { id: 'templates', section: 'masterData', icon: LayoutTemplate },
  { id: 'openingHours', section: 'operations', icon: Clock },
  { id: 'holidays', section: 'operations', icon: Sun },
] as const;

export function getSettingsTabs(section: SettingsSection, role?: Role) {
  return TABS.filter(
    (tab) =>
      tab.section === section &&
      (tab.id !== 'templates' || role === 'org_admin' || role === 'superadmin'),
  );
}

/** Preserve old bookmarks and external links into the former combined settings page. */
export function getLegacySettingsPath(tab: string | null) {
  const section = TABS.find((item) => item.id === tab)?.section;
  return section && section !== 'personal' ? SETTINGS_PATHS[section] : null;
}

export function getSettingsSection(pathname: string): SettingsSection {
  const path = pathname.replace(/\/+$/, '');
  if (path === SETTINGS_PATHS.masterData) return 'masterData';
  if (path === SETTINGS_PATHS.operations) return 'operations';
  return 'personal';
}
