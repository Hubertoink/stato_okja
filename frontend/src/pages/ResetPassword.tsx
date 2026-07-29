import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword, validateResetToken } from '@/lib/password';
import { isStrongPassword, PASSWORD_REQUIREMENTS_SHORT } from '@/lib/passwordPolicy';
import PasswordRequirementsHint from '@/components/PasswordRequirementsHint';
import { useTranslation } from 'react-i18next';

export default function ResetPassword() {
  const { t } = useTranslation('auth');
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const token = sp.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');

  useEffect(() => {
    let active = true;

    if (!token) {
      setTokenStatus('invalid');
      return () => { active = false; };
    }

    setTokenStatus('checking');
    void validateResetToken(token)
      .then(() => {
        if (active) setTokenStatus('valid');
      })
      .catch(() => {
        if (active) setTokenStatus('invalid');
      });

    return () => { active = false; };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError(t('resetPassword.invalidLink'));
      return;
    }
    if (!isStrongPassword(password)) {
      setError(PASSWORD_REQUIREMENTS_SHORT);
      return;
    }
    if (password !== confirm) {
      setError(t('resetPassword.passwordsDoNotMatch'));
      return;
    }
    try {
      await resetPassword(token, password);
      setOk(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (e: unknown) {
      setError(t('resetPassword.failed'));
    }
  }

  return (
    <div className="min-h-screen bg-mint-cream flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-viridian mb-4">{t('resetPassword.title')}</h2>
        {tokenStatus === 'checking' ? (
          <p className="text-sm text-gray-700" aria-live="polite">{t('resetPassword.checking')}</p>
        ) : tokenStatus === 'invalid' ? (
          <div className="space-y-4" aria-live="polite">
            <p className="text-sm text-red-700">
              {t('resetPassword.invalid')}
            </p>
            <a href="/reset-password-request" className="text-sm font-medium text-viridian hover:underline">
              {t('resetPassword.requestNew')}
            </a>
            <p className="text-xs text-gray-600">
              <a href="/" className="text-viridian hover:underline">{t('resetPassword.backToLogin')}</a>
            </p>
          </div>
        ) : ok ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">{t('resetPassword.success')}</p>
            <p className="text-xs text-gray-600">
              {t('resetPassword.fallback')}{' '}
              <a href="/" className="text-viridian hover:underline">
                {t('resetPassword.login')}
              </a>
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="new-pass">
                {t('resetPassword.newPassword')}
              </label>
              <input
                id="new-pass"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-4 py-2"
                placeholder={PASSWORD_REQUIREMENTS_SHORT}
                title={t('resetPassword.newPassword')}
              />
              <PasswordRequirementsHint password={password} className="mt-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="new-pass-confirm">
                {t('resetPassword.confirmation')}
              </label>
              <input
                id="new-pass-confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded px-4 py-2"
                placeholder={t('resetPassword.repeat')}
                title={t('resetPassword.confirmPassword')}
              />
            </div>
            <button type="submit" className="w-full bg-viridian text-white py-2 rounded">
              {t('resetPassword.save')}
            </button>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <p className="text-xs text-gray-600">
              {t('resetPassword.cancel')}{' '}
              <a href="/" className="text-viridian hover:underline">
                {t('resetPassword.backToLogin')}
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
