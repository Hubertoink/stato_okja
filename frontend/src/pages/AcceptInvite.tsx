import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { acceptInviteApi } from '@/lib/orgs';
import { setAuthToken } from '@/lib/api';
import { storeAuthToken, storeRefreshCsrfToken } from '@/lib/authStorage';
import { isStrongPassword, PASSWORD_REQUIREMENTS_SHORT } from '@/lib/passwordPolicy';
import PasswordRequirementsHint from '@/components/PasswordRequirementsHint';
import { TermsOfUseModal } from '@/components/LegalModals';
import { useLegalContent } from '@/lib/legalContent';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const { isError: legalContentError, isFetching: legalContentFetching } = useLegalContent();

  useEffect(() => {
    setError(null);
  }, [token, password]);

  return (
    <div className="min-h-screen bg-mint-cream flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h1 className="text-xl font-semibold text-viridian mb-4">Einladung annehmen</h1>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium" htmlFor="invite-token">
              Einladungs-Token
            </label>
            <input
              id="invite-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Token aus E-Mail-Link"
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="invite-pass">
              Neues Passwort
            </label>
            <input
              id="invite-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder={PASSWORD_REQUIREMENTS_SHORT}
            />
            <PasswordRequirementsHint password={password} className="mt-2" />
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4"
              aria-label="Nutzungsbedingungen akzeptieren"
            />
            <span>
              Ich habe die{' '}
              <button type="button" onClick={() => setTermsOpen(true)} className="font-semibold text-viridian underline">Nutzungsbedingungen</button>{' '}
              gelesen und stimme ihnen zu.
            </span>
          </div>
          {legalContentError && <div className="text-red-600 text-sm">Die Nutzungsbedingungen konnten nicht geladen werden. Bitte lade die Seite erneut.</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            className="w-full bg-viridian text-white py-2 rounded disabled:opacity-60"
            disabled={!token || !password || !termsAccepted || busy || legalContentFetching || legalContentError}
            onClick={async () => {
              try {
                setBusy(true);
                // Clientseitiger Schnellcheck, Server validiert verbindlich
                if (!isStrongPassword(password)) {
                  setError(PASSWORD_REQUIREMENTS_SHORT);
                  setBusy(false);
                  return;
                }
                const res = await acceptInviteApi(token, password, termsAccepted);
                if (res?.access_token) {
                  storeAuthToken(res.access_token);
                  storeRefreshCsrfToken(res.refresh_csrf_token);
                  setAuthToken(res.access_token);
                }
                navigate('/');
              } catch (e: unknown) {
                const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data
                  ?.message;
                setError(String(msg || 'Aktivierung fehlgeschlagen'));
              } finally {
                setBusy(false);
              }
            }}
          >
            Einladung aktivieren
          </button>
        </div>
      </div>
      <TermsOfUseModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  );
}
