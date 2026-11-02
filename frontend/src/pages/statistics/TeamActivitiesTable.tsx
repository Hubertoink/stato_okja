import { useRef, useState } from 'react';
import { fetchAllActivities, useActivitiesPaged, type ActivitiesFilter } from '@/lib/activities';
import { StatisticsActivitiesTable } from './StatisticsActivitiesTable';
import { useOrgScopedQueryState } from '@/lib/orgScope';
import { useToast, useProgressToast } from '@/components/Toast';
import { StatisticsExportActions } from '../StatisticsExportActions';
import { exportActivitiesAsCsv, exportActivitiesAsExcel } from './export/activitiesExport';
import type { StatisticsOverviewParams } from './types';

export function TeamActivitiesTable({
  params,
  staffId,
}: {
  params: StatisticsOverviewParams;
  staffId: string;
}) {
  const [page, setPage] = useState(1);
  const { scope } = useOrgScopedQueryState();
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const exportLock = useRef(false);
  useProgressToast(exporting, 'Aktivitäten werden exportiert …');
  const filters: ActivitiesFilter = {
      from: params.from,
      to: params.to,
      type: params.type,
      weekdays: params.weekdays,
      closureState: params.closureState,
      projectIds: params.projectId ? [params.projectId] : undefined,
      staffIds: [staffId],
      executionStatuses: ['completed', 'planned', 'cancelled'],
    };
  const query = useActivitiesPaged(filters, page, 50);
  const labels: Record<string, string> = {
    open_door: 'Offene Tür',
    project_open: 'Projekt (offen)',
    project_closed: 'Projekt (geschlossen)',
    event: 'Veranstaltung',
    outreach: 'Aufsuchend',
  };
  const getTypeLabel = (type?: string | null) => labels[type || ''] || type || '';
  async function exportTable(format: 'csv' | 'xlsx') {
    if (exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    try {
      const activities = await fetchAllActivities(filters, scope);
      const run = format === 'csv' ? exportActivitiesAsCsv : exportActivitiesAsExcel;
      await run({ activities, staffId, getTypeLabel,
        fileName: `Stato-Team-Aktivitaeten-${params.from || 'Alle'}-${params.to || 'Alle'}.${format}`,
        onProgress: () => {},
      });
    } catch {
      showToast('Die Aktivitätenliste konnte nicht exportiert werden. Bitte erneut versuchen.', { type: 'error' });
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  }
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
      exportActions={<StatisticsExportActions triggerLabel="Team-Aktivitäten exportieren"
        menuTitle="Aktivitäten exportieren" isExporting={exporting}
        options={[
          { label: 'CSV', meta: 'Komplett', onClick: () => void exportTable('csv') },
          { label: 'Als Excel', meta: 'Komplett', onClick: () => void exportTable('xlsx') },
        ]} />}
      staffId={staffId}
      formatNumber={(value) => (value ?? 0).toLocaleString('de-DE')}
      getTypeLabel={(type) => labels[type || ''] || type || ''}
    />
  );
}
