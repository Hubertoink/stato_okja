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
 * Themed Toggle switch using CSS variables from index.css.
 * Mobile-first: big tap target and label on the right by default.
 */
export default function Toggle({ checked, onChange, label, ariaLabel, disabled, className }: ToggleProps) {
  const trackStyle: React.CSSProperties = {
    backgroundColor: checked ? 'var(--viridian)' : 'var(--french-gray-2)',
    borderColor: checked ? 'var(--viridian)' : 'var(--outer-space)',
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
        aria-label={ariaLabel || ((typeof label === 'string' ? label : 'Umschalten') as string)}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`inline-flex items-center gap-2 select-none ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-viridian rounded ${className || ''}`}
    >
      <span
        className="relative inline-flex items-center h-6 w-11 rounded-full border transition-colors duration-150 ease-out"
        style={trackStyle}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow transition-transform duration-150 ease-out ${checked ? 'translate-x-5' : ''}`}
          style={{
            backgroundColor: checked ? 'var(--mint-cream)' : 'var(--azure-web)',
            border: checked ? '1px solid var(--viridian)' : '1px solid var(--outer-space)'
          }}
        />
      </span>
      {label && <span className="text-sm whitespace-nowrap" style={{ color: 'var(--outer-space)' }}>{label}</span>}
    </button>
  );
}
