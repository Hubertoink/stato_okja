import { forwardRef, useImperativeHandle, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOrgScopedQueryState } from '@/lib/orgScope';
import { Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import type { StatisticsOverviewParams } from './types';

type TeamRow = {
  staffId: string;
  name: string;
  type: string;
  status: string;
  minutes: number;
  assignments: number;
};
export type TeamStatisticsHandle = { export: () => void };
const statuses = [
  { key: 'completed', label: 'Durchgeführt' },
  { key: 'planned', label: 'Geplant' },
  { key: 'cancelled', label: 'Ausgefallen' },
];
const types: Record<string, string> = {
  open_door: 'Offene Tür',
  project_open: 'Projekt (offen)',
  project_closed: 'Projekt (geschlossen)',
  event: 'Veranstaltung',
  outreach: 'Aufsuchend',
};
const hours = (minutes: number) =>
  (minutes / 60).toLocaleString('de-DE', { maximumFractionDigits: 2 });
const sum = (rows: TeamRow[], key: 'minutes' | 'assignments') =>
  rows.reduce((total, row) => total + row[key], 0);

export const TeamStatistics = forwardRef<
  TeamStatisticsHandle,
  { params: StatisticsOverviewParams }
>(function TeamStatistics({ params }, ref) {
  const { scope, scopeKey, ready } = useOrgScopedQueryState();
  const [staffId, setStaffId] = useState('');
  const queryParams = {
    from: params.from,
    to: params.to,
    type: params.type,
    projectId: params.projectId,
    weekdays: params.weekdays?.join(','),
    closureState: params.closureState,
    orgId: scope === null ? '' : scope,
  };
  const query = useQuery<TeamRow[]>({
    queryKey: ['stats:team', scopeKey, queryParams],
    enabled: ready,
    queryFn: async () => (await api.get('/stats/team', { params: queryParams })).data,
    refetchOnWindowFocus: true,
  });
  const all = query.data || [];
  const people = [...new Map(all.map((row) => [row.staffId, row.name])).entries()];
  const rows = all.filter((row) => !staffId || row.staffId === staffId);
  const [exportError, setExportError] = useState(false);
  useImperativeHandle(ref, () => ({
    export: () => {
      if (!query.data) return;
      void (async () => {
        try {
          setExportError(false);
          const XLSX = await import('xlsx-js-style');
          const sheet = XLSX.utils.aoa_to_sheet([
            ['Team-Auswertung', params.from || '', params.to || ''],
            ['Person', 'Typ', 'Status', 'Einsätze', 'Minuten', 'Personenstunden'],
            ...rows.map((row) => [
              row.name,
              types[row.type] || row.type,
              statuses.find((s) => s.key === row.status)?.label || row.status,
              row.assignments,
              row.minutes,
              row.minutes / 60,
            ]),
          ]);
          const book = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(book, sheet, 'Team');
          XLSX.writeFile(book, 'Stato-Team.xlsx');
        } catch {
          setExportError(true);
        }
      })();
    },
  }));
  if (query.isPending) return <p role="status">Team-Auswertung wird geladen …</p>;
  if (query.isError)
    return (
      <div role="alert">
        Die Team-Auswertung konnte nicht geladen werden.{' '}
        <Button onClick={() => void query.refetch()}>Erneut versuchen</Button>
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <label className="block text-sm font-medium">
          Team-Mitglied
          <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Alle Team-Mitglieder</option>
            {people.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        Personenstunden zählen die Einsatzzeit jeder zugeordneten Person. Ohne individuelle
        Anpassung gilt die volle Aktivitätsdauer. Die Team-Ansicht zeigt alle drei Status getrennt.
      </p>
      {exportError && <p role="alert">Der Export ist fehlgeschlagen. Bitte erneut versuchen.</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        {statuses.map((status) => {
          const matching = rows.filter((row) => row.status === status.key);
          return (
            <div
              key={status.key}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5"
            >
              <h3>{status.label}</h3>
              <p className="text-2xl font-semibold mt-2">{hours(sum(matching, 'minutes'))} Std.</p>
              <p className="text-sm">{sum(matching, 'assignments')} Einsätze</p>
            </div>
          );
        })}
      </div>
      {!rows.length ? (
        <p>Keine zugeordneten Team-Einsätze für diese Auswahl.</p>
      ) : (
        <>
          <Breakdown
            title="Nach Typ"
            groups={Object.entries(types).map(([key, label]) => ({
              key,
              label,
              rows: rows.filter((row) => row.type === key),
            }))}
          />
          <Breakdown
            title="Nach Team-Mitglied"
            groups={people
              .filter(([id]) => !staffId || staffId === id)
              .map(([id, name]) => ({
                key: id,
                label: name,
                rows: rows.filter((row) => row.staffId === id),
              }))}
          />
        </>
      )}
    </div>
  );
});

function Breakdown({
  title,
  groups,
}: {
  title: string;
  groups: Array<{ key: string; label: string; rows: TeamRow[] }>;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="space-y-4">
        {groups
          .filter((group) => group.rows.length)
          .map((group) => (
            <div
              key={group.key}
              className="border-b border-[var(--border-subtle)] pb-4 last:border-0"
            >
              <h3 className="font-medium mb-2">{group.label}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {statuses.map((status) => {
                  const matching = group.rows.filter((row) => row.status === status.key);
                  return (
                    <div key={status.key} className="flex justify-between gap-2 sm:block">
                      <span className="text-sm text-[var(--text-secondary)]">{status.label}</span>
                      <p>
                        {hours(sum(matching, 'minutes'))} Std. · {sum(matching, 'assignments')}{' '}
                        Einsätze
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
