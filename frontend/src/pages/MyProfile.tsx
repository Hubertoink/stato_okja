import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function MyProfile() {
  const { user, refresh } = useAuth();
  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Meine Daten</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <ProfileCard userName={user?.name || ''} avatarUrl={user?.avatarUrl || null} onUpdated={refresh} />
        <PasswordCard />
      </div>
    </div>
  );
}

function ProfileCard({ userName, avatarUrl, onUpdated }: { userName: string; avatarUrl: string | null; onUpdated: ()=>Promise<void>|void }) {
  const [name, setName] = useState(userName);
  const [image, setImage] = useState<string | null>(avatarUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post('/uploads/images', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data?.url as string;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-viridian mb-4">Profil</h3>
      <div className="flex items-start gap-4">
        <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden bg-azure-web flex items-center justify-center text-gray-500 shrink-0">
          {image ? <img src={image} className="w-full h-full object-cover" /> : <span className="text-sm">Kein Bild</span>}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input className="border rounded px-3 py-2 w-full" value={name} onChange={(e)=> setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Profilfoto</label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e)=>{ const f = e.target.files?.[0]; if (f) { const url = await handleFile(f); setImage(url); } }} />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className="inline-flex items-center px-3 py-2 rounded bg-viridian text-white hover:bg-cambridge-blue text-sm"
                onClick={()=> fileInputRef.current?.click()}
              >
                Bild auswählen
              </button>
              {image && (
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 text-sm"
                  onClick={()=> setImage(null)}
                >
                  Entfernen
                </button>
              )}
              <span className="text-xs text-gray-500">PNG/JPG, max. 10&nbsp;MB</span>
            </div>
          </div>
          {msg && <div className="text-green-700 text-sm">{msg}</div>}
          {err && <div className="text-red-600 text-sm">{err}</div>}
          <button
            className="bg-viridian text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={busy}
            onClick={async()=>{
              setBusy(true); setMsg(null); setErr(null);
              try {
                await api.patch('/auth/me', { name, avatarUrl: image });
                setMsg('Profil aktualisiert');
                await onUpdated();
              } catch (e: unknown) {
                const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Aktualisierung fehlgeschlagen';
                setErr(Array.isArray(m as string[]) ? (m as string[]).join(', ') : String(m));
              } finally { setBusy(false); }
            }}
          >Speichern</button>
        </div>
      </div>
    </div>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-viridian mb-4">Passwort ändern</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Aktuelles Passwort</label>
          <input type="password" className="border rounded px-3 py-2 w-full" value={currentPassword} onChange={(e)=> setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium">Neues Passwort</label>
          <input type="password" className="border rounded px-3 py-2 w-full" value={newPassword} onChange={(e)=> setNewPassword(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium">Neues Passwort (Bestätigung)</label>
          <input type="password" className="border rounded px-3 py-2 w-full" value={confirmPassword} onChange={(e)=> setConfirmPassword(e.target.value)} />
        </div>
        {msg && <div className="text-green-700 text-sm">{msg}</div>}
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div>
          <button
            className="bg-viridian text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={busy || !currentPassword || !newPassword || newPassword!==confirmPassword}
            onClick={async()=>{
              setMsg(null); setErr(null); setBusy(true);
              try {
                await api.post('/auth/change-password', { currentPassword, newPassword });
                setMsg('Passwort wurde aktualisiert.');
                setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
              } catch (e: unknown) {
                const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Änderung fehlgeschlagen';
                setErr(Array.isArray(m as []) ? (m as string[]).join(', ') : String(m));
              } finally { setBusy(false); }
            }}
          >Passwort speichern</button>
        </div>
      </div>
    </div>
  );
}
