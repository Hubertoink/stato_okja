import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

export type FieldControlSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<FieldControlSize, string> = {
  sm: 'min-h-8 px-2.5 py-1.5 text-xs',
  md: 'min-h-10 px-3 py-2 text-sm',
  lg: 'min-h-11 px-3.5 py-2.5 text-sm',
};

/** Reuse this for native controls that need special behaviour but the standard field treatment. */
export function fieldControlClassName({
  className = '',
  invalid = false,
  size = 'md',
}: {
  className?: string;
  invalid?: boolean;
  size?: FieldControlSize;
} = {}) {
  return `ui-field-control w-full ${sizeClasses[size]} ${invalid ? 'ui-field-control-invalid' : ''} ${className}`.trim();
}

type FieldControlProps = { invalid?: boolean; size?: FieldControlSize };

export function FieldLabel({ children, className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`block text-sm font-medium text-[var(--text-primary)] ${className}`} {...props}>
      {children}
    </label>
  );
}

export function Input({ className = '', invalid = false, size, ...props }: InputHTMLAttributes<HTMLInputElement> & FieldControlProps) {
  return <input aria-invalid={invalid || props['aria-invalid']} className={fieldControlClassName({ className, invalid, size })} {...props} />;
}

export function Select({ children, className = '', invalid = false, size, ...props }: SelectHTMLAttributes<HTMLSelectElement> & FieldControlProps) {
  return <select aria-invalid={invalid || props['aria-invalid']} className={fieldControlClassName({ className, invalid, size })} {...props}>{children}</select>;
}

export function Textarea({ className = '', invalid = false, size, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldControlProps) {
  return <textarea aria-invalid={invalid || props['aria-invalid']} className={fieldControlClassName({ className, invalid, size })} {...props} />;
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-[var(--text-secondary)]">{children}</p>;
}

export function FieldError({ children, id }: { children: ReactNode; id?: string }) {
  return <p id={id} role="alert" className="mt-1 text-xs font-medium text-[var(--status-danger-text)]">{children}</p>;
}
