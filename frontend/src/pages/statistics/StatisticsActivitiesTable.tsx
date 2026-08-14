import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { Activity } from '@/lib/activities';
import { isCancelledActivity } from '@/lib/activityExecutionStatus';
import ActivityExecutionStatusBadge from '@/components/ActivityExecutionStatusBadge';
import { Button, IconButton } from '@/components/ui/Button';
import { autoT } from '@/i18n/auto';
import {
  formatActivityDateGerman,
  getActivityDurationMinutes,
  getActivityParticipantTotal,
} from './export/activitiesExport';

export function StatisticsActivitiesTable({
  activities,
  isLoading,
  totalActivities,
  page,
  totalPages,
  perPage,
  onPageChange,
  pdfMode,
  isMobile,
  exportActions,
  formatNumber,
  getTypeLabel,
}: {
  activities: Activity[];
  isLoading: boolean;
  totalActivities: number;
  page: number;
  totalPages: number;
  perPage: number;
  onPageChange: (page: number | ((page: number) => number)) => void;
  pdfMode: boolean;
  isMobile: boolean;
  exportActions: ReactNode;
  formatNumber: (value?: number) => string;
  getTypeLabel: (type?: string | null) => string;
}) {
  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) for (let index = 1; index <= totalPages; index++) pages.push(index);
  else {
    pages.push(1);
    if (page > 3) pages.push('ellipsis');
    for (let index = Math.max(2, page - 1); index <= Math.min(totalPages - 1, page + 1); index++)
      pages.push(index);
    if (page < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }
  return (
    <div
      className={`${pdfMode ? 'hidden ' : ''}group/chart-card mt-8 rounded-lg bg-white p-6 shadow`}
      data-pdf-section
    >
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-viridian">
          {autoT('ui_44eeeedb9e8f')}
          <span className="ml-2 text-sm font-normal text-gray-500">
            {totalActivities} {autoT('ui_303e11fd9d2b')}
          </span>
        </h3>
        <div className="flex items-center gap-2" data-chart-export-ignore="true">
          {!pdfMode && exportActions}
          {!pdfMode && totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="statistics-page-summary text-gray-500">
                <span className="statistics-page-summary-desktop">{autoT('ui_633082b8c84b')} </span>
                {page} {autoT('ui_445584edc4cc')} {totalPages}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-azure-web text-gray-700">
              {[
                autoT('ui_df5c3008c765'),
                autoT('ui_edcaf9aaa282'),
                autoT('ui_950701e758d1'),
                autoT('ui_20bda6d2e725'),
                autoT('ui_a24fe1e6fcc2'),
                autoT('ui_6b0d31c0d563'),
                autoT('ui_aff024fe4ab0'),
                autoT('ui_3c363836cf4e'),
                autoT('ui_d62550d402f1'),
              ].map((label, index) => (
                <th key={label} className={`px-3 py-2 ${index < 4 ? 'text-left' : 'text-right'}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activities.map((activity) => {
              const cancelled = isCancelledActivity(activity.executionStatus);
              return (
                <tr key={activity.id} data-pdf-row>
                  <td className="px-3 py-1.5">{formatActivityDateGerman(activity.date)}</td>
                  <td className="px-3 py-1.5">{getTypeLabel(activity.type)}</td>
                  <td className="px-3 py-1.5">{activity.title || ''}</td>
                  <td className="px-3 py-1.5">{activity.project?.title || ''}</td>
                  <td className="px-3 py-1.5 text-right">
                    {cancelled ? (
                      <div className="flex justify-end">
                        <ActivityExecutionStatusBadge status={activity.executionStatus} compact />
                      </div>
                    ) : (
                      formatNumber(getActivityParticipantTotal(activity))
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {cancelled ? '' : formatNumber(activity.countMale || 0)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {cancelled ? '' : formatNumber(activity.countFemale || 0)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {cancelled ? '' : formatNumber(activity.countDiverse || 0)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {getActivityDurationMinutes(activity) ?? ''}
                  </td>
                </tr>
              );
            })}
            {!pdfMode && isLoading && activities.length === 0 && (
              <EmptyRow label={autoT('ui_c2b2d9c3136c')} />
            )}
            {!pdfMode && !isLoading && activities.length === 0 && (
              <EmptyRow label={autoT('ui_afc08a0675e3')} />
            )}
          </tbody>
        </table>
      </div>
      {!pdfMode && totalPages > 1 && (
        <div className="mt-4 border-t border-gray-100 pt-4" data-chart-export-ignore="true">
          <div className="mb-3 text-xs text-gray-500 sm:mb-0">
            {autoT('ui_6e7156111137')} {(page - 1) * perPage + 1}–
            {Math.min(page * perPage, totalActivities)} {autoT('ui_445584edc4cc')} {totalActivities}
          </div>
          <div
            className={`flex gap-1 ${isMobile ? 'flex-wrap items-center justify-start' : 'items-center justify-end'}`}
          >
            <PaginationButton
              icon={<ChevronsLeft />}
              label={autoT('ui_f4b057452fde')}
              disabled={page === 1}
              onClick={() => onPageChange(1)}
            />
            <PaginationButton
              icon={<ChevronLeft />}
              label={autoT('ui_f6bc60bc537b')}
              disabled={page === 1}
              onClick={() => onPageChange((current) => Math.max(1, current - 1))}
            />
            {pages.map((item, index) =>
              item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  onClick={() => onPageChange(item)}
                  aria-current={item === page ? 'page' : undefined}
                  size="sm"
                  variant={item === page ? 'primary' : 'secondary'}
                >
                  {item}
                </Button>
              ),
            )}
            <PaginationButton
              icon={<ChevronRight />}
              label={autoT('ui_d3e6a4a47b5f')}
              disabled={page === totalPages}
              onClick={() => onPageChange((current) => Math.min(totalPages, current + 1))}
            />
            <PaginationButton
              icon={<ChevronsRight />}
              label={autoT('ui_58365134024f')}
              disabled={page === totalPages}
              onClick={() => onPageChange(totalPages)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
function EmptyRow({ label }: { label: string }) {
  return (
    <tr>
      <td className="px-3 py-3 text-center text-gray-500" colSpan={9}>
        {label}
      </td>
    </tr>
  );
}
function PaginationButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <IconButton
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      size="icon-compact"
      title={label}
      variant="secondary"
    >
      {icon}
    </IconButton>
  );
}
