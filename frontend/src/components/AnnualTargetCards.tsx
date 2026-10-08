import { Link, NavLink } from 'react-router-dom';
import { Target } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePublicConfig } from '@/lib/publicConfig';
import {
  formatTargetValue,
  targetRequirement,
  targetDifference,
  targetYear,
  useAnnualTargets,
  type AnnualTarget,
  type TargetScope,
} from '@/lib/annualTargets';

export function StatisticsTabs() {
  const config = usePublicConfig();
  if (!config.data?.annualTargetsEnabled) return null;
  return (
    <nav
      aria-label="Statistikansichten"
      className="mb-6 flex gap-2 border-b border-[var(--border-subtle)] pb-3"
    >
      {[
        ['/statistics', 'Auswertung'],
        ['/statistics/targets', 'Jahresziele'],
      ].map(([to, label]) => (
        <NavLink
          end
          key={to}
          to={to}
          className={({ isActive }) =>
            `rounded-xl px-4 py-2 text-sm font-medium ${isActive ? 'bg-viridian text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function TargetProgress({ target }: { target: AnnualTarget }) {
  const progress =
    target.rule === 'min' && !target.metric.endsWith('_percent') && target.target > 0
      ? ((target.result.value ?? 0) / target.target) * 100
      : null;
  return (
    <div className="space-y-2">
      <p className="text-2xl font-semibold">
        {formatTargetValue(target.result.value, target.metric)}
      </p>
      <p className="text-sm text-[var(--text-secondary)]">{targetRequirement(target)}</p>
      {progress !== null && (
        <>
          <progress
            aria-label={`${target.title}: Jahresfortschritt`}
            value={Math.min(100, progress)}
            max={100}
            className="h-2 w-full accent-viridian"
          />
          <p className="text-xs">
            {progress.toLocaleString('de-DE', { maximumFractionDigits: 0 })} % der Jahresvorgabe
          </p>
        </>
      )}
      <p className="text-sm">{targetDifference(target)}</p>
    </div>
  );
}

export default function AnnualTargetCards({
  year = targetYear(),
  scope,
}: {
  year?: number;
  scope?: TargetScope;
}) {
  const config = usePublicConfig();
  const { user } = useAuth();
  const { data, isError } = useAnnualTargets(year);
  const isAdmin = user?.role === 'org_admin' || user?.role === 'superadmin';
  const params = new URLSearchParams({ year: String(year) });
  if (scope?.activityId) params.set('activityId', scope.activityId);
  else if (scope?.projectId) params.set('projectId', scope.projectId);
  const to = `/statistics/targets?${params}`;
  const targets = data?.filter((target) =>
    scope?.activityId
      ? target.scope.activityId === scope.activityId
      : scope?.projectId
        ? target.scope.projectId === scope.projectId
        : target.showOnDashboard && target.status !== 'draft',
  );
  if (!config.data?.annualTargetsEnabled || (!scope && !targets?.length && !isError)) return null;
  return (
    <section className="modern-card mb-6 p-4 sm:p-6" aria-label="Jahresziele">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Target className="h-5 w-5" />
          Jahresziele {year}
        </h2>
        <Link className="text-sm font-medium text-viridian underline" to={to}>
          {scope && isAdmin ? 'Ziele ansehen und festlegen' : 'Alle Jahresziele'}
        </Link>
      </div>
      {isError ? (
        <p role="alert">Jahresziele konnten nicht geladen werden.</p>
      ) : !targets?.length ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Für diesen Bezug sind noch keine Jahresziele hinterlegt.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {targets.slice(0, 4).map((target) => (
            <Link
              className="rounded-xl border border-[var(--border-subtle)] p-4 hover:bg-[var(--surface-2)]"
              key={target.id}
              to={`/statistics/targets?year=${year}&target=${target.id}`}
            >
              <h3 className="mb-3 font-medium">{target.title}</h3>
              <TargetProgress target={target} />
              <p className="mt-3 text-xs text-[var(--text-secondary)]">
                Stand: {target.result.asOf.split('-').reverse().join('.')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
