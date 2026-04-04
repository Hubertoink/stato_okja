import { FormEvent, useEffect, useState } from 'react';
import { DEFAULT_PUBLIC_CONFIG, fetchPublicConfig } from '@/lib/publicConfig';
import { requestPasswordReset } from '@/lib/password';

export default function ResetRequest() {
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
        <h2 className="text-2xl font-bold text-viridian mb-4">Passwort zurücksetzen</h2>
        {!config.forgotPasswordEnabled ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Der Passwort-Reset per E-Mail ist in dieser Instanz deaktiviert.
            </p>
            <p className="text-sm text-gray-700">
              Bitte wende dich an den Superadmin, damit ein temporäres Passwort gesetzt werden kann.
            </p>
            <p className="text-xs text-gray-600">Zurück zum <a href="/" className="text-viridian hover:underline">Login</a></p>
          </div>
        ) : sent ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">Wenn die E-Mail existiert, haben wir dir einen Link zum Zurücksetzen geschickt.</p>
            <p className="text-xs text-gray-600">Zurück zum <a href="/" className="text-viridian hover:underline">Login</a></p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium mb-2">E-Mail</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 rounded px-4 py-2" placeholder="email@example.com" />
            </div>
            <button type="submit" className="w-full bg-viridian text-white py-2 rounded">Link anfordern</button>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <p className="text-xs text-gray-600">Abbrechen? <a href="/" className="text-viridian hover:underline">Login öffnen</a></p>
          </form>
        )}
      </div>
    </div>
  );
}
