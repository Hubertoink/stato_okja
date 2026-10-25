import { Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useOrgScope } from '@/lib/orgScope';
import { listAccessibleOrgs, listOrgs } from '@/lib/orgs';
import { compareLocalized } from '@/i18n/formatters';
import './sidebar-organization.css';

/** Switch the existing organization scope directly, without a confirmation dialog. */
export default function SidebarOrganization({
  activeOrgName,
  canSwitch,
}: {
  activeOrgName: string | null;
  canSwitch: boolean;
}) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { scope, setScope, switching } = useOrgScope();
  const superadmin = user?.role === 'superadmin';
  const organizations = useQuery({
    queryKey: ['sidebar-organizations', user?.id, user?.role],
    queryFn: () => (superadmin ? listOrgs() : listAccessibleOrgs()),
    enabled: canSwitch,
  });
  const options = [...(organizations.data || [])].sort((a, b) => compareLocalized(a.name, b.name));
  const currentName = activeOrgName || t('workflow.noOrganization');
  return (
    <section className="sidebar-organization-section" aria-label={t('workflow.organization')}>
      <p className="sidebar-label">{t('workflow.organization')}</p>
      <div className="sidebar-org-control" title={currentName}>
        <Building2 aria-hidden="true" className="h-5 w-5 shrink-0" />
        {canSwitch ? (
          <Select
            aria-label={t('workflow.chooseOrganization')}
            value={scope || ''}
            disabled={switching || organizations.isPending || organizations.isError}
            onChange={(event) => setScope(event.target.value || null)}
          >
            {superadmin && <option value="">{t('shell.globalOrganization')}</option>}
            {scope && !options.some((org) => org.id === scope) && (
              <option value={scope}>{currentName}</option>
            )}
            {options.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </Select>
        ) : (
          <span className="sidebar-label">{currentName}</span>
        )}
      </div>
      {organizations.isError && (
        <Button
          variant="ghost"
          className="sidebar-org-retry"
          onClick={() => void organizations.refetch()}
          title={t('shell.retryOrganizations')}
        >
          {t('shell.retryOrganizations')}
        </Button>
      )}
    </section>
  );
}
