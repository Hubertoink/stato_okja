import type { HTMLAttributes, ReactNode } from 'react';

export function SurfaceCard({
  children,
  className = '',
  padding = 'md',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}) {
  const paddingClass = {
    none: '',
    sm: 'p-3',
    md: 'p-4 md:p-6',
    lg: 'p-6 md:p-8',
  }[padding];

  return (
    <div
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-[var(--card-shadow)] ${paddingClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
