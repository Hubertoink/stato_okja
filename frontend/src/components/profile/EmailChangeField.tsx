import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/Button';
import { FieldError, FieldHint, FieldLabel, Input } from '@/components/ui/Field';
import { api } from '@/lib/api';

type Status = {
  unavailable: 'managed' | 'smtp' | 'password' | null;
  pending: { id: string; email: string; expiresAt: string } | null;
};

export default function EmailChangeField({ email }: { email: string }) {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<Status>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const expiresAt = status?.pending?.expiresAt;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await api.get<Status>('/auth/email-change', { signal: controller.signal });
        if (!controller.signal.aborted) { setStatus(response.data); setLoadFailed(false); }
      } catch {
        if (!controller.signal.aborted) setLoadFailed(true);
      }
    }
    void load();
    window.addEventListener('focus', load);
    const timer = expiresAt ? window.setTimeout(load, Math.max(0, Date.parse(expiresAt) - Date.now()) + 100) : undefined;
    return () => { controller.abort(); window.removeEventListener('focus', load); window.clearTimeout(timer); };
  }, [email, attempt, expiresAt]);

  function close() {
    setOpen(false); setPassword(''); setAddress(''); setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await api.post<Status>('/auth/email-change', { email: address.trim(), password });
      setStatus(response.data);
      close();
    } catch (cause) {
      const message = isAxiosError(cause) && cause.response?.data?.message;
      setError(typeof message === 'string' ? message : t('emailChange.failed'));
    } finally { setBusy(false); }
  }

  async function cancel() {
    if (!status?.pending) return;
    setBusy(true); setError('');
    try {
      const response = await api.delete<Status>(`/auth/email-change/${status.pending.id}`);
      setStatus(response.data);
    } catch { setError(t('emailChange.failed')); }
    finally { setBusy(false); }
  }

  return <div>
    <FieldLabel htmlFor="profile-email">{t('emailChange.email')}</FieldLabel>
    <div className="flex flex-wrap gap-2">
      <Input id="profile-email" type="email" readOnly value={email} className="min-w-0 flex-1" />
      {status && !status.unavailable && <Button variant="secondary" onClick={() => { setError(''); setOpen(true); }}>
        {t('emailChange.title')}
      </Button>}
    </div>
    {status?.unavailable && <FieldHint>{t(`emailChange.${status.unavailable}`)}</FieldHint>}
    {loadFailed && <Button size="sm" variant="ghost" onClick={() => setAttempt(n => n + 1)}>{t('emailChange.retry')}</Button>}
    {status?.pending && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" role="status">
      {t('emailChange.pending', { email: status.pending.email })}
      <Button size="sm" variant="secondary" disabled={busy} onClick={cancel}>{t('emailChange.cancel')}</Button>
    </div>}
    {!open && error && <FieldError>{error}</FieldError>}
    <Modal open={open} onClose={() => { if (!busy) close(); }} title={t('emailChange.title')} maxWidth="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm">{t('emailChange.help')}</p>
        <div><FieldLabel htmlFor="change-email">{t('emailChange.new')}</FieldLabel>
          <Input id="change-email" type="email" autoComplete="email" required maxLength={200} value={address} onChange={e => setAddress(e.target.value)} /></div>
        <div><FieldLabel htmlFor="change-email-password">{t('emailChange.currentPassword')}</FieldLabel>
          <Input id="change-email-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={busy || !password || !address.trim() || address.trim().toLowerCase() === email.toLowerCase()}>{t('emailChange.send')}</Button>
      </form>
    </Modal>
  </div>;
}
