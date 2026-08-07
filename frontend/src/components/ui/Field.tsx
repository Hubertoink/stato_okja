import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

const controlClassName = 'editor-field mt-1 w-full border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm transition-colors placeholder:text-[var(--text-faint)] hover:border-[var(--border-strong)] focus:border-viridian focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--input-disabled-bg)] disabled:opacity-70';

export function FieldLabel({ children, className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`block text-sm font-medium text-[var(--text-primary)] ${className}`} {...props}>
      {children}
    </label>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClassName} ${className}`} {...props} />;
}

export function Select({ children, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlClassName} ${className}`} {...props}>{children}</select>;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClassName} ${className}`} {...props} />;
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-[var(--text-secondary)]">{children}</p>;
}
