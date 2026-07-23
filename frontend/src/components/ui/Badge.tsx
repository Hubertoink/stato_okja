import type { HTMLAttributes, ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'danger' | 'count';

const variants: Record<BadgeVariant, string> = {
  neutral: 'border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)]',
  accent: 'bg-[var(--interactive-soft)] text-viridian',
  success: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
  warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
  info: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)]',
  danger: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
  count: 'bg-[var(--surface-1)] text-[var(--text-secondary)]',
};

export function Badge({ children, className = '', variant = 'neutral', ...props }: HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  const sizeClasses = variant === 'count' ? 'px-2 py-1 text-xs font-normal' : 'px-2.5 py-1 text-xs font-medium';
  return <span className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${variants[variant]} ${className}`} {...props}>{children}</span>;
}
