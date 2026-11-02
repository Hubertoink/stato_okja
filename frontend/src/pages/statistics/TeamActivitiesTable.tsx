import { useState } from 'react';
import { useActivitiesPaged } from '@/lib/activities';
import { StatisticsActivitiesTable } from './StatisticsActivitiesTable';
import type { StatisticsOverviewParams } from './types';

export function TeamActivitiesTable({
  params,
  staffId,
}: {
  params: StatisticsOverviewParams;
  staffId: string;
}) {
  const [page, setPage] = useState(1);
  const query = useActivitiesPaged(
    {
      from: params.from,
      to: params.to,
      type: params.type,
      weekdays: params.weekdays,
      closureState: params.closureState,
      projectIds: params.projectId ? [params.projectId] : undefined,
      staffIds: [staffId],
      executionStatuses: ['completed', 'planned', 'cancelled'],
    },
    page,
    50,
  );
  const labels: Record<string, string> = {
    open_door: 'Offene Tür',
    project_open: 'Projekt (offen)',
    project_closed: 'Projekt (geschlossen)',
    event: 'Veranstaltung',
    outreach: 'Aufsuchend',
  };
  return (
    <StatisticsActivitiesTable
      activities={query.data?.data || []}
      isLoading={query.isPending || query.isPlaceholderData}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      totalActivities={query.data?.total || 0}
      page={page}
      perPage={50}
      totalPages={Math.max(1, Math.ceil((query.data?.total || 0) / 50))}
      onPageChange={setPage}
      isMobile={true}
      exportActions={null}
      staffId={staffId}
      formatNumber={(value) => (value ?? 0).toLocaleString('de-DE')}
      getTypeLabel={(type) => labels[type || ''] || type || ''}
    />
  );
}
