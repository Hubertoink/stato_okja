import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Archive, ArchiveRestore, Plus, Trash2, X } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'warning'
  | 'warning-ghost'
  | 'danger'
  | 'danger-ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon-compact' | 'icon' | 'icon-touch';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border border-viridian bg-viridian text-white hover:bg-cambridge-blue hover:border-cambridge-blue',
  secondary: 'border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--interactive-soft)] hover:border-[var(--interactive-soft-border)]',
  ghost: 'border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
  warning: 'border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] hover:bg-[var(--status-warning-bg-strong)]',
  'warning-ghost': 'border border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--status-warning-border)] hover:bg-[var(--status-warning-bg)] hover:text-[var(--status-warning-text)]',
  danger: 'border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg-strong)]',
  'danger-ghost': 'border border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--status-danger-border)] hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-text)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 py-1.5 text-xs [&>svg]:h-4 [&>svg]:w-4',
  md: 'min-h-10 px-4 py-2 text-sm [&>svg]:h-4 [&>svg]:w-4',
  lg: 'min-h-11 px-5 py-2.5 text-sm [&>svg]:h-4 [&>svg]:w-4',
  'icon-compact': 'h-8 w-8 p-0 [&>svg]:h-4 [&>svg]:w-4',
  icon: 'h-10 w-10 p-0 [&>svg]:h-5 [&>svg]:w-5',
  'icon-touch': 'h-11 w-11 p-0 [&>svg]:h-5 [&>svg]:w-5',
};

export function Button({
  children,
  className = '',
  size = 'md',
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  'aria-label': ariaLabel,
  children,
  className = '',
  size = 'icon',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode;
  'aria-label': string;
  variant?: ButtonVariant;
  size?: Extract<ButtonSize, 'icon-compact' | 'icon' | 'icon-touch'>;
}) {
  return (
    <Button aria-label={ariaLabel} className={className} size={size} {...props}>
      {children}
    </Button>
  );
}

/** Shared dismiss action for dialogs, drawers and overlays. */
export function CloseButton({
  'aria-label': ariaLabel,
  className = '',
  size = 'icon',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  'aria-label': string;
  size?: Extract<ButtonSize, 'icon-compact' | 'icon' | 'icon-touch'>;
}) {
  return (
    <IconButton
      aria-label={ariaLabel}
      className={`rounded-full border-[var(--border-subtle)] bg-[var(--surface-2)] ${className}`}
      size={size}
      variant="danger-ghost"
      {...props}
    >
      <X aria-hidden="true" />
    </IconButton>
  );
}

/** Shared archive action. Archiving is intentionally distinct from deletion. */
export function ArchiveIconButton({
  'aria-label': ariaLabel,
  className = '',
  restore = false,
  size = 'icon',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  'aria-label': string;
  restore?: boolean;
  size?: Extract<ButtonSize, 'icon-compact' | 'icon' | 'icon-touch'>;
}) {
  return (
    <IconButton
      aria-label={ariaLabel}
      className={`rounded-full ${className}`}
      size={size}
      variant={restore ? 'secondary' : 'warning'}
      {...props}
    >
      {restore ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
    </IconButton>
  );
}

/** Shared destructive icon action with consistent color, focus and hit area. */
export function DeleteIconButton({
  'aria-label': ariaLabel,
  className = '',
  size = 'icon',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  'aria-label': string;
  size?: Extract<ButtonSize, 'icon-compact' | 'icon' | 'icon-touch'>;
}) {
  return (
    <IconButton
      aria-label={ariaLabel}
      className={`rounded-full ${className}`}
      size={size}
      variant="danger"
      {...props}
    >
      <Trash2 aria-hidden="true" />
    </IconButton>
  );
}

/** Shared primary action for creating a new entity across list headers. */
export function CreateButton({
  children,
  className = '',
  size = 'md',
  variant = 'primary',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <Button size={size} variant={variant} className={className} {...props}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      {children}
    </Button>
  );
}
