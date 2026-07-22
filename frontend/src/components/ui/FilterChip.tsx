import type { ReactNode } from 'react';
import { X } from 'lucide-react';

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
          className="rounded-full p-0.5 text-viridian/75 transition-colors hover:bg-[var(--interactive-soft-strong)] hover:text-viridian"
          aria-label="Filter entfernen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </span>
  );
}
