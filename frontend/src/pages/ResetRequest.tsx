import { FormEvent, useEffect, useState } from 'react';
import { DEFAULT_PUBLIC_CONFIG, fetchPublicConfig } from '@/lib/publicConfig';
import { requestPasswordReset } from '@/lib/password';
import { useTranslation } from 'react-i18next';
import { autoT } from '@/i18n/auto';

export default function ResetRequest() {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState(DEFAULT_PUBLIC_CONFIG);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextConfig = await fetchPublicConfig();
        if (!cancelled) setConfig(nextConfig);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e: unknown) {
      setSent(true); // do not leak specifics
    }
  }

  return (
    <div className="min-h-screen bg-mint-cream flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-viridian mb-4">{t('resetRequest.title')}</h2>
        {!config.forgotPasswordEnabled ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t('resetRequest.disabled')}
            </p>
            <p className="text-sm text-gray-700">
              {t('resetRequest.contactAdmin')}
            </p>
            <p className="text-xs text-gray-600">{t('resetRequest.backTo')} <a href="/" className="text-viridian hover:underline">{t('resetRequest.login')}</a></p>
          </div>
        ) : sent ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">{t('resetRequest.sent')}</p>
            <p className="text-xs text-gray-600">{t('resetRequest.backTo')} <a href="/" className="text-viridian hover:underline">{t('resetRequest.login')}</a></p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium mb-2">{t('login.email')}</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 rounded px-4 py-2" placeholder={autoT('ui_9395988394d4')} />
            </div>
            <button type="submit" className="w-full bg-viridian text-white py-2 rounded">{t('resetRequest.request')}</button>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <p className="text-xs text-gray-600">{t('resetRequest.cancel')} <a href="/" className="text-viridian hover:underline">{t('resetRequest.openLogin')}</a></p>
          </form>
        )}
      </div>
    </div>
  );
}
