import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TermsOfUseModal } from '@/components/LegalModals';
import { useLegalContent } from '@/lib/legalContent';
import { useTranslation } from 'react-i18next';

export default function TermsAcceptanceGate() {
  const { t } = useTranslation('common');
  const { logout, refresh } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: legalContent, isError: legalContentError, isFetching: legalContentFetching } = useLegalContent();

  const accept = async () => {
    if (!accepted) return;
    try {
      setBusy(true);
      setError(null);
      await api.post('/auth/accept-terms');
      await refresh();
    } catch {
      setError(t('termsGate.saveError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-mint-cream px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-gray-800">{t('termsGate.title')}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {t('termsGate.intro', { version: legalContent?.termsVersion || t('termsGate.loadingVersion') })}
        </p>
        <button type="button" onClick={() => setTermsOpen(true)} className="mt-4 text-sm font-semibold text-viridian underline">
          {t('termsGate.show')}
        </button>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>{t('termsGate.acceptLabel')}</span>
        </label>
        {legalContentError && <p className="mt-3 text-sm text-red-600">{t('termsGate.loadError')}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button type="button" disabled={!accepted || busy || legalContentFetching || legalContentError} onClick={accept} className="dashboard-accent-solid-button mt-5 flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:opacity-60">
          {busy ? t('termsGate.saving') : t('termsGate.accept')}
        </button>
        <button type="button" onClick={logout} className="mx-auto mt-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <LogOut className="h-4 w-4" />{t('userMenu.logout')}
        </button>
      </div>
      <TermsOfUseModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  );
}
