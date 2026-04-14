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
    <div className="grid grid-cols-[auto_repeat(3,minmax(3.5rem,5rem))_minmax(2.25rem,2.75rem)] items-center gap-2 border-t border-gray-100 pt-2">
      <span className="text-sm font-medium text-gray-700">Summe</span>
      <div className="flex h-9 items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm font-semibold tabular-nums text-gray-700">
        {male}
      </div>
      <div className="flex h-9 items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm font-semibold tabular-nums text-gray-700">
        {female}
      </div>
      <div className="flex h-9 items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm font-semibold tabular-nums text-gray-700">
        {diverse}
      </div>
      <div className="flex h-9 items-center justify-center rounded border border-gray-200 bg-gray-100 text-sm font-semibold tabular-nums text-gray-800">
        {total}
      </div>
    </div>
  );
}