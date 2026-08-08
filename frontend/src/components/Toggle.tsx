import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Themed toggle switch based on semantic surface and border tokens.
 * Mobile-first: big tap target and label on the right by default.
 */
export default function Toggle({ checked, onChange, label, ariaLabel, disabled, className }: ToggleProps) {
  const trackStyle: React.CSSProperties = {
    backgroundColor: checked ? 'var(--viridian)' : 'var(--surface-3)',
    borderColor: checked ? 'var(--viridian)' : 'var(--border-strong)',
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || ((typeof label === 'string' ? label : "Umschalten") as string)}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg select-none ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ${className || ''}`}
    >
      <span
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-150 ease-out"
        style={trackStyle}
      >
        <span
          className={`h-5 w-5 rounded-full shadow-sm transition-transform duration-150 ease-out ${checked ? "translate-x-5" : ''}`}
          style={{
            backgroundColor: 'var(--surface-elevated)',
            border: checked ? '1px solid color-mix(in srgb, var(--viridian) 68%, var(--surface-elevated))' : '1px solid var(--border-strong)',
          }}
        />
      </span>
      {label && <span className="whitespace-nowrap text-sm text-[var(--text-secondary)]">{label}</span>}
    </button>
  );
}
