import { autoT } from '@/i18n/auto';
type ActivityCohortTotalsRowProps = {
  male: number;
  female: number;
  diverse: number;
  total: number;
};

export default function ActivityCohortTotalsRow({
  male,
  female,
  diverse,
  total,
}: ActivityCohortTotalsRowProps) {
  return (
    <div className="activity-cohort-grid border-t border-gray-100 pt-2">
      <span className="text-sm font-medium text-gray-700">{autoT('ui_2197d2688f45')}</span>
      <div className="flex h-12 items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm font-semibold tabular-nums text-gray-700 md:h-9">
        {male}
      </div>
      <div className="flex h-12 items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm font-semibold tabular-nums text-gray-700 md:h-9">
        {female}
      </div>
      <div className="flex h-12 items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm font-semibold tabular-nums text-gray-700 md:h-9">
        {diverse}
      </div>
      <div className="flex h-12 items-center justify-center rounded border border-gray-200 bg-gray-100 text-sm font-semibold tabular-nums text-gray-800 md:h-9">
        {total}
      </div>
    </div>
  );
}