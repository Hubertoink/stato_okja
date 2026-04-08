import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { acceptInviteApi } from '@/lib/orgs';
import { setAuthToken } from '@/lib/api';
import { storeAuthToken } from '@/lib/authStorage';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              placeholder="Mind. 6 Zeichen, Zahl & Sonderzeichen"
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            className="w-full bg-viridian text-white py-2 rounded disabled:opacity-60"
            disabled={!token || !password || busy}
            onClick={async () => {
              try {
                setBusy(true);
                // Clientseitiger Schnellcheck, Server validiert verbindlich
                const strong = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/.test(password);
                if (!strong) {
                  setError('Mind. 6 Zeichen, eine Zahl und ein Sonderzeichen');
                  setBusy(false);
                  return;
                }
                const res = await acceptInviteApi(token, password);
                if (res?.access_token) {
                  storeAuthToken(res.access_token);
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
    </div>
  );
}
