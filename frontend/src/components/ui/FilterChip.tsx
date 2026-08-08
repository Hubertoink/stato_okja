import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { autoT } from '@/i18n/auto';

export function FilterChip({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--interactive-soft)] px-2.5 py-1 text-xs font-medium text-viridian">
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-2)] text-viridian/80 transition-colors hover:bg-[var(--interactive-soft-strong)] hover:text-viridian"
          aria-label={autoT('ui_65768a88a10d')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </span>
  );
}
