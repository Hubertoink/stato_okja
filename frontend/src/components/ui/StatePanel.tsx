import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export function LoadingState({ label = 'Daten werden geladen…' }: { label?: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-sm text-[var(--text-secondary)]">
      <Loader2 className="h-4 w-4 animate-spin text-viridian" />
      {label}
    </div>
  );
}

export function ErrorState({
  action,
  description = 'Bitte versuche es erneut.',
  title = 'Daten konnten nicht geladen werden',
}: {
  action?: { label: string; onClick: () => void };
  description?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <EmptyState
      icon={<AlertCircle className="h-5 w-5" />}
      title={title}
      description={description}
      action={action ? <Button variant="secondary" onClick={action.onClick}>{action.label}</Button> : undefined}
    />
  );
}
