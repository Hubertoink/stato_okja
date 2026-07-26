import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { applyTheme, THEME_DEFINITIONS } from '@/lib/theme';
import { applyBackground, BACKGROUNDS, getStoredBackgroundId, type BackgroundId } from '@/lib/background';
import Modal from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import PasswordRequirementsHint from '@/components/PasswordRequirementsHint';
import { Camera, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { normalizeUploadPath } from '@/lib/uploadPaths';
import { getPasswordValidationMessage } from '@/lib/passwordPolicy';
import { getMobileNavLayout, MOBILE_NAV_ITEM_IDS, resetMobileNavLayout, saveMobileNavLayout, type MobileNavItemId } from '@/lib/mobileNavigation';

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
      <div className="grid grid-cols-1 gap-6">
        {!mustChangePassword && (
          <ProfileCard userName={user?.name || ''} avatarUrl={user?.avatarUrl || null} onUpdated={refresh} email={user?.email || ''} theme={user?.theme || 'Light Steel'} />
        )}
        {!mustChangePassword && <MobileNavigationSettings userId={user?.id} />}
        <PasswordSection mustChangePassword={mustChangePassword} onPasswordChanged={refresh} />
        {!mustChangePassword && <SessionsSection />}
      </div>
    </div>
  );
}

const mobileNavLabels: Record<MobileNavItemId, string> = {
  dashboard: 'Home', activities: 'Aktivitäten', logbook: 'Logbuch', calendar: 'Kalender',
  projects: 'Projekte', surveys: 'Umfragen', statistics: 'Statistiken', settings: 'Einstellungen',
};

function MobileNavigationSettings({ userId }: { userId?: string }) {
  const [bottom, setBottom] = useState<MobileNavItemId[]>(() => getMobileNavLayout(userId).bottom);
  const [dragged, setDragged] = useState<MobileNavItemId | null>(null);
  useEffect(() => setBottom(getMobileNavLayout(userId).bottom), [userId]);
  const more = MOBILE_NAV_ITEM_IDS.filter((id) => !bottom.includes(id));
  const persist = (next: MobileNavItemId[]) => {
    setBottom(next);
    saveMobileNavLayout({ bottom: next }, userId);
  };
  const swapWithBottom = (id: MobileNavItemId, target: MobileNavItemId) => {
    if (id === target) return;
    const sourceIsBottom = bottom.includes(id);
    const targetIsBottom = bottom.includes(target);
    if (sourceIsBottom && targetIsBottom) {
      const next = [...bottom];
      const from = next.indexOf(id);
      const to = next.indexOf(target);
      next.splice(from, 1);
      next.splice(to, 0, id);
      persist(next);
      return;
    }
    if (sourceIsBottom) persist(bottom.map((item) => item === id ? target : item));
    else if (targetIsBottom) persist(bottom.map((item) => item === target ? id : item));
  };
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-viridian">Mobile Navigation</h3>
          <p className="mt-1 text-sm text-gray-600">Lege fest, welche vier Punkte unten sichtbar sind. Alles andere erscheint unter „Mehr“.</p>
        </div>
        <button type="button" onClick={() => { resetMobileNavLayout(userId); setBottom(getMobileNavLayout(userId).bottom); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100">
          <RotateCcw className="h-4 w-4" />Zurücksetzen
        </button>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <MobileNavigationList title="Unten angezeigt" ids={bottom} dragged={dragged} setDragged={setDragged} onDrop={swapWithBottom} onMove={(id) => {
          const replacement = more[0];
          if (replacement) persist(bottom.map((item) => item === id ? replacement : item));
        }} actionLabel="Zu Mehr" emphasis />
        <MobileNavigationList title="Unter „Mehr“" ids={more} dragged={dragged} setDragged={setDragged} onDrop={swapWithBottom} onMove={(id) => persist([...bottom.slice(0, 3), id])} actionLabel="Nach unten" />
      </div>
      <p className="mt-3 text-xs text-gray-500">Tipp: Ziehe einen Punkt auf einen Platz in der unteren Leiste, um beide auszutauschen. Die Buttons funktionieren auch bequem auf Touch-Geräten.</p>
    </div>
  );
}

function MobileNavigationList({ title, ids, dragged, setDragged, onDrop, onMove, actionLabel, emphasis = false }: {
  title: string; ids: MobileNavItemId[]; dragged: MobileNavItemId | null; setDragged: (id: MobileNavItemId | null) => void;
  onDrop: (source: MobileNavItemId, target: MobileNavItemId) => void; onMove: (id: MobileNavItemId) => void;
  actionLabel: string; emphasis?: boolean;
}) {
  return <section><h4 className="mb-2 text-sm font-semibold text-gray-700">{title}</h4><div className={`space-y-2 rounded-xl border p-2 ${emphasis ? 'border-viridian/30 bg-viridian/5' : 'border-gray-200 bg-gray-50'}`}>{ids.map((id) => <div key={id} draggable onDragStart={() => setDragged(id)} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged) onDrop(dragged, id); setDragged(null); }} className="flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 text-sm font-medium text-gray-800 shadow-sm"><GripVertical className="h-4 w-4 text-gray-400" /><span className="flex-1">{mobileNavLabels[id]}</span><button type="button" onClick={() => onMove(id)} className={`text-xs font-semibold ${emphasis ? 'text-gray-500 hover:text-viridian' : 'text-viridian'}`}>{actionLabel}</button></div>)}</div></section>;
}

type AuthSession = {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
};

function formatSessionDate(value: string) {
  try {
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function SessionsSection() {
  const { logout } = useAuth();
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadSessions() {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get<AuthSession[]>('/auth/sessions');
      setSessions(res.data);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Sitzungen konnten nicht geladen werden';
      setErr(Array.isArray(message as string[]) ? (message as string[]).join(', ') : String(message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function revokeSession(sessionId: string) {
    setBusyId(sessionId);
    setErr(null);
    setNotice(null);
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      const revokedSession = sessions.find((session) => session.id === sessionId);
      if (revokedSession?.isCurrent) {
        logout();
        return;
      }
      setNotice('Sitzung widerrufen. Der betreffende Browser wird bei seiner nächsten Aktion abgemeldet.');
      await loadSessions();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Sitzung konnte nicht widerrufen werden';
      setErr(Array.isArray(message as string[]) ? (message as string[]).join(', ') : String(message));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-viridian mb-2">Aktive Sitzungen</h3>
          <p className="text-sm text-gray-600">Hier kannst du Browser-Sitzungen widerrufen. Dieses Gerät wird gesondert markiert.</p>
        </div>
        <ShieldCheck className="w-5 h-5 text-viridian shrink-0" />
      </div>
      {err && <div className="mt-4 text-sm text-red-600">{err}</div>}
      {notice && <div className="mt-4 text-sm text-green-700" role="status">{notice}</div>}
      <div className="mt-4 space-y-3">
        {loading && <div className="text-sm text-gray-500">Sitzungen werden geladen…</div>}
        {!loading && sessions.length === 0 && <div className="text-sm text-gray-500">Keine aktiven Refresh-Sitzungen gefunden.</div>}
        {sessions.map((session) => (
          <div key={session.id} className="rounded-lg border border-gray-200 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <span className="truncate">{session.userAgent || 'Unbekannter Client'}</span>
                {session.isCurrent && <span className="shrink-0 rounded-full bg-viridian/10 px-2 py-0.5 text-xs font-semibold text-viridian">Dieses Gerät</span>}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Zuletzt genutzt: {formatSessionDate(session.lastUsedAt)} · Ablauf: {formatSessionDate(session.expiresAt)}
              </div>
              {session.ipAddress && <div className="mt-1 text-xs text-gray-500">IP: {session.ipAddress}</div>}
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
              disabled={busyId === session.id}
              onClick={() => void revokeSession(session.id)}
              title={session.isCurrent ? 'Diese Sitzung beenden' : 'Sitzung widerrufen'}
            >
              <Trash2 className="w-4 h-4" />
              {session.isCurrent ? 'Diese Sitzung beenden' : 'Widerrufen'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileCard({ userName, avatarUrl, onUpdated, email, theme }: { userName: string; avatarUrl: string | null; email: string; theme: string; onUpdated: ()=>Promise<void>|void }) {
  const [name, setName] = useState(userName);
  const [image, setImage] = useState<string | null>(normalizeUploadPath(avatarUrl) || null);
  const [savingName, setSavingName] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string>(theme);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundId>(getStoredBackgroundId());
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [avatarActionOpen, setAvatarActionOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedBackgroundLabel = BACKGROUNDS.find((background) => background.id === selectedBackground)?.label || 'Standard';
  const nameChanged = name.trim() !== userName.trim();

  useEffect(() => setName(userName), [userName]);
  useEffect(() => setImage(normalizeUploadPath(avatarUrl) || null), [avatarUrl]);
  useEffect(() => setSelectedTheme(theme), [theme]);

  function errorMessage(error: unknown) {
    const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Aktualisierung fehlgeschlagen';
    return Array.isArray(message as string[]) ? (message as string[]).join(', ') : String(message);
  }

  async function persistProfile(patch: { name?: string; avatarUrl?: string | null; theme?: string }, successMessage: string) {
    setMsg(null);
    setErr(null);
    try {
      await api.patch('/auth/me', patch);
      setMsg(successMessage);
      await onUpdated();
      return true;
    } catch (error: unknown) {
      setErr(errorMessage(error));
      return false;
    }
  }

  async function handleFile(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post('/uploads/images', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return normalizeUploadPath(res.data?.url as string) as string;
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-viridian mb-4">Profil</h3>
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="w-full shrink-0 space-y-2 text-center md:w-auto md:text-left">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setSavingAvatar(true);
              try {
                const url = await handleFile(file);
                const previousImage = image;
                setImage(url);
                if (!(await persistProfile({ avatarUrl: url }, 'Profilbild aktualisiert'))) setImage(previousImage);
              } catch (error: unknown) {
                setErr(errorMessage(error));
              } finally {
                setSavingAvatar(false);
                event.target.value = '';
              }
            }}
          />
          <div className="flex justify-center md:block">
            <button
              type="button"
              className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-azure-web text-gray-500 transition-transform hover:scale-[1.02] md:h-28 md:w-28"
              onClick={()=> setAvatarActionOpen(true)}
              aria-label={image ? 'Profilbild ändern' : 'Profilbild auswählen'}
              title={image ? 'Profilbild ändern' : 'Profilbild auswählen'}
            >
              {image ? <ProtectedImage src={image} alt="Profilbild" className="w-full h-full object-cover" /> : <span className="text-sm">{savingAvatar ? 'Lädt…' : 'Kein Bild'}</span>}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Camera className="h-4 w-4" />
                {image ? 'Optionen' : 'Wählen'}
              </span>
            </button>
          </div>
          <div className="text-xs text-gray-500">Avatar antippen oder anklicken. PNG/JPG, max. 10&nbsp;MB</div>
        </div>
        <div className="w-full flex-1 space-y-3">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <div className="flex gap-2">
              <input className="border rounded px-3 py-2 w-full" value={name} onChange={(e)=> setName(e.target.value)} />
              {nameChanged && (
                <button
                  type="button"
                  className="shrink-0 rounded bg-viridian px-4 py-2 text-white disabled:opacity-60"
                  disabled={savingName || !name.trim()}
                  onClick={async () => {
                    setSavingName(true);
                    await persistProfile({ name: name.trim() }, 'Name aktualisiert');
                    setSavingName(false);
                  }}
                >
                  {savingName ? 'Speichert…' : 'Speichern'}
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">E-Mail</label>
            <input className="border rounded px-3 py-2 w-full bg-gray-50 text-gray-600" value={email} disabled />
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left"
              onClick={() => setAppearanceExpanded((current) => !current)}
              aria-expanded={appearanceExpanded}
            >
              <div>
                <div className="text-sm font-medium">Darstellung anpassen</div>
                <div className="mt-1 text-xs text-gray-500">Theme: {selectedTheme} · Hintergrund: {selectedBackgroundLabel}</div>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]">
                {appearanceExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>

            {appearanceExpanded && (
              <div className="mt-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Design-Theme</label>
                  <ThemePicker
                    value={selectedTheme}
                    onChange={(nextTheme) => {
                      const previousTheme = selectedTheme;
                      setSelectedTheme(nextTheme);
                      applyTheme(nextTheme);
                      setSavingAppearance(true);
                      void persistProfile({ theme: nextTheme }, 'Darstellung aktualisiert').then((saved) => {
                        if (!saved) {
                          setSelectedTheme(previousTheme);
                          applyTheme(previousTheme);
                        }
                        setSavingAppearance(false);
                      });
                    }}
                  />
                  {savingAppearance && <div className="mt-2 text-xs text-gray-500">Darstellung wird gespeichert…</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Hintergrund</label>
                  <BackgroundPicker
                    value={selectedBackground}
                    onChange={(bg) => {
                      setSelectedBackground(bg);
                      applyBackground(bg);
                      setMsg('Hintergrund aktualisiert');
                      setErr(null);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          {msg && <div className="text-green-700 text-sm">{msg}</div>}
          {err && <div className="text-red-600 text-sm">{err}</div>}
        </div>
      </div>
      </div>

      <Modal open={avatarActionOpen} onClose={() => setAvatarActionOpen(false)} title="Profilbild" maxWidth="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {image ? 'Du kannst dein aktuelles Profilbild ersetzen oder entfernen.' : 'Wähle ein Profilbild aus.'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition-colors"
              onClick={() => {
                setAvatarActionOpen(false);
                requestAnimationFrame(() => fileInputRef.current?.click());
              }}
            >
              {image ? 'Bild ersetzen' : 'Bild auswählen'}
            </button>
            {image && (
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                disabled={savingAvatar}
                onClick={() => {
                  const previousImage = image;
                  setImage(null);
                  setAvatarActionOpen(false);
                  setSavingAvatar(true);
                  void persistProfile({ avatarUrl: null }, 'Profilbild entfernt').then((saved) => {
                    if (!saved) setImage(previousImage);
                    setSavingAvatar(false);
                  });
                }}
              >
                Bild löschen
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

function PasswordSection({ mustChangePassword, onPasswordChanged }: { mustChangePassword: boolean; onPasswordChanged: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (mustChangePassword) setOpen(true);
  }, [mustChangePassword]);

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-viridian mb-3">Passwort ändern</h3>
        <p className="text-sm text-gray-600 mb-4">
          {mustChangePassword
            ? 'Bitte öffne den Dialog und ersetze dein temporäres Passwort durch ein eigenes Passwort.'
            : 'Das Passwortformular wird nur bei Bedarf geöffnet und erscheint nicht dauerhaft auf der Profilseite.'}
        </p>
        <button
          type="button"
          className="bg-viridian text-white px-4 py-2 rounded disabled:opacity-60"
          onClick={() => setOpen(true)}
        >
          Passwort ändern
        </button>
      </div>

      <PasswordChangeModal
        open={open}
        mustChangePassword={mustChangePassword}
        onClose={() => setOpen(false)}
        onPasswordChanged={onPasswordChanged}
      />
    </>
  );
}

function PasswordChangeModal({
  open,
  mustChangePassword,
  onClose,
  onPasswordChanged,
}: {
  open: boolean;
  mustChangePassword: boolean;
  onClose: () => void;
  onPasswordChanged: () => Promise<void> | void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const passwordValidationMessage = getPasswordValidationMessage(newPassword);

  useEffect(() => {
    if (open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setBusy(false);
    setMsg(null);
    setErr(null);
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Passwort ändern" maxWidth="md">
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
          <PasswordRequirementsHint password={newPassword} className="mt-2" />
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
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            className="bg-viridian text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={busy || !currentPassword || !newPassword || newPassword!==confirmPassword || Boolean(passwordValidationMessage)}
            onClick={async()=>{
              setMsg(null); setErr(null); setBusy(true);
              try {
                await api.post('/auth/change-password', { currentPassword, newPassword });
                setMsg('Passwort wurde aktualisiert.');
                setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
                await onPasswordChanged();
                onClose();
              } catch (e: unknown) {
                const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Änderung fehlgeschlagen';
                setErr(Array.isArray(m as []) ? (m as string[]).join(', ') : String(m));
              } finally { setBusy(false); }
            }}
          >Passwort speichern</button>
        </div>
      </div>
    </Modal>
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
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEME_DEFINITIONS.map(t => (
          <button
            key={t.name}
            type="button"
            onClick={()=> onChange(t.name)}
            className={`border rounded p-2 text-left ${value===t.name ? 'ring-2 ring-viridian' : ''}`}
          >
            <div className="font-medium text-sm">{t.name}</div>
            <div className="text-xs text-gray-500 mb-2">{t.description}</div>
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
