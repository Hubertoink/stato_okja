import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ChevronDown } from 'lucide-react';
import {
  ACTIVITY_EXECUTION_STATUS_OPTIONS,
  type ActivityExecutionStatus,
  normalizeActivityExecutionStatus,
} from '@/lib/activityExecutionStatus';
import { useTranslation } from 'react-i18next';

function StatusIcon({ status, className = '' }: { status: ActivityExecutionStatus; className?: string }) {
  if (status === 'cancelled') {
    return <AlertTriangle className={className} />;
  }

  return <CheckCircle2 className={className} />;
}

export default function ActivityExecutionStatusControl({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (status: ActivityExecutionStatus) => void;
}) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const status = normalizeActivityExecutionStatus(value);
  const buttonClasses =
    status === 'cancelled'
      ? 'activity-status-control activity-status-control--cancelled'
      : 'activity-status-control activity-status-control--completed';

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return;
      const target = event.target;
      if (target instanceof Node && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={`status-control ${buttonClasses}`}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('executionStatus.title', { status: t(`executionStatus.${status}`) })}
      >
        <StatusIcon status={status} className="h-4 w-4" />
        <span className="hidden sm:inline">{t(`executionStatus.${status}`)}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ''}`} />
      </button>

      {open && (
        <div role="menu" className="activity-status-menu absolute right-0 top-full z-30 mt-2 w-52 rounded-2xl p-2">
          <div className="status-menu-label px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
            {t('executionStatus.menuTitle')}
          </div>
          {ACTIVITY_EXECUTION_STATUS_OPTIONS.map((option) => {
            const active = option === status;
            return (
              <button
                key={option}
                type="button"
                className={`activity-status-menu-item flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  active ? "activity-status-menu-item--active" : ''
                }`}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                role="menuitemradio"
                aria-checked={active}
              >
                <span className="inline-flex items-center gap-2">
                  <StatusIcon
                    status={option}
                    className={`h-4 w-4 ${option === 'cancelled' ? "text-rose-600" : "text-emerald-600"}`}
                  />
                  {t(`executionStatus.${option}`)}
                </span>
                {active ? <Check className="h-4 w-4 text-viridian" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
