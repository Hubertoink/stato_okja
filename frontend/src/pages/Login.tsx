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
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #5B6CFF 0%, #7C8FFF 30%, #9F7AEA 70%, #00CFE8 100%)'}}>
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/50">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold gradient-text">StatO</h1>
          <p className="text-gray-500 mt-2 font-medium">OKJA Statistik & Dokumentation</p>
        </div>

        <form className="space-y-6" onSubmit={onSubmit}>
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

          <button
            type="submit"
            className="btn-modern w-full py-3"
          >
            Anmelden
          </button>
          <div className="text-center text-sm mt-2">
            <a className="text-viridian hover:text-cambridge-blue transition-colors font-medium" href="/reset-password-request">Passwort vergessen?</a>
          </div>

          {error && <div className="chip chip-danger mt-2 w-full justify-center">{error}</div>}
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          © 2025 StatO - OKJA Team
        </p>
      </div>
    </div>
  );
}
