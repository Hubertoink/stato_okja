import type { ReactNode } from 'react';
import { FloatingPageActions } from './FloatingPageActions';

export function PageHeader({
  actions,
  className = '',
  description,
  mobileInlineActions = false,
  mobileTitle,
  secondaryActions,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  mobileInlineActions?: boolean;
  mobileTitle?: ReactNode;
  secondaryActions?: ReactNode;
  title: ReactNode;
}) {
  const content = <>
    <div className={`page-header-row flex ${mobileInlineActions ? 'flex-row items-center justify-between gap-2' : 'flex-col gap-3'} md:flex-row md:items-start md:justify-between`}>
      <div className="page-header-title min-w-0">
        <h1 className={`${mobileInlineActions ? 'text-xl' : 'text-2xl'} font-bold text-viridian md:text-3xl`}>
          {mobileTitle ? <><span className="md:hidden">{mobileTitle}</span><span className="hidden md:inline">{title}</span></> : title}
        </h1>
        {description ? <div className="mt-1 text-sm text-[var(--text-secondary)] md:text-base">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 justify-end">{actions}</div> : null}
    </div>
    {secondaryActions ? <div className="page-header-secondary mt-4">{secondaryActions}</div> : null}
  </>;
  return (
    <header className={`mb-6 mt-1 ${className}`}>
      {actions ? <FloatingPageActions label={title}>{content}</FloatingPageActions> : content}
    </header>
  );
}
