import { Button } from '@/components/ui/Button';
import type { ReactNode } from 'react';
import './DataTransition.css';

/** Keep the previous layout mounted, but never expose values from another query. */
export function DataTransition({ pending, refreshing, error, label, onRetry, children }: {
  pending: boolean;
  refreshing?: boolean;
  error?: boolean;
  label: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  const hidden = pending || error;
  return (
    <div className="relative" aria-busy={pending}>
      <div role="status" className="text-sm text-gray-500 min-h-6 py-1">
        {pending ? label : refreshing ? 'Wird aktualisiert …' : null}
      </div>
      <div className="relative" style={{ minHeight: hidden ? 240 : undefined }}>
        <div style={{ visibility: hidden ? 'hidden' : undefined }} aria-hidden={hidden || undefined}>
          {children}
        </div>
        {pending && <div aria-hidden="true" className="absolute inset-0 rounded-xl bg-gray-100 motion-safe:animate-pulse"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 48px, rgb(255 255 255 / .8) 48px, rgb(255 255 255 / .8) 64px)' }} />}
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
      <div className="h-8 rounded bg-gray-100 motion-safe:animate-pulse" />
    </td></tr>
  ))}</>;
}
