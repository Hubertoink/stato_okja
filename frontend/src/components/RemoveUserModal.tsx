import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { Button } from './ui/Button';
import { deleteUserAccountApi, removeUserMembershipApi, type UserDto } from '@/lib/users';

export default function RemoveUserModal({ user, deleteAccount, onClose, onRemoved }: {
  user: UserDto | null;
  deleteAccount: boolean;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { t } = useTranslation('common');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function remove() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (deleteAccount) await deleteUserAccountApi(user.id);
      else {
        if (!user.orgId) throw new Error(t('accountRemoval.missingOrganization'));
        await removeUserMembershipApi(user.id, user.orgId);
      }
      onRemoved();
    } catch (err) {
      const response = (err as { response?: { data?: { message?: string | string[] } } }).response;
      const message = response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : message || (err instanceof Error ? err.message : t('accountRemoval.error')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} maxWidth="sm"
      title={t(deleteAccount ? 'accountRemoval.deleteTitle' : 'accountRemoval.revokeTitle')}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-primary)]">
          {t(deleteAccount ? 'accountRemoval.deleteQuestion' : 'accountRemoval.revokeQuestion', { name: user.name || user.email, organization: user.org?.name || '' })}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          {t(deleteAccount ? 'accountRemoval.deleteConsequences' : 'accountRemoval.revokeConsequences')}
        </p>
        {error && <p role="alert" className="text-sm text-[var(--status-danger-text)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('actions.cancel')}</Button>
          <Button variant="danger" disabled={busy} onClick={() => void remove()}>
            {t(deleteAccount ? 'accountRemoval.deleteTitle' : 'accountRemoval.revokeTitle')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
