import type { LogbookEntryStatus } from '@/lib/logbook';
import { logbookStatusLabels } from '@/lib/logbookLabels';
import { Badge } from '@/components/ui/Badge';

const statusVariant = {
  open: 'info',
  discussed: 'success',
  follow_up: 'warning',
  archived: 'neutral',
} as const;

export default function LogbookStatusBadge({
  status,
  className,
}: {
  status: LogbookEntryStatus;
  className?: string;
}) {
  return (
    <Badge className={className} variant={statusVariant[status]}>
      {logbookStatusLabels[status]}
    </Badge>
  );
}
