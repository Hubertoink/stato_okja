import type {
  AnnualTarget,
  AnnualTargetMetric,
  AnnualTargetRule,
} from './entities/annual-target.entity';

export function annualTargetPeriod(
  target: Pick<AnnualTarget, 'year'> & Partial<Pick<AnnualTarget, 'dateFrom' | 'dateTo'>>,
) {
  return {
    from: target.dateFrom ?? `${target.year}-01-01`,
    to: target.dateTo ?? `${target.year}-12-31`,
  };
}

export function shiftTargetDate(date: string | null, years: number) {
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  const nextYear = year + years;
  const lastDay = new Date(Date.UTC(nextYear, month, 0)).getUTCDate();
  return `${nextYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export type TargetTotals = {
  activities: number;
  minutes: number;
  visits: number;
  male: number;
  female: number;
  diverse: number;
};
export function annualTargetValue(metric: AnnualTargetMetric, totals: TargetTotals): number | null {
  if (metric === 'duration_hours') return totals.minutes / 60;
  if (metric === 'participant_total') return totals.visits;
  if (metric === 'activity_count') return totals.activities;
  const denominator = totals.male + totals.female + totals.diverse;
  if (!denominator) return null;
  const numerator =
    metric === 'female_share_percent'
      ? totals.female
      : metric === 'male_share_percent'
        ? totals.male
        : totals.diverse;
  return (numerator / denominator) * 100;
}

export function evaluateAnnualTarget(
  value: number | null,
  rule: AnnualTargetRule,
  target: number,
  upperTarget: number | null,
) {
  if (value === null) return { met: null, difference: null };
  const maximum = rule === 'range' ? upperTarget! : target;
  const met =
    rule === 'min'
      ? value >= target
      : rule === 'max'
        ? value <= target
        : value >= target && value <= maximum;
  return {
    met,
    difference:
      rule === 'max'
        ? maximum - value
        : rule === 'range' && value > maximum
          ? maximum - value
          : value - target,
  };
}

export function berlinToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) => parts.find((entry) => entry.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
