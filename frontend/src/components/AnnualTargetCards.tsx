import { Link, NavLink } from 'react-router-dom';
import {
  ArrowUpRight,
  Archive,
  CheckCircle2,
  Clock3,
  FileEdit,
  LockKeyhole,
  Target,
  Users,
  Activity,
  PieChart,
  AlertCircle,
  CalendarCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import ProtectedImage from '@/components/ProtectedImage';
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
  targetMetrics,
  targetScopeLabel,
  targetStatuses,
  targetPeriodLabel,
  targetCanClose,
} from '@/lib/annualTargets';
import './AnnualTargetCards.css';

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

function metricIcon(target: AnnualTarget) {
  return target.metric === 'duration_hours'
    ? Clock3
    : target.metric === 'participant_total'
      ? Users
      : target.metric === 'activity_count'
        ? Activity
        : PieChart;
}

function targetTone(target: AnnualTarget) {
  if (target.status === 'draft' || target.evaluation.met === null) return 'neutral';
  if (target.evaluation.met) return 'success';
  return target.status === 'closed' ? 'warning' : 'neutral';
}

export function TargetPeriodBadge({ target }: { target: AnnualTarget }) {
  if (target.status === 'closed' || !targetCanClose(target)) return null;
  return (
    <span className="annual-target-period-ended">
      <CalendarCheck aria-hidden="true" />
      Zeitraum abgelaufen
    </span>
  );
}

export function TargetProgress({
  target,
  goalFirst = false,
}: {
  target: AnnualTarget;
  goalFirst?: boolean;
}) {
  const value = target.result.value;
  const isShare = target.metric.endsWith('_percent');
  const progress =
    target.rule === 'min' && !isShare && target.target > 0 && value !== null
      ? (value / target.target) * 100
      : null;
  const gaugeValue = isShare ? value : progress;
  const visibleValue = gaugeValue === null ? null : Math.min(100, Math.max(0, gaugeValue));
  const Icon = metricIcon(target);
  const marker = (percentage: number, key: string) => {
    const radians = (((percentage / 100) * 360 - 90) * Math.PI) / 180;
    return (
      <circle
        key={key}
        cx={70 + 58 * Math.cos(radians)}
        cy={70 + 58 * Math.sin(radians)}
        r="4"
        className="annual-target-gauge-marker"
      />
    );
  };
  const actualValue = (
    <div className="annual-target-actual">
      <span className="annual-target-value-label">
        {target.status === 'closed' ? 'Abschlusswert' : 'Istwert'}
      </span>
      <strong
        className={`annual-target-value ${value === null ? 'annual-target-value--empty' : ''}`}
      >
        {formatTargetValue(value, target.metric)}
      </strong>
    </div>
  );
  const requirement = (
    <div className="annual-target-requirement">
      <span className="annual-target-value-label">
        {target.dateFrom ? 'Zielvorgabe' : 'Jahresvorgabe'}
      </span>
      <span className="annual-target-requirement-value">{targetRequirement(target)}</span>
      {isShare && <span className="annual-target-marker-legend">Zielmarke im Kreis</span>}
    </div>
  );
  return (
    <div className={`annual-target-progress annual-target-tone--${targetTone(target)}`}>
      <div
        className="annual-target-gauge"
        role={visibleValue === null ? undefined : isShare ? 'meter' : 'progressbar'}
        aria-label={
          isShare ? `${target.title}: Besuchsanteil` : `${target.title}: Jahresfortschritt`
        }
        aria-valuemin={visibleValue === null ? undefined : 0}
        aria-valuemax={visibleValue === null ? undefined : 100}
        aria-valuenow={visibleValue ?? undefined}
        aria-valuetext={
          visibleValue === null
            ? undefined
            : isShare
              ? `${formatTargetValue(value, target.metric)}; ${targetRequirement(target)}`
              : `${progress!.toLocaleString('de-DE', { maximumFractionDigits: 1 })} % der ${target.dateFrom ? 'Zielvorgabe' : 'Jahresvorgabe'}`
        }
      >
        <svg viewBox="0 0 140 140" aria-hidden="true" focusable="false">
          <circle cx="70" cy="70" r="58" className="annual-target-gauge-track" />
          {visibleValue !== null && (
            <circle
              cx="70"
              cy="70"
              r="58"
              pathLength="100"
              className="annual-target-gauge-fill"
              strokeDasharray={`${visibleValue} 100`}
              transform="rotate(-90 70 70)"
            />
          )}
          {isShare && marker(target.target, 'target')}
          {isShare &&
            target.rule === 'range' &&
            target.upperTarget !== null &&
            marker(target.upperTarget, 'upper')}
        </svg>
        <div className="annual-target-gauge-center" aria-hidden="true">
          {gaugeValue !== null ? (
            <>
              <span className="annual-target-gauge-number">
                {gaugeValue.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
                <small> %</small>
              </span>
              <span className="annual-target-gauge-caption">
                {isShare ? 'Besuchsanteil' : 'der Vorgabe'}
              </span>
            </>
          ) : value === null ? (
            <>
              <span className="annual-target-gauge-number">–</span>
              <span className="annual-target-gauge-caption">keine Daten</span>
            </>
          ) : (
            <>
              <Icon className="annual-target-gauge-symbol" />
              <span className="annual-target-gauge-caption">
                {target.rule === 'range'
                  ? 'Zielkorridor'
                  : target.rule === 'max'
                    ? 'Obergrenze'
                    : 'Jahresziel'}
              </span>
            </>
          )}
        </div>
      </div>
      <div
        className={`annual-target-values ${goalFirst ? 'annual-target-values--goal-first' : ''}`}
      >
        {goalFirst ? requirement : actualValue}
        {goalFirst ? actualValue : requirement}
      </div>
    </div>
  );
}

export function AnnualTargetCard({
  target,
  to,
  onOpen,
}: {
  target: AnnualTarget;
  to?: string;
  onOpen?: () => void;
}) {
  const Icon = metricIcon(target);
  const StatusIcon =
    target.status === 'draft' ? FileEdit : target.status === 'closed' ? Archive : LockKeyhole;
  const scopeKind = target.scope.projectId
    ? 'Projekt'
    : target.scope.activityId
      ? 'Aktivität'
      : target.scope.types?.length
        ? 'Bereich'
        : 'Bezug';
  const tone = targetTone(target);
  return (
    <article
      className={`annual-target-card annual-target-tone--${tone}`}
      aria-labelledby={`annual-target-title-${target.id}`}
    >
      {target.scope.projectId && target.projectImageUrl && (
        <div className="annual-target-project-backdrop" aria-hidden="true">
          <ProtectedImage src={target.projectImageUrl} alt="" loading="lazy" />
        </div>
      )}
      <div className="annual-target-card-top">
        <span className="annual-target-metric-icon" aria-hidden="true">
          <Icon />
        </span>
        <span className={`annual-target-status annual-target-status--${target.status}`}>
          <StatusIcon aria-hidden="true" />
          {targetStatuses[target.status]}
        </span>
      </div>
      <h3 id={`annual-target-title-${target.id}`} className="annual-target-card-title">
        {target.title}
      </h3>
      {target.agreement && target.status !== 'draft' && (
        <div className="annual-target-agreement">
          <Target aria-hidden="true" />
          <div>
            <span>Zielvereinbarung</span>
            <p>{target.agreement}</p>
          </div>
        </div>
      )}
      <dl className="annual-target-metadata">
        <div>
          <dt>{scopeKind}</dt>
          <dd>{targetScopeLabel(target)}</dd>
        </div>
        <div>
          <dt>Kennzahl</dt>
          <dd>{targetMetrics[target.metric]}</dd>
        </div>
        <div>
          <dt>Zeitraum</dt>
          <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{targetPeriodLabel(target)}</span>
            <TargetPeriodBadge target={target} />
          </dd>
        </div>
      </dl>
      <div className="annual-target-card-performance">
        <TargetProgress target={target} goalFirst={target.status !== 'draft'} />
        <div className="annual-target-result">
          <span
            className={`annual-target-result-icon annual-target-result-icon--${tone}`}
            aria-hidden="true"
          >
            {tone === 'success' ? (
              <CheckCircle2 />
            ) : tone === 'warning' ? (
              <AlertCircle />
            ) : (
              <Target />
            )}
          </span>
          <div>
            <p>{targetDifference(target)}</p>
            <span>
              {target.status === 'draft'
                ? 'Vorschau · Ziel noch nicht festgelegt'
                : target.status === 'closed'
                  ? target.evaluation.met === null
                    ? 'Jahresabschluss nicht bewertbar'
                    : target.evaluation.met
                      ? 'Ziel erreicht'
                      : 'Ziel nicht erreicht'
                  : targetCanClose(target)
                    ? 'Zielzeitraum beendet'
                    : target.evaluation.met
                      ? 'Vorgabe bisher erfüllt'
                      : 'Stand im laufenden Zielzeitraum'}
            </span>
          </div>
        </div>
      </div>
      {target.dataChanged && (
        <p className="annual-target-data-warning">
          <AlertCircle aria-hidden="true" />
          Daten seit Abschluss geändert
        </p>
      )}
      <footer className="annual-target-card-footer">
        <span>Stand: {target.result.asOf.split('-').reverse().join('.')}</span>
        {to ? (
          <Link
            to={to}
            className="annual-target-details"
            aria-label={`Ziel ansehen: ${target.title}`}
          >
            Details ansehen
            <ArrowUpRight aria-hidden="true" />
          </Link>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="annual-target-details"
            onClick={onOpen}
            aria-label={`Ziel ansehen: ${target.title}`}
          >
            Details ansehen
            <ArrowUpRight aria-hidden="true" />
          </Button>
        )}
      </footer>
    </article>
  );
}

export function CompactAnnualTargetCard({ target, to }: { target: AnnualTarget; to: string }) {
  return (
    <article className={`annual-target-compact annual-target-tone--${targetTone(target)}`}>
      <Link to={to} className="annual-target-compact-link" aria-label={`Ziel ansehen: ${target.title}`}>
        <div className="annual-target-compact-heading">
          <h3 title={target.title}>{target.title}</h3>
          <span className={`annual-target-status annual-target-status--${target.status}`}>
            {targetStatuses[target.status]}
          </span>
        </div>
        <div className="annual-target-compact-summary">
          <dl aria-label={targetMetrics[target.metric]}>
            <div>
              <dt>{target.status === 'closed' ? 'Abschluss' : 'Ist'}</dt>
              <dd className="annual-target-compact-actual">{formatTargetValue(target.result.value, target.metric)}</dd>
            </div>
            <div>
              <dt>Ziel</dt>
              <dd>{targetRequirement(target)}</dd>
            </div>
          </dl>
          <ArrowUpRight aria-hidden="true" />
        </div>
        {target.dataChanged && (
          <p className="annual-target-data-warning">
            <AlertCircle aria-hidden="true" /> Daten seit Abschluss geändert
          </p>
        )}
      </Link>
    </article>
  );
}

export default function AnnualTargetCards({
  year = targetYear(),
  scope,
  onOpen,
  compact = false,
}: {
  year?: number;
  scope?: TargetScope;
  onOpen?: (target: AnnualTarget) => void;
  compact?: boolean;
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
    <section className={compact ? 'annual-targets-compact' : 'modern-card mb-6 p-4 sm:p-6'} aria-label="Jahresziele">
      <div className={compact ? 'annual-targets-compact-header' : 'mb-4 flex flex-wrap items-center justify-between gap-3'}>
        <h2 className={`flex items-center gap-2 font-semibold ${compact ? 'text-sm' : 'text-lg'}`}>
          <Target className="h-5 w-5" />
          Jahresziele {year}
        </h2>
        <Link className="text-sm font-medium text-viridian underline" to={to}>
          {compact ? 'Alle Ziele' : scope && isAdmin ? 'Ziele ansehen und festlegen' : 'Alle Jahresziele'}
        </Link>
      </div>
      {isError ? (
        <p role="alert">Jahresziele konnten nicht geladen werden.</p>
      ) : !targets?.length ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Für diesen Bezug sind noch keine Jahresziele hinterlegt.
        </p>
      ) : (
        <div className={compact ? 'annual-target-compact-list' : 'annual-target-grid'}>
          {targets.slice(0, 4).map((target) => compact ? (
            <CompactAnnualTargetCard
              key={target.id}
              target={target}
              to={`/statistics/targets?year=${year}&target=${target.id}`}
            />
          ) : (
            <AnnualTargetCard
              key={target.id}
              target={target}
              to={onOpen ? undefined : `/statistics/targets?year=${year}&target=${target.id}`}
              onOpen={onOpen ? () => onOpen(target) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
