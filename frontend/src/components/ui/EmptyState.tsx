import type { ReactNode } from 'react';

export function EmptyState({
  action,
  className = '',
  description,
  illustration,
  icon,
  title,
}: {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  illustration?: string;
  icon?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-8 text-center ${className}`}>
      {illustration ? (
        <img className="empty-state-illustration" src={illustration} alt="" aria-hidden="true" />
      ) : icon ? <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--interactive-soft)] text-viridian">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-secondary)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
