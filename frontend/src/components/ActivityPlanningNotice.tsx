import { useTranslation } from 'react-i18next';
import { activityToday, isFutureActivityDate, isPlannedActivity } from '@/lib/activityExecutionStatus';
import { Button } from './ui/Button';

export default function ActivityPlanningNotice({ status, date, hasCounts, onClearCounts, onDocument }: {
  status?: string;
  date?: string;
  hasCounts: boolean;
  onClearCounts: () => void;
  onDocument: () => void;
}) {
  const { t } = useTranslation('common');
  const planned = isPlannedActivity(status);
  const future = isFutureActivityDate(date);
  if (!planned && !future) return null;
  return (
    <div className="activity-planning-notice" role="status">
      <strong>{planned && date && date < activityToday() ? t('executionStatus.documentationOpen') : t(`executionStatus.${planned ? 'planned' : 'cancelled'}`)}</strong>
      <p>{t('executionStatus.planningHint')}</p>
      {hasCounts && <>
        <p>{t('executionStatus.clearCountsHint')}</p>
        <Button variant="secondary" size="sm" onClick={onClearCounts}>{t('executionStatus.clearCounts')}</Button>
      </>}
      {planned && !future && date && (
        <Button variant="secondary" size="sm" onClick={onDocument}>{t('executionStatus.document')}</Button>
      )}
    </div>
  );
}
