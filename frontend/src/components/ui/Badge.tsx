import type { HTMLAttributes, ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'danger';

const variants: Record<BadgeVariant, string> = {
  neutral: 'border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)]',
  accent: 'bg-[var(--interactive-soft)] text-viridian',
  success: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
};

export function Badge({ children, className = '', variant = 'neutral', ...props }: HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${variants[variant]} ${className}`} {...props}>{children}</span>;
}
