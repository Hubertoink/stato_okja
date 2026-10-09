import { Check, Copy, Flag, Pencil, RotateCcw } from 'lucide-react';
import { CloseButton, IconButton } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { targetCanClose, targetPeriod, type AnnualTarget } from '@/lib/annualTargets';
import type { TargetAction } from './AnnualTargetActionDialog';

export default function AnnualTargetHeaderActions({
  target,
  isAdmin,
  onEdit,
  onAction,
  onClose,
}: {
  target?: AnnualTarget;
  isAdmin: boolean;
  onEdit: (target: AnnualTarget) => void;
  onAction: (action: TargetAction) => void;
  onClose: () => void;
}) {
  const canClose = target ? targetCanClose(target) : false;
  return (
    <div className="annual-target-header-actions">
      {isAdmin && target && (
        <>
          {target.status !== 'closed' && (
            <Tooltip text="Bearbeiten">
              <IconButton
                variant="secondary"
                aria-label="Bearbeiten"
                onClick={() => onEdit(target)}
              >
                <Pencil aria-hidden="true" />
              </IconButton>
            </Tooltip>
          )}
          {target.status === 'draft' && (
            <Tooltip text="Ziel festlegen">
              <IconButton aria-label="Ziel festlegen" onClick={() => onAction('activate')}>
                <Check aria-hidden="true" />
              </IconButton>
            </Tooltip>
          )}
          {target.status === 'active' && (
            <Tooltip
              disabled={!canClose}
              text={
                canClose
                  ? 'Ziel abschließen'
                  : `Abschluss nach dem ${targetPeriod(target).to.split('-').reverse().join('.')} möglich`
              }
            >
              <IconButton
                variant={canClose ? 'primary' : 'secondary'}
                aria-label={target.dateFrom ? 'Ziel abschließen' : 'Jahr abschließen'}
                disabled={!canClose}
                onClick={() => onAction('close')}
              >
                <Flag aria-hidden="true" />
              </IconButton>
            </Tooltip>
          )}
          {target.status === 'closed' && (
            <Tooltip text="Wieder öffnen">
              <IconButton
                variant="secondary"
                aria-label="Wieder öffnen"
                onClick={() => onAction('reopen')}
              >
                <RotateCcw aria-hidden="true" />
              </IconButton>
            </Tooltip>
          )}
          {!target.scope.activityId && Number(targetPeriod(target).to.slice(0, 4)) < 2200 && (
            <Tooltip text={`Für ${target.year + 1} übernehmen`}>
              <IconButton
                variant="secondary"
                aria-label={`Für ${target.year + 1} übernehmen`}
                onClick={() => onAction('copy')}
              >
                <Copy aria-hidden="true" />
              </IconButton>
            </Tooltip>
          )}
        </>
      )}
      <Tooltip text="Schließen">
        <CloseButton aria-label="Schließen" onClick={onClose} />
      </Tooltip>
    </div>
  );
}
