import { Button } from '@/components/ui/Button';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import './DataTransition.css';

/** Keep the previous layout mounted, but never expose values from another query. */
export function DataTransition({ pending, refreshing, error, label, onRetry, children, variant, empty = false, showStatus = true }: {
  pending: boolean;
  refreshing?: boolean;
  error?: boolean;
  label: string;
  onRetry?: () => void;
  children: ReactNode;
  variant?: 'statistics' | 'activity-cards';
  empty?: boolean;
  showStatus?: boolean;
}) {
  const hidden = pending || error;
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (content.current) content.current.inert = !!hidden;
  }, [hidden]);
  return (
    <div className="relative" aria-busy={pending}>
      {showStatus && <div role="status" className="text-sm text-gray-500 min-h-6 py-1">
        {pending ? label : refreshing ? 'Wird aktualisiert …' : null}
      </div>}
      <div className="relative" style={{ minHeight: hidden ? 240 : undefined }}>
        <div ref={content} className={pending && variant ? `data-skeleton-content data-skeleton--${variant}` : undefined}
          style={{ visibility: hidden ? 'hidden' : undefined }} aria-hidden={hidden || undefined}>
          {children}
        </div>
        {pending && variant === 'activity-cards' && empty && <ActivityCardsSkeleton />}
        {pending && !variant && <div aria-hidden="true" className="absolute inset-0 skeleton-shimmer rounded-xl" />}
        {error && <div role="alert" className="absolute inset-0 p-6 text-center">
          <p>Die Daten konnten nicht geladen werden.</p>
          <Button type="button" className="mt-3 text-viridian underline" onClick={onRetry}>Erneut versuchen</Button>
        </div>}
      </div>
    </div>
  );
}

export function LoadingTableRows({ rows = 6, columns = 7 }: { rows?: number; columns?: number }) {
  return <>{Array.from({ length: Math.max(1, rows) }, (_, index) => (
    <tr key={index} aria-hidden="true"><td colSpan={columns} className="px-6 py-4">
      <div className="h-8 rounded skeleton-shimmer" />
    </td></tr>
  ))}</>;
}

function ActivityCardsSkeleton() {
  return <div aria-hidden="true" className="space-y-3">
    <div className="skeleton-shimmer h-4 w-32 rounded my-4" />
    {[0, 1, 2].map((index) => <div key={index} className="activity-mobile-card bg-white p-3">
      <div className="flex gap-5">
        <div className="flex-1 space-y-3">
          <div className="skeleton-shimmer h-5 w-4/5 rounded" />
          <div className="skeleton-shimmer h-3 w-3/5 rounded" />
          <div className="skeleton-shimmer h-5 w-20 rounded" />
          <div className="flex gap-2"><div className="skeleton-shimmer h-4 w-24 rounded-full" /><div className="skeleton-shimmer h-4 w-16 rounded-full" /></div>
        </div>
        <div className="w-24 space-y-3">
          <div className="skeleton-shimmer h-5 w-14 rounded ml-auto" />
          <div className="skeleton-shimmer h-9 w-16 rounded mx-auto" />
          <div className="skeleton-shimmer h-6 w-full rounded" />
        </div>
      </div>
    </div>)}
  </div>;
}
