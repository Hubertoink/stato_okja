import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { DEFAULT_PUBLIC_CONFIG, fetchPublicConfig } from '@/lib/publicConfig';
import { CookieNoticeModal, ImprintModal } from '@/components/LegalModals';
import { useNavigate } from 'react-router-dom';
import { Eye as EyeIcon, EyeOff as EyeOffIcon } from 'lucide-react';

export default function Login() {
  const { login, verifyTwoFactor, resendTwoFactor } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin');
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
  const navigate = useNavigate();

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

        <form className="space-y-6" onSubmit={onSubmit}>
          {!challengeToken ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">E-Mail</label>
                <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="input-modern w-full" placeholder="email@example.com" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Passwort</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
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
                    aria-label={showPwd ? 'Passwort ausblenden' : 'Passwort anzeigen'}
                    title={showPwd ? 'Passwort ausblenden' : 'Passwort anzeigen'}
                    onClick={() => setShowPwd((v) => !v)}
                  >
                    {showPwd ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {branding.twoFactorEnabled && (
                <div className="rounded-2xl border border-viridian/20 bg-viridian/5 px-4 py-3 text-sm text-gray-600">
                  Nach dem Passwortversand wird ein zusätzlicher Sicherheitscode per E-Mail abgefragt.
                </div>
              )}
              <button type="submit" className="btn-modern w-full py-3" disabled={busy}>
                Anmelden
              </button>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-viridian/20 bg-viridian/5 px-4 py-3 text-sm text-gray-600">
                Wir haben einen 6-stelligen Sicherheitscode an <span className="font-semibold text-gray-800">{twoFactorEmailHint || 'deine E-Mail-Adresse'}</span> gesendet.
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sicherheitscode</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-modern w-full tracking-[0.35em] text-center text-2xl"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>
              <button type="submit" className="btn-modern w-full py-3" disabled={busy || twoFactorCode.length !== 6}>
                Code prüfen
              </button>
              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  onClick={() => {
                    setChallengeToken(null);
                    setTwoFactorCode('');
                    setError(null);
                  }}
                >
                  Zurück
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
                  {resendBusy ? 'Code wird gesendet...' : 'Code erneut senden'}
                </button>
              </div>
            </>
          )}
          {branding.forgotPasswordEnabled ? (
            <div className="text-center text-sm mt-2">
              <a className="text-viridian hover:text-cambridge-blue transition-colors font-medium" href="/reset-password-request">Passwort vergessen?</a>
            </div>
          ) : (
            <div className="text-center text-sm mt-2 text-gray-500">
              Passwort vergessen? Bitte an den Superadmin wenden.
            </div>
          )}

          {error && <div className="chip chip-danger mt-2 w-full justify-center">{error}</div>}
        </form>

        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap text-sm text-gray-500">
          <button
            type="button"
            onClick={() => setImprintModalOpen(true)}
            className="font-medium underline underline-offset-2 hover:text-viridian transition-colors"
          >
            Impressum
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setCookieModalOpen(true)}
            className="font-medium underline underline-offset-2 hover:text-viridian transition-colors"
          >
            Cookies
          </button>
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          © {new Date().getFullYear()} StatO - <a href="mailto:hubertoink@outlook.com" className="hover:text-viridian transition-colors">OKJA Team</a>
        </p>
      </div>

      <ImprintModal open={imprintModalOpen} onClose={() => setImprintModalOpen(false)} />
      <CookieNoticeModal open={cookieModalOpen} onClose={() => setCookieModalOpen(false)} />
    </div>
  );
}
