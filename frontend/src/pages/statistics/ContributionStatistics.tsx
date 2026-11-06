import type { ComponentProps } from 'react';
import { StatisticsBarChartCard } from '../StatisticsBarChartCard';
import { StatisticsPieChartCard } from '../StatisticsPieChartCard';
import { formatContributionMinutes, summarizeContributions, type ContributionEntry } from '@/lib/contributors';

type BarOptions = Partial<Omit<ComponentProps<typeof StatisticsBarChartCard>, 'data' | 'title' | 'barDataKey' | 'labelDataKey' | 'barName' | 'getCellFill' | 'getCellKey'>>;
type PieOptions = Partial<Omit<ComponentProps<typeof StatisticsPieChartCard>, 'data' | 'title' | 'formatValue' | 'cellKeyPrefix' | 'valueLabel'>>;

export default function ContributionStatistics({ entries, selectedIds = [], barProps, pieProps }: {
  entries: ContributionEntry[]; selectedIds?: string[]; barProps?: BarOptions; pieProps?: PieOptions;
}) {
  const rows = summarizeContributions(selectedIds.length ? entries.filter(entry => selectedIds.includes(entry.contributorId)) : entries);
  if (!rows.length) return null;
  return <>
    <StatisticsBarChartCard title="Mitwirkungseinsätze" exportActions={null}
      bodyClassName="h-80 md:h-[23rem]" gridStroke="var(--border-subtle)" xAxisHeight={64} yAxisAllowDecimals={false} valueLabelContent={<g />}
      {...barProps} data={rows} barDataKey="assignments" labelDataKey="assignments" barName="Einsätze"
      getCellFill={row => row.entries[0]?.color || '#7aa39a'} getCellKey={row => row.contributorId} />
    <StatisticsPieChartCard title="Verteilung der Mitwirkungszeit" exportActions={null}
      bodyClassName="h-80 md:h-[23rem]" innerRadius={60} outerRadius={90} showAbsoluteValueLabels={false} createLabelRenderer={() => false} separatorColor="var(--surface-1)"
      {...pieProps} data={rows.map(row => ({ name: row.name, value: row.minutes, color: row.entries[0]?.color || '#7aa39a' }))}
      formatValue={value => formatContributionMinutes(value || 0)} cellKeyPrefix="contribution-time" valueLabel="Mitwirkungszeit (Minuten)" />
  </>;
}
