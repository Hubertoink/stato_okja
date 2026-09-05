import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import type { OrganizationClosureStateFilter } from '@/lib/orgs';
import type { StatsOverviewResponse } from './types';
import activitiesKpiIcon from '../../../assets/Illust_Amigos/Aktivitäten.svg';
import participantsKpiIcon from '../../../assets/Illust_Amigos/Teilnehmende.svg';
import hoursKpiIcon from '../../../assets/Illust_Amigos/Stunden.svg';
import participantsPerHourKpiIcon from '../../../assets/Illust_Amigos/proAktivität.svg';

export function StatisticsKpis({
  showAverage,
  onShowAverageChange,
  summary,
  selectedClosureState,
  averageActivitiesPerWeek,
  totalParticipantsPerHour,
  averageHoursPerActivity,
  formatNumber,
}: {
  showAverage: boolean;
  onShowAverageChange: (showAverage: boolean) => void;
  summary?: StatsOverviewResponse['summary'];
  selectedClosureState?: OrganizationClosureStateFilter;
  averageActivitiesPerWeek: number;
  totalParticipantsPerHour: number;
  averageHoursPerActivity: number;
  formatNumber: (value?: number) => string;
}) {
  const { t } = useTranslation('common');
  return (
    <>
      <div className="flex items-center justify-end mb-4" data-pdf-section>
        <SegmentedControl<'absolute' | 'average'>
          ariaLabel={`${autoT('ui_ffa660db79fb')} / ${autoT('ui_388b22eb70db')}`}
          onChange={(mode) => onShowAverageChange(mode === 'average')}
          options={[
            { value: 'absolute', label: autoT('ui_ffa660db79fb') },
            { value: 'average', label: autoT('ui_388b22eb70db') },
          ]}
          value={showAverage ? 'average' : 'absolute'}
        />
      </div>
      <div
        className={`statistics-kpi-grid ${selectedClosureState === 'closed' ? 'statistics-kpi-grid--with-closure' : ''}`}
        data-pdf-section
      >
        <KpiCard
          icon={activitiesKpiIcon}
          variant="activities"
          value={
            showAverage
              ? averageActivitiesPerWeek.toLocaleString(getCurrentIntlLocale(), {
                  maximumFractionDigits: 1,
                })
              : formatNumber(summary?.totalActivities)
          }
          label={showAverage ? autoT('ui_a5ae4475a508') : autoT('ui_b6bf5f1a2033')}
        />
        <KpiCard
          icon={participantsKpiIcon}
          variant="participants"
          value={
            showAverage
              ? summary?.averageParticipants?.toLocaleString('de-DE', { maximumFractionDigits: 1 })
              : formatNumber(summary?.totalParticipants)
          }
          label={showAverage ? autoT('ui_ce999918d5c2') : t('workflow.attendances')}
        />
        <KpiCard
          icon={participantsPerHourKpiIcon}
          variant="participants-per-hour"
          value={totalParticipantsPerHour.toLocaleString(getCurrentIntlLocale(), {
            maximumFractionDigits: 1,
          })}
          label={showAverage ? autoT('ui_86f83c37babf') : autoT('ui_bb662b9cd669')}
        />
        <KpiCard
          icon={hoursKpiIcon}
          variant="hours"
          value={
            showAverage
              ? averageHoursPerActivity.toLocaleString(getCurrentIntlLocale(), {
                  maximumFractionDigits: 1,
                })
              : summary?.totalHours?.toLocaleString('de-DE')
          }
          label={showAverage ? autoT('ui_ddd5d008e490') : autoT('ui_02f31c07bda8')}
        />
        {selectedClosureState === 'closed' && (
          <KpiCard
            variant="closure"
            value={formatNumber(summary?.closureDaysCount ?? 0)}
            label={autoT('ui_13c97516c9d9')}
          />
        )}
      </div>
    </>
  );
}

function KpiCard({
  icon,
  variant,
  value,
  label,
}: {
  icon?: string;
  variant: string;
  value?: string;
  label: string;
}) {
  return (
    <div className={`statistics-kpi-card statistics-kpi-card--${variant}`}>
      {icon && <img className="statistics-kpi-card-icon" src={icon} alt="" aria-hidden="true" />}
      <div className="statistics-kpi-card-content">
        <p className="statistics-kpi-card-value">{value}</p>
        <p className="statistics-kpi-card-label">{label}</p>
      </div>
    </div>
  );
}
