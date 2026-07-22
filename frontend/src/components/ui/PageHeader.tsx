import type { ReactNode } from 'react';

export function PageHeader({
  actions,
  className = '',
  description,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className={`mb-6 mt-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-viridian md:text-3xl">{title}</h1>
        {description ? <div className="mt-1 text-sm text-[var(--text-secondary)] md:text-base">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 justify-end">{actions}</div> : null}
    </header>
  );
}
