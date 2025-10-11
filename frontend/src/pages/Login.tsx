import { FormEvent, useState } from 'react';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await login(email, password);
    if (!res.ok) setError(res.error);
  }

  return (
    <div className="min-h-screen bg-mint-cream flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-viridian">Stato 2.0</h1>
          <p className="text-gray-600 mt-2">OKJA Statistik & Dokumentation</p>
        </div>

        <form className="space-y-6" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium mb-2">E-Mail</label>
            <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-viridian" placeholder="email@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Passwort</label>
            <input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-viridian" placeholder="••••••••" />
          </div>

          <button
            type="submit"
            className="w-full bg-viridian text-white py-3 rounded-lg hover:bg-cambridge-blue transition-colors font-semibold"
          >
            Anmelden
          </button>

          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          © 2025 Stato 2.0 - OKJA Team
        </p>
      </div>
    </div>
  );
}
