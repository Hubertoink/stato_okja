import { TeamStatisticsSkeleton } from './TeamStatisticsSkeleton';
import { StatisticsEmptyState } from './StatisticsEmptyState';
import { formatStatisticsAggregationTooltipLabel } from '../statisticsHelpers';
import { autoT } from '@/i18n/auto';
import { TeamChartCard } from './TeamChartCard';
import { KpiCard } from './StatisticsKpis';
import { teamTimeSeries } from './teamTimeSeries';
import { TeamActivitiesTable } from './TeamActivitiesTable';
import { TeamParticipationChart } from './TeamParticipationChart';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOrgScopedQueryState } from '@/lib/orgScope';
import { Button } from '@/components/ui/Button';
import type { StatisticsOverviewParams } from './types';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type TeamRow = {
  date?: string;
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

export function useTeamStatisticsQuery(params: StatisticsOverviewParams, enabled = true) {
  const { scope, scopeKey, ready } = useOrgScopedQueryState();
  const queryParams = {
    from: params.from,
    to: params.to,
    type: params.type,
    projectId: params.projectId,
    weekdays: params.weekdays?.join(','),
    closureState: params.closureState,
    orgId: scope === null ? '' : scope,
  };
  return useQuery<TeamRow[]>({
    queryKey: ['stats:team', scopeKey, queryParams],
    enabled: ready && enabled,
    queryFn: async () => (await api.get('/stats/team', { params: queryParams })).data,
    refetchOnWindowFocus: true,
  });
}

export const TeamStatistics = forwardRef<
  TeamStatisticsHandle,
  {
    params: StatisticsOverviewParams;
    query: ReturnType<typeof useTeamStatisticsQuery>;
    staffId?: string;
    firstActivity?: boolean;
  }
>(function TeamStatistics({ params, query, staffId = '', firstActivity = false }, ref) {
  const all = query.data || [];
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
            ['Datum', 'Person', 'Typ', 'Status', 'Einsätze', 'Minuten', 'Personenstunden'],
            ...rows.map((row) => [
              row.date || '',
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
  if (query.isPending || query.isPlaceholderData) return <TeamStatisticsSkeleton participation={Boolean(params.projectId || params.type)} activities={Boolean(staffId)} />;
  if (query.isError)
    return (
      <div role="alert">
        Die Team-Auswertung konnte nicht geladen werden.{' '}
        <Button onClick={() => void query.refetch()}>Erneut versuchen</Button>
      </div>
    );
  if (!rows.length) return <StatisticsEmptyState team firstActivity={firstActivity} />;
  return (
    <div className="space-y-6">
      {exportError && <p role="alert">Der Export ist fehlgeschlagen. Bitte erneut versuchen.</p>}
      <div className="statistics-kpi-grid">
        {statuses.map((status) => {
          const matching = rows.filter((row) => row.status === status.key);
          return (
            <KpiCard
              key={status.key}
              variant={status.key === 'completed' ? 'hours' : 'participants'}
              value={`${hours(sum(matching, 'minutes'))} Std.`}
              label={`${status.label} · ${sum(matching, 'assignments').toLocaleString('de-DE')} Einsätze`}
            />
          );
        })}
        <KpiCard
          variant="activities"
          value={sum(
            rows.filter((row) => row.status === 'completed'),
            'assignments',
          ).toLocaleString('de-DE')}
          label="Durchgeführte Einsätze"
        />
      </div>
      {(params.projectId || params.type) && <TeamParticipationChart rows={rows} />}
      <TeamTypeChart rows={rows} />
      <TeamDayCharts rows={rows} singleMember={Boolean(staffId)} />
      {staffId && (
        <TeamActivitiesTable
          key={JSON.stringify([staffId, params])}
          params={params}
          staffId={staffId}
        />
      )}
    </div>
  );
});

const statusColors = ['#8b5cf6', '#3b82f6', '#f59e0b'];

function TeamDayCharts({ rows, singleMember }: { rows: TeamRow[]; singleMember: boolean }) {
  const series = teamTimeSeries(rows);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {[
        {
          title: series.monthly
            ? singleMember ? 'Ø Stunden je Monat' : 'Ø Stunden je Monat und Person'
            : singleMember ? 'Stunden je Einsatztag' : 'Ø Stunden je Einsatztag und Person',
          data: series.timeline,
          date: true,
        },
        { title: 'Ø Stunden nach Wochentag', data: series.weekdays, date: false },
      ].map((chart) => (
        <TeamChartCard key={chart.title} title={chart.title}>
          <div className="mt-4 h-72 min-w-0" role="img" aria-label={chart.title}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.data} margin={{ left: 0, right: 12, bottom: 12 }}>
                <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="name"
                  minTickGap={24}
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  tickFormatter={(value) =>
                    chart.date
                      ? series.monthly
                        ? `${value.slice(5, 7)}.${value.slice(0, 4)}`
                        : `${value.slice(8, 10)}.${value.slice(5, 7)}.`
                      : value
                  }
                />
                <YAxis
                  width={42}
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  tickFormatter={(value) => `${value} h`}
                />
                <Tooltip
                  wrapperStyle={{ zIndex: 10 }}
                  cursor={{ fill: 'var(--border-subtle)', fillOpacity: 0.35 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length || label == null) return null;
                    const prefix = chart.date
                      ? series.monthly ? 'Monat:' : autoT('ui_1ae0fe72e0f6', { value0: '' }).trim()
                      : 'Wochentag:';
                    const formatted = chart.date
                      ? formatStatisticsAggregationTooltipLabel(String(label), series.monthly ? 'month' : 'day')
                      : ({ Mo: 'Montag', Di: 'Dienstag', Mi: 'Mittwoch', Do: 'Donnerstag', Fr: 'Freitag', Sa: 'Samstag', So: 'Sonntag' }[String(label)] || String(label));
                    const dateValue = formatted.startsWith(prefix) ? formatted.slice(prefix.length).trimStart() : formatted;
                    const value = Number(payload[0].value ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 2 });
                    return (
                      <div className="rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)]"
                        style={{ backgroundColor: 'var(--surface-1)', boxShadow: '0 8px 26px rgba(76, 79, 105, 0.1)' }}>
                        <p className="m-0 text-[var(--text-secondary)]"><strong>{prefix}</strong> {dateValue}</p>
                        <p className="mb-0 mt-1.5"><strong>{singleMember && chart.date && !series.monthly ? 'Einsatzzeit' : 'Ø Einsatzzeit'}:</strong> {value} Std.</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="hours"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TeamChartCard>
      ))}
    </div>
  );
}

function TeamTypeChart({ rows }: { rows: TeamRow[] }) {
  const data = Object.entries(types).map(([type, name]) => ({
    name,
    ...Object.fromEntries(
      statuses.map((status) => [
        status.key,
        sum(
          rows.filter((row) => row.type === type && row.status === status.key),
          'minutes',
        ) / 60,
      ]),
    ),
  }));
  return (
    <TeamChartCard title="Personenstunden nach Typ">
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {statuses.map((status, index) => (
          <span key={status.key} className="inline-flex items-center gap-2">
            <span
              aria-hidden
              data-export-preserve-background="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: statusColors[index] }}
            />
            {status.label}
          </span>
        ))}
      </div>
      <div
        className="mt-4 h-[420px] w-full min-w-0"
        role="img"
        aria-label="Balkendiagramm der Personenstunden nach Aktivitätstyp und Status."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 0, bottom: 12 }}
            barGap={3}
          >
            <CartesianGrid horizontal={false} stroke="var(--border-subtle)" />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
              tickFormatter={(value) => `${Number(value).toLocaleString('de-DE')} h`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={116}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              contentStyle={{
                backgroundColor: 'var(--surface-1)',
                borderColor: 'var(--border-subtle)',
                borderRadius: 12,
                color: 'var(--text-primary)',
              }}
              formatter={(value: number) =>
                `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Std.`
              }
            />
            {statuses.map((status, index) => (
              <Bar
                key={status.key}
                dataKey={status.key}
                name={status.label}
                fill={statusColors[index]}
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TeamChartCard>
  );
}

export function TeamMemberChips({
  people,
  selectedId,
  onChange,
}: {
  people: Array<[string, string]>;
  selectedId: string;
  onChange: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded
    ? people
    : people.filter(([id], index) => index < 8 || id === selectedId);
  return (
    <section className="mt-5 space-y-2" aria-label="Team-Mitglieder auswählen">
      <h3 className="text-sm font-medium text-[var(--text-secondary)]">Team-Mitglieder</h3>
      <div className="flex flex-wrap gap-2">
        {[['', 'Alle Team-Mitglieder'], ...visible].map(([id, name]) => (
          <Button
            key={id}
            variant={id === selectedId ? 'primary' : 'secondary'}
            className="rounded-full max-w-full text-left"
            aria-pressed={id === selectedId}
            onClick={() => onChange(id)}
          >
            <span className="break-words min-w-0">{name}</span>
          </Button>
        ))}
        {people.length > 8 && (
          <Button
            variant="ghost"
            className="rounded-full border-dashed"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Weniger anzeigen' : `${people.length - visible.length} weitere anzeigen`}
          </Button>
        )}
      </div>
    </section>
  );
}
