import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { acceptInviteApi } from '@/lib/orgs';
import { setAuthToken } from '@/lib/api';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(()=>{ setError(null); }, [token, password]);

  return (
    <div className="min-h-screen bg-mint-cream flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h1 className="text-xl font-semibold text-viridian mb-4">Einladung annehmen</h1>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Einladungs-Token</label>
            <input value={token} onChange={(e)=>setToken(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Token aus E-Mail-Link" />
          </div>
          <div>
            <label className="block text-sm font-medium">Neues Passwort</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Passwort" />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            className="w-full bg-viridian text-white py-2 rounded disabled:opacity-60"
            disabled={!token || !password || busy}
            onClick={async()=>{
              try {
                setBusy(true);
                const res = await acceptInviteApi(token, password);
                if (res?.access_token) {
                  localStorage.setItem('auth_token', res.access_token);
                  setAuthToken(res.access_token);
                }
                navigate('/');
              } catch (e: any) {
                setError(String(e?.response?.data?.message || 'Aktivierung fehlgeschlagen'));
              } finally { setBusy(false); }
            }}
          >Einladung aktivieren</button>
        </div>
      </div>
    </div>
  );
}
