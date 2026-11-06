import { AlertTriangle, Calendar, CalendarClock, CheckCircle2 } from 'lucide-react';
import {
  normalizeActivityExecutionStatus,
} from '@/lib/activityExecutionStatus';
import { useTranslation } from 'react-i18next';

export default function ActivityExecutionStatusBadge({
  status,
  showCompleted = false,
  compact = false,
  className = '',
  combined = false,
  durationLabel,
}: {
  status?: string | null;
  showCompleted?: boolean;
  compact?: boolean;
  className?: string;
  combined?: boolean;
  durationLabel?: string;
}) {
  const { t } = useTranslation('common');
  const normalizedStatus = normalizeActivityExecutionStatus(status);
  if (normalizedStatus === 'completed' && !showCompleted) return null;

  const isCancelled = normalizedStatus === 'cancelled';
  const Icon = normalizedStatus === 'planned' ? (combined ? Calendar : CalendarClock) : isCancelled ? AlertTriangle : CheckCircle2;
  const classes = `activity-status-badge activity-status-badge--${normalizedStatus}`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${classes} ${
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${combined ? 'activity-status-badge--combined' : ''} ${className}`.trim()}
    >
      <Icon aria-hidden="true" className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {t(`executionStatus.${normalizedStatus}`)}
      {combined && durationLabel ? <span className="activity-status-badge__duration">{durationLabel}</span> : null}
    </span>
  );
}
