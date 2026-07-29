import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  normalizeActivityExecutionStatus,
} from '@/lib/activityExecutionStatus';
import { useTranslation } from 'react-i18next';

export default function ActivityExecutionStatusBadge({
  status,
  showCompleted = false,
  compact = false,
  className = '',
}: {
  status?: string | null;
  showCompleted?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation('common');
  const normalizedStatus = normalizeActivityExecutionStatus(status);
  if (normalizedStatus === 'completed' && !showCompleted) return null;

  const isCancelled = normalizedStatus === 'cancelled';
  const Icon = isCancelled ? AlertTriangle : CheckCircle2;
  const classes = isCancelled
    ? 'activity-status-badge activity-status-badge--cancelled'
    : 'activity-status-badge activity-status-badge--completed';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${classes} ${
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${className}`.trim()}
    >
      <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {t(`executionStatus.${normalizedStatus}`)}
    </span>
  );
}
