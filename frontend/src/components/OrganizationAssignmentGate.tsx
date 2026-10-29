import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';

export default function OrganizationAssignmentGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { t } = useTranslation('common');
  if (user && user.role !== 'superadmin' && !user.orgId && !user.memberships?.length &&
      !user.mustChangePassword && pathname !== '/me') {
    return (
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6">
        <h2 className="text-xl font-semibold">{t('workflow.noOrganizationAssigned')}</h2>
        <p className="mt-3">{t('workflow.noOrganizationAssignedHelp')}</p>
      </section>
    );
  }
  return children;
}
