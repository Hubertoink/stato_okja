import { FileDown } from 'lucide-react';
import { autoT } from '@/i18n/auto';
import { Button, IconButton } from '@/components/ui/Button';

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
}: {
  triggerLabel: string;
  menuTitle: string;
  isExporting: boolean;
  options: StatisticsExportOption[];
}) {
  return (
    <div className="group/chart-export relative shrink-0">
      <IconButton
        aria-label={triggerLabel}
        className="rounded-full shadow-sm opacity-100 md:opacity-0 md:group-hover/chart-card:opacity-100 md:group-focus-within/chart-card:opacity-100"
        title={triggerLabel}
        disabled={isExporting}
        variant="secondary"
        style={isExporting ? { visibility: 'hidden' } : undefined}
      >
        <FileDown aria-hidden="true" />
      </IconButton>

      <div
        className="invisible pointer-events-none absolute right-0 top-full z-20 mt-2 w-44 translate-y-1 rounded-xl border border-gray-200 bg-white p-2 opacity-0 shadow-xl transition-all group-hover/chart-export:visible group-hover/chart-export:pointer-events-auto group-hover/chart-export:translate-y-0 group-hover/chart-export:opacity-100 group-focus-within/chart-export:visible group-focus-within/chart-export:pointer-events-auto group-focus-within/chart-export:translate-y-0 group-focus-within/chart-export:opacity-100"
        data-chart-export-ignore="true"
      >
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
          {menuTitle}
        </div>
        {options.map((option, index) => (
          <Button
            key={`${option.label}-${option.meta}`}
            className={`w-full justify-between ${index > 0 ? "mt-1" : ''}`}
            onClick={option.onClick}
            disabled={isExporting}
            size="sm"
            variant="ghost"
          >
            <span>{option.label}</span>
            <span className="text-xs text-[var(--text-muted)]">{option.meta}</span>
          </Button>
        ))}
        {isExporting && (
          <div className="px-3 pt-2 text-xs text-gray-500">{autoT('ui_bfbe8402858e')}</div>
        )}
      </div>
    </div>
  );
}
