import type { KeyboardEvent } from 'react';
import QuickTallyButton from '@/components/QuickTally/QuickTallyButton';

interface ActivityCohortCountFieldProps {
  mode: 'input' | 'tap';
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  placeholder: string;
  cohortId: string;
  gender: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export default function ActivityCohortCountField({
  mode,
  value,
  onChange,
  ariaLabel,
  placeholder,
  cohortId,
  gender,
  onKeyDown,
}: ActivityCohortCountFieldProps) {
  if (mode === 'tap') {
    return (
      <QuickTallyButton
        value={value}
        onChange={onChange}
        label={ariaLabel}
        className="h-12 w-full min-w-0 min-h-[3rem] rounded-md border border-gray-300 px-1.5 py-1 text-gray-900 hover:border-gray-400 hover:bg-gray-50 active:border-viridian md:h-14 md:min-h-[3.5rem] md:rounded-lg md:px-2"
        valueClassName="text-lg md:text-xl"
      />
    );
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      pattern="[0-9]*"
      min={0}
      value={value ? String(value) : ''}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => onChange(Number(event.target.value || 0))}
      onKeyDown={onKeyDown}
      data-cohort-id={cohortId}
      data-gender={gender}
      enterKeyHint="next"
      className="h-12 w-full rounded-md border px-1.5 py-1 text-center text-base tabular-nums md:h-14 md:rounded-lg md:px-2 md:text-lg"
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}