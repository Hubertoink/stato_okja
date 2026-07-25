import { FileDown } from 'lucide-react';

type StatisticsExportOption = {
  label: string;
  meta: string;
  onClick: () => void;
};

export function StatisticsExportActions({
  triggerLabel,
  menuTitle,
  isExporting,
  options,
  alwaysVisible = false,
}: {
  triggerLabel: string;
  menuTitle: string;
  isExporting: boolean;
  options: StatisticsExportOption[];
  alwaysVisible?: boolean;
}) {
  return (
    <div className="group/chart-export relative shrink-0">
      <button
        type="button"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-viridian hover:text-viridian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viridian/30 ${alwaysVisible ? '' : 'opacity-100 md:opacity-0 md:group-hover/chart-card:opacity-100 md:group-focus-within/chart-card:opacity-100'}`}
        aria-label={triggerLabel}
        title={triggerLabel}
        style={isExporting ? { visibility: 'hidden' } : undefined}
      >
        <FileDown className="h-4 w-4" />
      </button>

      <div
        className="invisible pointer-events-none absolute right-0 top-full z-20 mt-2 w-44 translate-y-1 rounded-xl border border-gray-200 bg-white p-2 opacity-0 shadow-xl transition-all group-hover/chart-export:visible group-hover/chart-export:pointer-events-auto group-hover/chart-export:translate-y-0 group-hover/chart-export:opacity-100 group-focus-within/chart-export:visible group-focus-within/chart-export:pointer-events-auto group-focus-within/chart-export:translate-y-0 group-focus-within/chart-export:opacity-100"
        data-chart-export-ignore="true"
      >
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
          {menuTitle}
        </div>
        {options.map((option, index) => (
          <button
            key={`${option.label}-${option.meta}`}
            type="button"
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60${index > 0 ? ' mt-1' : ''}`}
            onClick={option.onClick}
            disabled={isExporting}
          >
            <span>{option.label}</span>
            <span className="text-xs text-gray-400">{option.meta}</span>
          </button>
        ))}
        {isExporting && (
          <div className="px-3 pt-2 text-xs text-gray-500">Export wird vorbereitet…</div>
        )}
      </div>
    </div>
  );
}
