import { useState } from 'react';
import Modal from '@/components/Modal';
import { deleteOrgApi } from '@/lib/orgs';
import { useToast } from '@/components/Toast';
import { autoT } from '@/i18n/auto';

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
      showToast(autoT('ui_e46562d380c7', { value0: orgName }), { type: 'success' });
      onClose();
      onDeleted();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || autoT('ui_0b03e19f666a');
      setError(String(msg));
      showToast(String(msg), { type: 'error' });
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={() => { if (!busy) { onClose(); setError(null); } }} title={autoT('ui_3974dc710086')} maxWidth="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">{autoT('ui_2db74aafe6f1')}{orgName ? <strong className="mx-1">„{orgName}”</strong> : autoT('ui_b0ce53d37758')}{autoT('ui_29e0625deef2')}</p>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800">{autoT('ui_987e0ccc5050')}<strong>{autoT('ui_7535160fba8a')}</strong>{autoT('ui_36156e721c4c')}</div>
        {error && <div className="text-xs text-red-600 bg-red-50 border border-red-300 rounded p-2">{error}</div>}
        <div className="flex items-center justify-end gap-2">
          <button className="px-3 py-1.5 rounded bg-gray-200 text-gray-700" disabled={busy} onClick={()=> onClose()}>{autoT('ui_07af7cb30fca')}</button>
          <button
            className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-60"
            disabled={busy || !orgId}
            onClick={handleDelete}
          >{busy ? autoT('ui_2b5a5dd9afbb') : autoT('ui_65cebdf22580')}</button>
        </div>
      </div>
    </Modal>
  );
}
