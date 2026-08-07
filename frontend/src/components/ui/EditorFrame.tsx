import { X } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { IconButton } from './Button';

export function EditorHeader({
  actions,
  className = '',
  closeLabel,
  onClose,
  showCloseButton = true,
  title,
  titleId,
}: {
  actions?: ReactNode;
  className?: string;
  closeLabel: string;
  onClose: () => void;
  showCloseButton?: boolean;
  title: ReactNode;
  titleId?: string;
}) {
  return (
    <header className={`editor-modal-header flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2 md:px-6 ${className}`}>
      <h2 id={titleId} className="min-w-0 truncate text-2xl font-bold text-viridian">{title}</h2>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {showCloseButton ? (
          <IconButton
            variant="secondary"
            className="rounded-full"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <X className="h-5 w-5" />
          </IconButton>
        ) : null}
      </div>
    </header>
  );
}

export function EditorSurface({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[var(--card-shadow)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function EditorActions({
  className = '',
  leading,
  primary,
  secondary,
}: {
  className?: string;
  leading?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <footer className={`flex flex-col gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 pb-safe md:flex-row md:items-center md:justify-end md:px-6 ${className}`}>
      {leading ? <div className="order-3 [&>*]:w-full md:order-1 md:mr-auto md:[&>*]:w-auto">{leading}</div> : null}
      {secondary ? <div className="order-2 [&>*]:w-full md:[&>*]:w-auto">{secondary}</div> : null}
      <div className="order-1 [&>*]:w-full md:order-3 md:[&>*]:w-auto">{primary}</div>
    </footer>
  );
}
