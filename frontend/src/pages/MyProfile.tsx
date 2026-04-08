import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { applyBackground, BACKGROUNDS, getStoredBackgroundId, type BackgroundId } from '@/lib/background';
import ProtectedImage from '@/components/ProtectedImage';
import { Eye, EyeOff } from 'lucide-react';
import { normalizeUploadPath } from '@/lib/uploadPaths';

export default function MyProfile() {
  const { user, refresh } = useAuth();
  const mustChangePassword = user?.mustChangePassword === true;
  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Meine Daten</h2>
      {mustChangePassword && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          Dein Passwort wurde temporär durch einen Superadmin gesetzt. Bitte ändere es jetzt, bevor du StatO weiter benutzt.
        </div>
      )}
      <div className={`grid grid-cols-1 gap-6 ${mustChangePassword ? '' : 'md:grid-cols-2'}`}>
        {!mustChangePassword && (
          <ProfileCard userName={user?.name || ''} avatarUrl={user?.avatarUrl || null} onUpdated={refresh} email={user?.email || ''} theme={user?.theme || 'Light Steel'} />
        )}
        <PasswordCard mustChangePassword={mustChangePassword} onPasswordChanged={refresh} />
      </div>
    </div>
  );
}

function ProfileCard({ userName, avatarUrl, onUpdated, email, theme }: { userName: string; avatarUrl: string | null; email: string; theme: string; onUpdated: ()=>Promise<void>|void }) {
  const [name, setName] = useState(userName);
  const [image, setImage] = useState<string | null>(normalizeUploadPath(avatarUrl) || null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string>(theme);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundId>(getStoredBackgroundId());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post('/uploads/images', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return normalizeUploadPath(res.data?.url as string) as string;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-viridian mb-4">Profil</h3>
      <div className="flex items-start gap-4">
        <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden bg-azure-web flex items-center justify-center text-gray-500 shrink-0">
          {image ? <ProtectedImage src={image} alt="Profilbild" className="w-full h-full object-cover" /> : <span className="text-sm">Kein Bild</span>}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input className="border rounded px-3 py-2 w-full" value={name} onChange={(e)=> setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">E-Mail</label>
            <input className="border rounded px-3 py-2 w-full bg-gray-50 text-gray-600" value={email} disabled />
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
          <div>
            <label className="block text-sm font-medium mb-1">Design-Theme</label>
            <ThemePicker value={selectedTheme} onChange={(t)=>{ setSelectedTheme(t); try { document.documentElement.setAttribute('data-theme', t); } catch (e) { /* noop */ } }} />
          </div>
      <div>
      <label className="block text-sm font-medium mb-1">Hintergrund</label>
      <BackgroundPicker
        value={selectedBackground}
        onChange={(bg) => {
          setSelectedBackground(bg);
          applyBackground(bg);
        }}
      />
      </div>
          {msg && <div className="text-green-700 text-sm">{msg}</div>}
          {err && <div className="text-red-600 text-sm">{err}</div>}
          <button
            className="bg-viridian text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={busy}
            onClick={async()=>{
              setBusy(true); setMsg(null); setErr(null);
              try {
                await api.patch('/auth/me', { name, avatarUrl: normalizeUploadPath(image) || null, theme: selectedTheme });
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

function PasswordCard({ mustChangePassword, onPasswordChanged }: { mustChangePassword: boolean; onPasswordChanged: () => Promise<void> | void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-viridian mb-4">Passwort ändern</h3>
      {mustChangePassword && (
        <p className="mb-4 text-sm text-gray-600">
          Verwende dein temporäres Passwort als aktuelles Passwort und vergebe danach ein eigenes neues Passwort.
        </p>
      )}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Aktuelles Passwort</label>
          <PasswordInput
            value={currentPassword}
            visible={showCurrentPassword}
            onToggleVisibility={() => setShowCurrentPassword((visible) => !visible)}
            onChange={(value) => setCurrentPassword(value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Neues Passwort</label>
          <PasswordInput
            value={newPassword}
            visible={showNewPassword}
            onToggleVisibility={() => setShowNewPassword((visible) => !visible)}
            onChange={(value) => setNewPassword(value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Neues Passwort (Bestätigung)</label>
          <PasswordInput
            value={confirmPassword}
            visible={showConfirmPassword}
            onToggleVisibility={() => setShowConfirmPassword((visible) => !visible)}
            onChange={(value) => setConfirmPassword(value)}
          />
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
                await onPasswordChanged();
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

function PasswordInput({
  value,
  visible,
  onChange,
  onToggleVisibility,
}: {
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className="border rounded px-3 py-2 pr-11 w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-gray-500 hover:text-viridian"
        aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
        title={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function ThemePicker({ value, onChange }: { value: string; onChange: (t: string)=>void }) {
  const themes: Array<{ name: string; colors: string[] }> = [
    // Show primary + secondary + real UI accents + background
    { name: 'Default Theme', colors: ['#5B6CFF','#7C8FFF','#16a34a','#f59e0b','#FAFBFF'] },
    { name: 'Earthy Tones', colors: ['#6d6875','#b5838d','#e5989b','#ffb4a2','#f5f2f1'] },
    { name: 'Peachy Delight', colors: ['#d8e2dc','#ffe5d9','#ffcad4','#f4acb7','#9d8189'] },
    { name: 'Ocean Pearl', colors: ['#006d77','#83c5be','#edf6f9','#ffddd2','#f3f4f6'] },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {themes.map(t => (
          <button
            key={t.name}
            type="button"
            onClick={()=> onChange(t.name)}
            className={`border rounded p-2 text-left ${value===t.name ? 'ring-2 ring-viridian' : ''}`}
          >
            <div className="font-medium text-sm mb-2">{t.name}</div>
            <div className="flex -space-x-1">
              {t.colors.map((c,i)=> (<span key={i} className="inline-block w-6 h-6 rounded border" style={{ backgroundColor: c }} />))}
            </div>
          </button>
        ))}
      </div>
      <div className="text-xs text-gray-500">Auswahl wird sofort als Vorschau angewendet und beim Speichern dauerhaft übernommen.</div>
    </div>
  );
}

function BackgroundPicker({ value, onChange }: { value: BackgroundId; onChange: (b: BackgroundId) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {BACKGROUNDS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onChange(b.id)}
            className={`border rounded p-2 text-left ${value === b.id ? 'ring-2 ring-viridian' : ''}`}
          >
            <div className="font-medium text-sm mb-2">{b.label}</div>
            <div
              className="w-full h-16 rounded border bg-cover bg-center"
              style={{ backgroundImage: `url(${b.url})` }}
            />
          </button>
        ))}
      </div>
      <div className="text-xs text-gray-500">Auswahl wird sofort angewendet und lokal gespeichert.</div>
    </div>
  );
}
