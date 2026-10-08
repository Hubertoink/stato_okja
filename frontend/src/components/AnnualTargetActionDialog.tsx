import { useId, useState } from 'react';
import Modal from '@/components/Modal';
import { Button, CloseButton } from '@/components/ui/Button';
import { EditorActions } from '@/components/ui/EditorFrame';
import { FieldLabel, Textarea } from '@/components/ui/Field';
import { Tooltip } from '@/components/ui/Tooltip';
import { Target } from 'lucide-react';
import {
  targetError,
  targetPeriodLabel,
  targetRequirement,
  targetScopeLabel,
  useTargetMutation,
  type AnnualTarget,
  type TargetMutation,
} from '@/lib/annualTargets';

export type TargetAction = 'activate' | 'close' | 'reopen' | 'copy';
const titles = {
  activate: 'Ziel festlegen',
  close: 'Ziel abschließen',
  reopen: 'Ziel wieder öffnen',
  copy: 'Entwurf fürs Folgejahr übernehmen',
};
const submitLabels = {
  activate: 'Ziel festlegen',
  close: 'Abschluss speichern',
  reopen: 'Wieder öffnen',
  copy: 'Als Entwurf übernehmen',
};

export default function AnnualTargetActionDialog({
  target,
  action,
  onClose,
  onCopied,
}: {
  target: AnnualTarget;
  action: TargetAction;
  onClose: () => void;
  onCopied: (year: number) => void;
}) {
  const mutation = useTargetMutation();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const command: TargetMutation =
      action === 'copy'
        ? { action, id: target.id, year: target.year + 1 }
        : { action, id: target.id, version: target.version, reason };
    mutation.mutate(command, {
      onSuccess: () => {
        if (action === 'copy') onCopied(target.year + 1);
        onClose();
      },
    });
  };
  return (
    <Modal
      open
      title={titles[action]}
      maxWidth="2xl"
      variant="form"
      showCloseButton={false}
      headerActions={
        <Tooltip text="Schließen">
          <CloseButton aria-label="Schließen" disabled={mutation.isPending} onClick={onClose} />
        </Tooltip>
      }
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <div className="space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="annual-target-action-summary">
            <Target aria-hidden="true" />
            <div>
              <h3>{target.title}</h3>
              <p className="annual-target-action-requirement">{targetRequirement(target)}</p>
              <p>
                {targetScopeLabel(target)} · {targetPeriodLabel(target)}
              </p>
            </div>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            {action === 'close'
              ? 'Die Werte des Zielzeitraums werden mit deiner Einordnung als Abschlussstand gespeichert.'
              : action === 'reopen'
                ? 'Der bisherige Abschluss bleibt im Änderungsverlauf erhalten. Nach Korrekturen kannst du das Ziel erneut abschließen.'
                : action === 'copy'
                  ? `Das Ziel wird für ${target.year + 1} mit entsprechend verschobenem Zeitraum als neuer Entwurf angelegt. Du kannst es anschließend bearbeiten und festlegen.`
                  : 'Das Ziel wird für die Einrichtung verbindlich festgelegt. Spätere Änderungen benötigen eine Begründung.'}
          </p>
          {action !== 'copy' && (
            <div className="space-y-2">
              <FieldLabel htmlFor={reasonId}>
                {action === 'close'
                  ? 'Fachliche Einordnung'
                  : action === 'activate'
                    ? 'Zielvereinbarung (optional)'
                    : 'Begründung'}
              </FieldLabel>
              <Textarea
                id={reasonId}
                aria-describedby={action === 'activate' ? `${reasonId}-help` : undefined}
                rows={4}
                required={action !== 'activate'}
                value={reason}
                maxLength={4000}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  action === 'activate' ? 'Was wollen wir mit diesem Ziel erreichen?' : undefined
                }
              />
              {action === 'activate' && (
                <p id={`${reasonId}-help`} className="text-xs text-[var(--text-muted)]">
                  Die Zielvereinbarung erscheint auf der Karte und in der Detailansicht.
                </p>
              )}
            </div>
          )}
          {mutation.isError && (
            <p role="alert" className="text-sm text-[var(--status-danger-text)]">
              {targetError(mutation.error)}
            </p>
          )}
        </div>
        <EditorActions
          secondary={
            <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
              Abbrechen
            </Button>
          }
          primary={
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Wird gespeichert …' : submitLabels[action]}
            </Button>
          }
        />
      </form>
    </Modal>
  );
}
