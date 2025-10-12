import { FormEvent, useState } from 'react';
import { requestPasswordReset } from '@/lib/password';

export default function ResetRequest() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        {sent ? (
          <p className="text-sm text-gray-700">Wenn die E-Mail existiert, haben wir dir einen Link zum Zurücksetzen geschickt.</p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium mb-2">E-Mail</label>
              <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border border-gray-300 rounded px-4 py-2" placeholder="email@example.com" />
            </div>
            <button type="submit" className="w-full bg-viridian text-white py-2 rounded">Link anfordern</button>
            {error && <div className="text-red-600 text-sm">{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
