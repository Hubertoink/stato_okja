import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/Button';
import { autoT } from '@/i18n/auto';
import { contributionError } from '@/lib/contributors';

/** One removal flow for people master data, including pending/error states. */
export default function EntityRemovalDialog({ title, name, archived, warning, loadUsage, onArchive, onDelete, onClose }: {
  title: string;
  name: string;
  archived: boolean;
  warning: string;
  loadUsage: () => Promise<number>;
  onArchive: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    setCount(null);
    setUsageError(false);
    void loadUsage().then(value => { if (active) setCount(value); }, () => { if (active) setUsageError(true); });
    return () => { active = false; };
  }, [loadUsage]);
  async function perform(action: () => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    setError('');
    try { await action(); onClose(); }
    catch (err) { setError(contributionError(err)); setPending(false); }
  }
  return <Modal open title={title} onClose={() => { if (!pending) onClose(); }}>
    <div className="space-y-3 text-sm text-[var(--text-secondary)]" aria-busy={pending}>
      <p className="font-semibold text-[var(--text-primary)]">{name}</p>
      <p>{warning}</p>
      {usageError ? <p role="alert">Betroffene Aktivitäten konnten nicht geprüft werden. Bitte schließe den Dialog und versuche es erneut.</p>
        : count === null ? <p role="status">{autoT('ui_7a67a2dd16a7')}</p>
          : <p>{autoT('ui_8ae03f3803dd')} <strong>{count}</strong></p>}
      {!archived && <p>Statt zu löschen kannst du den Eintrag archivieren. Er erscheint dann nicht mehr in Auswahlfeldern, bleibt aber für bestehende Daten erhalten.</p>}
      {error && <p role="alert" className="text-[var(--status-danger-text)]">{error}</p>}
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
      <Button variant="secondary" disabled={pending} onClick={onClose}>{autoT('ui_07af7cb30fca')}</Button>
      {!archived && <Button disabled={pending} onClick={() => void perform(onArchive)}>{autoT('ui_49471caa9c1f')}</Button>}
      <Button variant="danger" disabled={pending || count === null || usageError} onClick={() => void perform(onDelete)}>{autoT('ui_9df6718de96c')}</Button>
    </div>
  </Modal>;
}
