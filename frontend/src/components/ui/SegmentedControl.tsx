import type { CSSProperties, ReactNode } from 'react';

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  className = '',
  onChange,
  options,
  value,
  variant = 'period',
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  value: T;
  variant?: 'period' | 'emphasis';
}) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const controlStyle = { '--segmented-count': options.length } as CSSProperties;

  return (
    <div
      className={`segmented-control segmented-control--${variant} ${className}`}
      role="tablist"
      aria-label={ariaLabel}
      style={controlStyle}
    >
      <span
        className="segmented-control-indicator"
        aria-hidden="true"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={option.disabled}
            className={`segmented-control-button ${isActive ? 'segmented-control-button-active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.icon ? <span className="segmented-control-icon" aria-hidden="true">{option.icon}</span> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
