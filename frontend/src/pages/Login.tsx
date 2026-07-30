import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  clearStoredPendingTwoFactorChallenge,
  getStoredPendingTwoFactorChallenge,
} from '@/lib/authStorage';
import { DEFAULT_PUBLIC_CONFIG, fetchPublicConfig } from '@/lib/publicConfig';
import { CookieNoticeModal, ImprintModal, PrivacyNoticeModal, TermsOfUseModal } from '@/components/LegalModals';
import PasswordRequirementsHint from '@/components/PasswordRequirementsHint';
import { getPasswordValidationMessage } from '@/lib/passwordPolicy';
import { useNavigate } from 'react-router-dom';
import { Eye as EyeIcon, EyeOff as EyeOffIcon, Globe2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguagePickerModal from '@/components/LanguagePickerModal';
import { autoT } from '@/i18n/auto';

export default function Login() {
  const { t } = useTranslation(['auth', 'common']);
  const { login, verifyTwoFactor, resendTwoFactor, completeInitialSetup } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirmation, setSetupPasswordConfirmation] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorEmailHint, setTwoFactorEmailHint] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [branding, setBranding] = useState(DEFAULT_PUBLIC_CONFIG);
  const [imprintModalOpen, setImprintModalOpen] = useState(false);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const navigate = useNavigate();
  const setupPasswordValidationMessage = getPasswordValidationMessage(setupPassword);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await fetchPublicConfig();
        if (!cancelled) setBranding(config);
      } catch {
        // If the endpoint is unavailable, keep defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const pendingChallenge = getStoredPendingTwoFactorChallenge();
    const url = new URL(window.location.href);
    const codeFromUrl = url.searchParams.get('twoFactorCode');

    if (pendingChallenge) {
      setChallengeToken(pendingChallenge.challengeToken);
      setTwoFactorEmailHint(pendingChallenge.emailHint);
      if (typeof codeFromUrl === 'string' && /^\d{6}$/.test(codeFromUrl)) {
        setTwoFactorCode(codeFromUrl);
      }
    } else if (typeof codeFromUrl === 'string' && /^\d{6}$/.test(codeFromUrl)) {
      setError(t('login.twoFactorLinkRequiresLogin'));
    }

    if (codeFromUrl) {
      url.searchParams.delete('twoFactorCode');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }
  }, [t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (challengeToken) {
        const res = await verifyTwoFactor(challengeToken, twoFactorCode);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        navigate('/dashboard');
        return;
      }

      const res = await login(email, password);
      if (res.status === 'error') {
        setError(res.error);
        return;
      }
      if (res.status === 'two-factor-required') {
        setChallengeToken(res.challengeToken);
        setTwoFactorEmailHint(res.emailHint);
        setTwoFactorCode('');
        setError(null);
        return;
      }
      navigate('/dashboard');
    } finally {
      setBusy(false);
    }
  }

  async function onInitialSetup(e: FormEvent) {
    e.preventDefault();
    if (setupPasswordValidationMessage) {
      setError(setupPasswordValidationMessage);
      return;
    }
    if (setupPassword !== setupPasswordConfirmation) {
      setError(t('login.passwordsDoNotMatch'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await completeInitialSetup(setupPassword);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigate('/dashboard');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #5B6CFF 0%, #7C8FFF 30%, #9F7AEA 70%, #00CFE8 100%)'}}>
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/50">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold gradient-text leading-tight whitespace-normal break-words">
            {branding.loginTitle}
          </h1>
          <p className="text-gray-500 mt-2 font-medium">{branding.loginSubtitle}</p>
        </div>

        {branding.initialSetupRequired ? (
          <form className="space-y-6" onSubmit={onInitialSetup}>
            <div className="rounded-2xl border border-viridian/20 bg-viridian/5 px-4 py-3 text-sm text-gray-600">
              {t('login.initialSetupInfo')}
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">{t('login.adminPassword')}</label>
              <input
                type="password"
                required
                minLength={12}
                value={setupPassword}
                onChange={(event) => setSetupPassword(event.target.value)}
                className="input-modern w-full"
                placeholder={t('login.minimumTwelve')}
                autoComplete="new-password"
              />
              <PasswordRequirementsHint password={setupPassword} className="mt-2" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">{t('login.repeatPassword')}</label>
              <input
                type="password"
                required
                value={setupPasswordConfirmation}
                onChange={(event) => setSetupPasswordConfirmation(event.target.value)}
                className="input-modern w-full"
                placeholder={t('login.repeatPassword')}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="btn-modern w-full py-3"
              disabled={
                busy ||
                !setupPassword ||
                !setupPasswordConfirmation ||
                setupPassword !== setupPasswordConfirmation ||
                Boolean(setupPasswordValidationMessage)
              }
            >
              {t('login.setupAdmin')}
            </button>
            {error && <div className="chip chip-danger mt-2 w-full justify-center">{error}</div>}
          </form>
        ) : (
        <form className="space-y-6" onSubmit={onSubmit}>
          {!challengeToken ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('login.email')}</label>
                <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="input-modern w-full" placeholder={autoT('ui_9395988394d4')} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('login.password')}</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                    className="input-modern w-full pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 px-2 flex items-center text-gray-400 hover:text-viridian transition-colors"
                    aria-label={showPwd ? t('login.hidePassword') : t('login.showPassword')}
                    title={showPwd ? t('login.hidePassword') : t('login.showPassword')}
                    onClick={() => setShowPwd((v) => !v)}
                  >
                    {showPwd ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {branding.twoFactorEnabled && (
                <div className="rounded-2xl border border-viridian/20 bg-viridian/5 px-4 py-3 text-sm text-gray-600">
                  {t('login.twoFactorInfo')}
                </div>
              )}
              <button type="submit" className="btn-modern w-full py-3" disabled={busy}>
                {t('login.login')}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-viridian/20 bg-viridian/5 px-4 py-3 text-sm text-gray-600">
                {t('login.twoFactorSent', { email: twoFactorEmailHint || t('login.emailAddress') })}
                <div className="mt-2 text-xs text-gray-500">
                  {t('login.twoFactorClipboard')}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('login.securityCode')}</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-modern w-full tracking-[0.35em] text-center text-2xl"
                  placeholder={autoT('ui_c984aed014ae')}
                  autoComplete="one-time-code"
                />
              </div>
              <button type="submit" className="btn-modern w-full py-3" disabled={busy || twoFactorCode.length !== 6}>
                {t('login.verifyCode')}
              </button>
              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  onClick={() => {
                    clearStoredPendingTwoFactorChallenge();
                    setChallengeToken(null);
                    setTwoFactorEmailHint(null);
                    setTwoFactorCode('');
                    setError(null);
                  }}
                >
                  {t('login.back')}
                </button>
                <button
                  type="button"
                  className="text-viridian hover:text-cambridge-blue transition-colors font-medium disabled:opacity-60"
                  disabled={resendBusy}
                  onClick={async () => {
                    if (!challengeToken) return;
                    setResendBusy(true);
                    setError(null);
                    try {
                      const res = await resendTwoFactor(challengeToken);
                      if (!res.ok) {
                        setError(res.error);
                        return;
                      }
                      setChallengeToken(res.challengeToken);
                      setTwoFactorEmailHint(res.emailHint);
                      setTwoFactorCode('');
                    } finally {
                      setResendBusy(false);
                    }
                  }}
                >
                  {resendBusy ? t('login.sendingCode') : t('login.resendCode')}
                </button>
              </div>
            </>
          )}
          {branding.forgotPasswordEnabled ? (
            <div className="text-center text-sm mt-2">
              <a className="text-viridian hover:text-cambridge-blue transition-colors font-medium" href="/reset-password-request">{t('login.forgotPassword')}</a>
            </div>
          ) : (
            <div className="text-center text-sm mt-2 text-gray-500">
              {t('login.forgotPasswordDisabled')}
            </div>
          )}

          {error && <div className="chip chip-danger mt-2 w-full justify-center">{error}</div>}
        </form>
        )}

        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap text-sm text-gray-500">
          <button
            type="button"
            onClick={() => setImprintModalOpen(true)}
            className="font-medium underline underline-offset-2 hover:text-viridian transition-colors"
          >
            {t('common:legal.imprint')}
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setPrivacyModalOpen(true)}
            className="font-medium underline underline-offset-2 hover:text-viridian transition-colors"
          >
            {t('common:legal.privacy')}
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setTermsModalOpen(true)}
            className="font-medium underline underline-offset-2 hover:text-viridian transition-colors"
          >
            {t('common:legal.terms')}
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setCookieModalOpen(true)}
            className="font-medium underline underline-offset-2 hover:text-viridian transition-colors"
          >
            {t('common:legal.cookies')}
          </button>
        </div>

        <div className="relative mt-4 flex items-center justify-center text-sm text-gray-400">
          <button
            type="button"
            onClick={() => setLanguageModalOpen(true)}
            className="absolute left-0 inline-flex items-center justify-center rounded-md bg-viridian/10 p-1.5 text-viridian transition-colors hover:bg-viridian/20 hover:text-cambridge-blue"
            aria-label={t('common:language.label')}
            title={t('common:language.label')}
          >
            <Globe2 className="h-5 w-5" aria-hidden="true" />
          </button>
          <p>
            © {new Date().getFullYear()}{' '}{autoT('ui_65966d2d167a')}{' '}<a href="mailto:hubertoink@outlook.com" className="hover:text-viridian transition-colors">{autoT('ui_dba32cb2a55d')}</a>
          </p>
        </div>
      </div>

      <ImprintModal open={imprintModalOpen} onClose={() => setImprintModalOpen(false)} />
      <PrivacyNoticeModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
      <TermsOfUseModal open={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
      <CookieNoticeModal open={cookieModalOpen} onClose={() => setCookieModalOpen(false)} />
      <LanguagePickerModal open={languageModalOpen} onClose={() => setLanguageModalOpen(false)} />
    </div>
  );
}
