import { FormEvent, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { Eye as EyeIcon, EyeOff as EyeOffIcon } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await login(email, password);
    if (!res.ok) setError(res.error);
    else navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-mint-cream flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-viridian">StatO</h1>
          <p className="text-gray-600 mt-2">OKJA Statistik & Dokumentation</p>
        </div>

        <form className="space-y-6" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium mb-2">E-Mail</label>
            <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-viridian" placeholder="email@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Passwort</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-viridian"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 px-2 flex items-center text-gray-600 hover:text-gray-800"
                aria-label={showPwd ? 'Passwort ausblenden' : 'Passwort anzeigen'}
                title={showPwd ? 'Passwort ausblenden' : 'Passwort anzeigen'}
                onClick={() => setShowPwd((v) => !v)}
              >
                {showPwd ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-viridian text-white py-3 rounded-lg hover:bg-cambridge-blue transition-colors font-semibold"
          >
            Anmelden
          </button>
          <div className="text-center text-sm mt-2">
            <a className="text-viridian hover:underline" href="/reset-password-request">Passwort vergessen?</a>
          </div>

          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          © 2025 StatO - OKJA Team
        </p>
      </div>
    </div>
  );
}
