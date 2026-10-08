import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  Layers,
  PieChart,
  Users,
} from 'lucide-react';
import {
  targetMetrics,
  targetPeriod,
  targetScopeLabel,
  type AnnualTarget,
} from '@/lib/annualTargets';

const dateLabel = (date: string) => date.split('-').reverse().join('.');
export default function AnnualTargetCalculation({ target }: { target: AnnualTarget }) {
  const period = targetPeriod(target);
  const Icon =
    target.metric === 'duration_hours'
      ? Clock3
      : target.metric === 'participant_total'
        ? Users
        : target.metric === 'activity_count'
          ? Activity
          : PieChart;
  const explanation =
    target.metric === 'duration_hours'
      ? 'Summe der Angebotsdauer in Stunden; keine Personalstunden.'
      : target.metric === 'participant_total'
        ? 'Summe der Besuche. Wiederkehrende Personen zählen bei jedem Besuch erneut.'
        : target.metric === 'activity_count'
          ? 'Anzahl der durchgeführten Aktivitäten. Ausgefallene Termine werden ausgeschlossen.'
          : 'Summe der Besuche des gewählten Geschlechts ÷ Summe aller Besuche mit Geschlechtszuordnung × 100. Es wird kein Durchschnitt einzelner Prozentwerte gebildet.';
  return (
    <section className="annual-target-calculation" aria-label="Berechnungsgrundlage">
      <h3>
        <Info aria-hidden="true" />
        Berechnungsgrundlage
      </h3>
      <dl>
        <div>
          <Icon aria-hidden="true" />
          <div>
            <dt>Kennzahl</dt>
            <dd>{targetMetrics[target.metric]}</dd>
          </div>
        </div>
        <div>
          <Layers aria-hidden="true" />
          <div>
            <dt>Bereich / Bezug</dt>
            <dd>{targetScopeLabel(target)}</dd>
          </div>
        </div>
        <div>
          <CalendarDays aria-hidden="true" />
          <div>
            <dt>Auswertungszeitraum</dt>
            <dd>
              {period.from > target.result.asOf
                ? `Auswertung ab ${dateLabel(period.from)}`
                : `${dateLabel(period.from)} – ${dateLabel(target.result.asOf)}`}
            </dd>
          </div>
        </div>
        <div>
          <CheckCircle2 aria-hidden="true" />
          <div>
            <dt>Datenbasis</dt>
            <dd>{target.result.activityCount} durchgeführte Aktivitäten</dd>
          </div>
        </div>
      </dl>
      <div className="annual-target-calculation-explanation">
        <Icon aria-hidden="true" />
        <p>{explanation}</p>
      </div>
      <div className="annual-target-calculation-note">
        <CalendarDays aria-hidden="true" />
        <p>
          Ein Zwischenstand ist keine Prognose. Der Abschluss ist nach dem {dateLabel(period.to)}{' '}
          möglich.
        </p>
      </div>
    </section>
  );
}
