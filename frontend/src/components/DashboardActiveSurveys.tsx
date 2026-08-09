import { useEffect, useState } from 'react';
import { CalendarClock, ChevronDown, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ActiveSurveyDashboardSummary } from '@/lib/surveys';
import { formatDate, formatNumber, getCurrentIntlLocale } from '@/i18n/formatters';
import { SurveyStatusBadge } from './SurveyStatusBadge';
import { Button } from './ui/Button';

type DashboardActiveSurveysProps = {
  surveys: ActiveSurveyDashboardSummary[];
  onOpenSurvey: (surveyId: string) => void;
};

function relativeTime(value: string | null, noResponse: string) {
  if (!value) return noResponse;
  const differenceMs = new Date(value).getTime() - Date.now();
  const absoluteMs = Math.abs(differenceMs);
  const formatter = new Intl.RelativeTimeFormat(getCurrentIntlLocale(), { numeric: 'auto' });
  if (absoluteMs < 60_000) return formatter.format(0, 'second');
  if (absoluteMs < 3_600_000) return formatter.format(Math.round(differenceMs / 60_000), 'minute');
  if (absoluteMs < 86_400_000) return formatter.format(Math.round(differenceMs / 3_600_000), 'hour');
  return formatter.format(Math.round(differenceMs / 86_400_000), 'day');
}

function remainingTime(
  endsAt: string | null,
  noEnd: string,
  endReached: string,
  hoursLabel: (count: number) => string,
  daysLabel: (count: number) => string,
) {
  if (!endsAt) return noEnd;
  const differenceMs = new Date(endsAt).getTime() - Date.now();
  if (differenceMs <= 0) return endReached;
  const hours = Math.ceil(differenceMs / 3_600_000);
  if (hours < 48) return hoursLabel(hours);
  return daysLabel(Math.ceil(hours / 24));
}

export default function DashboardActiveSurveys({
  surveys,
  onOpenSurvey,
}: DashboardActiveSurveysProps) {
  const { t } = useTranslation('dashboard');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (expandedId && !surveys.some((survey) => survey.id === expandedId)) setExpandedId(null);
  }, [expandedId, surveys]);

  if (!surveys.length) return null;

  return (
    <section className="dashboard-active-surveys mb-6" aria-labelledby="dashboard-active-surveys-title">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-viridian" aria-hidden="true" />
        <h2 id="dashboard-active-surveys-title" className="text-lg font-semibold text-[var(--text-primary)]">
          {t('surveys.title')}
        </h2>
      </div>
      <div className="dashboard-active-survey-grid">
        {surveys.map((survey) => {
          const expanded = expandedId === survey.id;
          const detailsId = `dashboard-survey-details-${survey.id}`;
          const hasTarget = survey.expectedParticipants !== null;
          const progress = hasTarget ? Math.min(100, Math.max(0, survey.responseRate || 0)) : null;
          const endReached = Boolean(survey.endsAt && new Date(survey.endsAt).getTime() <= Date.now());

          return (
            <article key={survey.id} className="dashboard-active-survey interactive-card rounded-xl">
              <Button
                variant="ghost"
                className="dashboard-active-survey-summary"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() => setExpandedId(expanded ? null : survey.id)}
              >
                <span className="dashboard-active-survey-heading">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-semibold text-[var(--text-primary)]">{survey.title}</span>
                    <span className="mt-2 block text-sm text-[var(--text-secondary)]">
                      {hasTarget
                        ? t('surveys.answersOfExpected', {
                            answers: formatNumber(survey.responsesCount),
                            expected: formatNumber(survey.expectedParticipants || 0),
                          })
                        : t('surveys.answers', { count: survey.responsesCount, formattedCount: formatNumber(survey.responsesCount) })}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <SurveyStatusBadge status={survey.status} />
                    <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </span>
                </span>
                {hasTarget ? (
                  <span className="mt-3 block" aria-label={t('surveys.responseRateLabel', { rate: survey.responseRate || 0 })}>
                    <span className="block h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                      <span className="block h-full rounded-full bg-viridian" style={{ width: `${progress}%` }} />
                    </span>
                    <span className="mt-1 block text-xs font-medium text-[var(--text-muted)]">
                      {t('surveys.responseRate', { rate: formatNumber(survey.responseRate || 0) })}
                    </span>
                  </span>
                ) : (
                  <span className="mt-3 block text-xs font-medium text-[var(--text-muted)]">{t('surveys.noTarget')}</span>
                )}
              </Button>

              {expanded && (
                <div id={detailsId} className="dashboard-active-survey-details">
                  {endReached && (
                    <div className="dashboard-active-survey-warning" role="status">
                      <CalendarClock className="h-4 w-4" aria-hidden="true" />
                      {t('surveys.endReached')}
                    </div>
                  )}
                  <dl className="dashboard-active-survey-metrics">
                    <div><dt>{t('surveys.today')}</dt><dd>{formatNumber(survey.responsesToday)}</dd></div>
                    <div><dt>{t('surveys.last7Days')}</dt><dd>{formatNumber(survey.responsesLast7Days)}</dd></div>
                    <div><dt>{t('surveys.lastResponse')}</dt><dd>{relativeTime(survey.lastResponseAt, t('surveys.noResponse'))}</dd></div>
                    <div>
                      <dt>{t('surveys.remaining')}</dt>
                      <dd title={survey.endsAt ? formatDate(survey.endsAt, { dateStyle: 'medium', timeStyle: 'short' }) : undefined}>
                        {remainingTime(
                          survey.endsAt,
                          t('surveys.noEnd'),
                          t('surveys.endReached'),
                          (count) => t('surveys.hoursRemaining', { count, formattedCount: formatNumber(count) }),
                          (count) => t('surveys.daysRemaining', { count, formattedCount: formatNumber(count) }),
                        )}
                      </dd>
                    </div>
                    <div><dt>{t('surveys.project')}</dt><dd>{survey.projectTitle || t('surveys.generalSurvey')}</dd></div>
                    <div><dt>{t('surveys.questions')}</dt><dd>{formatNumber(survey.questionCount)}</dd></div>
                    <div><dt>{t('surveys.round')}</dt><dd>{formatNumber(survey.roundNumber)}</dd></div>
                    <div>
                      <dt>{t('surveys.started')}</dt>
                      <dd>{survey.startedAt ? formatDate(survey.startedAt, { dateStyle: 'medium' }) : t('surveys.unknown')}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex justify-end">
                    <Button size="sm" onClick={() => onOpenSurvey(survey.id)}>{t('surveys.openAnalysis')}</Button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
