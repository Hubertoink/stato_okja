import { useState } from 'react';
import Modal from '@/components/Modal';
import { deleteOrgApi } from '@/lib/orgs';
import { useToast } from '@/components/Toast';

interface DeleteOrgModalProps {
  orgId: string | null;
  orgName: string | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void; // refresh callback
}

export default function DeleteOrgModal({ orgId, orgName, open, onClose, onDeleted }: DeleteOrgModalProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!orgId) return;
    setBusy(true); setError(null);
    try {
      await deleteOrgApi(orgId);
      showToast(`Organisation „${orgName}” gelöscht.`, { type: 'success' });
      onClose();
      onDeleted();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Löschen fehlgeschlagen';
      setError(String(msg));
      showToast(String(msg), { type: 'error' });
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={() => { if (!busy) { onClose(); setError(null); } }} title="Organisation löschen" maxWidth="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          Bist du sicher, dass du die Organisation
          {orgName ? <strong className="mx-1">„{orgName}”</strong> : ' (unbekannt)'} löschen möchtest?
        </p>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          Diese Aktion kann <strong>nicht</strong> rückgängig gemacht werden. Falls Unterorganisationen existieren, wird das Löschen blockiert.
        </div>
        {error && <div className="text-xs text-red-600 bg-red-50 border border-red-300 rounded p-2">{error}</div>}
        <div className="flex items-center justify-end gap-2">
          <button className="px-3 py-1.5 rounded bg-gray-200 text-gray-700" disabled={busy} onClick={()=> onClose()}>Abbrechen</button>
          <button
            className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-60"
            disabled={busy || !orgId}
            onClick={handleDelete}
          >{busy ? 'Lösche…' : 'Ja, löschen'}</button>
        </div>
      </div>
    </Modal>
  );
}
