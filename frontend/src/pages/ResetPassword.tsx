import { FormEvent, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '@/lib/password';
import { isStrongPassword, PASSWORD_REQUIREMENTS_SHORT } from '@/lib/passwordPolicy';
import PasswordRequirementsHint from '@/components/PasswordRequirementsHint';

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const token = sp.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError('Ungültiger Link');
      return;
    }
    if (!isStrongPassword(password)) {
      setError(PASSWORD_REQUIREMENTS_SHORT);
      return;
    }
    if (password !== confirm) {
      setError('Passwörter stimmen nicht überein');
      return;
    }
    try {
      await resetPassword(token, password);
      setOk(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (e: unknown) {
      setError('Zurücksetzen fehlgeschlagen');
    }
  }

  return (
    <div className="min-h-screen bg-mint-cream flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-viridian mb-4">Neues Passwort setzen</h2>
        {ok ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">Passwort gesetzt. Du wirst weitergeleitet…</p>
            <p className="text-xs text-gray-600">
              Falls nichts passiert:{' '}
              <a href="/" className="text-viridian hover:underline">
                Zum Login
              </a>
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="new-pass">
                Neues Passwort
              </label>
              <input
                id="new-pass"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-4 py-2"
                placeholder={PASSWORD_REQUIREMENTS_SHORT}
                title="Neues Passwort"
              />
              <PasswordRequirementsHint password={password} className="mt-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="new-pass-confirm">
                Bestätigung
              </label>
              <input
                id="new-pass-confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded px-4 py-2"
                placeholder="Wiederholen"
                title="Passwort bestätigen"
              />
            </div>
            <button type="submit" className="w-full bg-viridian text-white py-2 rounded">
              Speichern
            </button>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <p className="text-xs text-gray-600">
              Abbrechen?{' '}
              <a href="/" className="text-viridian hover:underline">
                Zurück zum Login
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
