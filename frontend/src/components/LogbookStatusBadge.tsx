import type { LogbookEntryStatus } from '@/lib/logbook';
import { Badge } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('common');
  return (
    <Badge className={className} variant={statusVariant[status]}>
      {t(`logbookStatus.${status}`)}
    </Badge>
  );
}
