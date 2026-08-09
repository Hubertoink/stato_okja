import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { IconButton } from './Button';

export function PaginationControls({
  page,
  pageCount,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  labels,
  compact = false,
}: {
  page: number;
  pageCount: number;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  labels: { first: string; previous: string; next: string; last: string };
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
      <IconButton className="shrink-0" onClick={onFirst} disabled={page <= 1} title={labels.first} aria-label={labels.first} size={compact ? 'icon-compact' : 'icon'} variant="secondary"><ChevronsLeft className="h-4 w-4" aria-hidden="true" /></IconButton>
      <IconButton className="shrink-0" onClick={onPrevious} disabled={page <= 1} title={labels.previous} aria-label={labels.previous} size={compact ? 'icon-compact' : 'icon'} variant="secondary"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></IconButton>
      <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-700`}>{page} / {pageCount}</span>
      <IconButton className="shrink-0" onClick={onNext} disabled={page >= pageCount} title={labels.next} aria-label={labels.next} size={compact ? 'icon-compact' : 'icon'} variant="secondary"><ChevronRight className="h-4 w-4" aria-hidden="true" /></IconButton>
      <IconButton className="shrink-0" onClick={onLast} disabled={page >= pageCount} title={labels.last} aria-label={labels.last} size={compact ? 'icon-compact' : 'icon'} variant="secondary"><ChevronsRight className="h-4 w-4" aria-hidden="true" /></IconButton>
    </div>
  );
}
