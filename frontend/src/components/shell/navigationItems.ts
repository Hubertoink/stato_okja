import { Building2, Database, FileText, Home, ShieldCheck, Users, Wrench } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { Role } from '@/lib/auth';
import { canAccessDevTools } from '@/lib/devToolsConfig';

export type NavigationItem = { to: string; label: string; icon: typeof Home };

export function administrationItems(role: Role | undefined, t: TFunction): NavigationItem[] {
  const items: NavigationItem[] = [];
  if (role === 'org_admin' || role === 'superadmin') {
    items.push({ to: '/admin/users', label: t('userMenu.users'), icon: Users });
    items.push({ to: '/admin/orgs', label: t('userMenu.organizations'), icon: Building2 });
  }
  if (canAccessDevTools(role))
    items.push({ to: '/admin/dev-tools', label: t('userMenu.devTools'), icon: Wrench });
  if (role === 'superadmin')
    items.push(
      { to: '/admin/legal', label: t('shell.legal'), icon: FileText },
      { to: '/admin/audit', label: t('userMenu.audit'), icon: ShieldCheck },
      { to: '/admin/system-data', label: t('userMenu.dataManagement'), icon: Database },
    );
  return items;
}
