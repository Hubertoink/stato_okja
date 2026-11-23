import { useCallback, useId, useState } from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getTimeRangeValidationIssue } from '@/lib/timeRange';
import { FieldError, FieldLabel, Input } from './ui/Field';
import { IconButton } from './ui/Button';

export function useTimeRangeFields(start = '', end = '', required = false) {
  const id = useId();
  const [attempted, setAttempted] = useState(false);
  const issue = getTimeRangeValidationIssue(start, end, required);
  const validate = useCallback(() => {
    if (!issue) return true;
    setAttempted(true);
    const field = document.getElementById(`${id}-${!start ? 'start' : 'end'}`);
    field?.scrollIntoView?.({ block: 'center' });
    field?.focus({ preventScroll: true });
    return false;
  }, [id, issue, start]);
  return { id, start, end, required, issue: attempted ? issue : undefined, validate };
}

export function TimeRangeFields({ range, onStartChange, onEndChange, columns = 'grid-cols-2', startLabel, endLabel }: {
  range: ReturnType<typeof useTimeRangeFields>;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  columns?: string;
  startLabel?: string;
  endLabel?: string;
}) {
  const { t } = useTranslation('activities');
  const errorId = `${range.id}-error`;

  function field(name: 'start' | 'end', label: string, onChange: (value: string) => void) {
    const id = `${range.id}-${name}`;
    const value = range[name];
    const invalid = range.issue === 'incomplete' ? !value : range.issue === 'endNotAfterStart' && name === 'end';
    return (
      <div className="min-w-0">
        <FieldLabel htmlFor={id} className="mb-1">{label}</FieldLabel>
        <div className="time-field relative" data-empty={!value}>
          <Input
            id={id}
            type="time"
            value={value}
            required={range.required}
            onChange={(event) => onChange(event.target.value)}
            onInvalid={(event) => { event.preventDefault(); range.validate(); }}
            aria-invalid={invalid}
            aria-describedby={range.issue ? errorId : undefined}
          />
          {!value && <span className="time-placeholder" aria-hidden="true">--:--</span>}
          <IconButton
            variant="ghost"
            size="icon-compact"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            aria-label={t('quickAdd.pickTime', { field: label })}
            onClick={() => {
              const input = document.getElementById(id) as HTMLInputElement;
              input.focus();
              try {
                input.showPicker?.();
              } catch (error) {
                // Embedded browsers can restrict the picker. The focused field
                // still supports native keyboard entry in that case.
                if (!(error instanceof DOMException)) throw error;
              }
            }}
          >
            <Clock aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid gap-x-3 gap-y-1 ${columns}`}>
      {field('start', startLabel ?? t('quickAdd.start'), onStartChange)}
      {field('end', endLabel ?? t('quickAdd.end'), onEndChange)}
      {range.issue && (
        <div className="col-span-full">
          <FieldError id={errorId}>
            {t(range.issue === 'incomplete' ? 'quickAdd.timeRangeIncomplete' : 'quickAdd.timeRangeOrder')}
          </FieldError>
        </div>
      )}
    </div>
  );
}
