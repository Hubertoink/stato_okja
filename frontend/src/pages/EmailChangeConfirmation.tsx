import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/Field';
import { api } from '@/lib/api';

type Result = 'waiting' | 'completed' | 'cancelled';

export default function EmailChangeConfirmation() {
  const { hash } = useLocation();
  return <Confirmation key={hash} hash={hash} />;
}

function Confirmation({ hash }: { hash: string }) {
  const { t } = useTranslation('common');
  const params = new URLSearchParams(hash.slice(1));
  const action = params.get('action');
  const token = params.get('token');
  const requestId = params.get('requestId');
  const valid = (action === 'approve' || action === 'verify' || action === 'cancel') && token && requestId;
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function respond() {
    setBusy(true); setError('');
    try {
      const response = await api.post<{ state: Result }>('/auth/email-change/respond', { action, requestId, token });
      setResult(response.data.state);
    } catch (cause) {
      setError(t(isAxiosError(cause) && cause.response?.status === 400 ? 'emailChange.invalid' : 'emailChange.failed'));
    } finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center p-4">
    <section className="modern-card w-full max-w-md space-y-4 p-6">
      <h1 className="text-xl font-semibold">{t('emailChange.title')}</h1>
      {result ? <p role="status">{t(`emailChange.${result}`)}</p> : valid ? <>
        <p>{t('emailChange.confirmHelp')}</p>
        <Button disabled={busy} onClick={respond}>{t(`emailChange.${action}`)}</Button>
      </> : <FieldError>{t('emailChange.invalid')}</FieldError>}
      {error && <FieldError>{error}</FieldError>}
      <a href="/" className="block text-sm text-viridian underline">{t('emailChange.toLogin')}</a>
    </section>
  </main>;
}
