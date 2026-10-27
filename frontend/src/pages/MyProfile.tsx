import RoleInfo from '@/components/profile/RoleInfo';
import { useEffect, useRef, useState } from 'react';
import { useAuth, type AuthSessionPayload, type Role } from '@/lib/auth';
import { api } from '@/lib/api';
import Modal from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import PasswordRequirementsHint from '@/components/PasswordRequirementsHint';
import { Camera, ChevronDown, ChevronUp, Eye, EyeOff, ShieldCheck, Trash2 } from 'lucide-react';
import { normalizeUploadPath } from '@/lib/uploadPaths';
import { getPasswordValidationMessage } from '@/lib/passwordPolicy';
import { useTranslation } from 'react-i18next';
import { setPreferredLocale } from '@/i18n';
import { APP_LOCALES, type AppLocale } from '@/i18n/locales';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';

export default function MyProfile() {
  const { user, refresh, replaceSession } = useAuth();
  const mustChangePassword = user?.mustChangePassword === true;
  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">{autoT('ui_a63fc74cb067')}</h2>
      {mustChangePassword && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">{autoT('ui_db4f8d3761bb')}</div>
      )}
      <div className="grid grid-cols-1 gap-6">
        {!mustChangePassword && (
          <ProfileCard userName={user?.name || ''} avatarUrl={user?.avatarUrl || null} onUpdated={refresh} email={user?.email || ''} role={user?.role || 'user'} locale={user?.locale || 'de'} />
        )}
        <PasswordSection mustChangePassword={mustChangePassword} onPasswordChanged={replaceSession} />
        {!mustChangePassword && <SessionsSection />}
      </div>
    </div>
  );
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
    return new Intl.DateTimeFormat(getCurrentIntlLocale(), {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function SessionsSection() {
  const { logout } = useAuth();
  const { t } = useTranslation('common');
  const [expanded, setExpanded] = useState(false);
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
    if (!expanded) return;
    void loadSessions();
  }, [expanded]);

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
      setNotice(autoT('ui_e575d71ccb88'));
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
          <h3 className="text-lg font-semibold text-viridian">{autoT('ui_9d01dab45fb0')}</h3>
          {expanded ? <p className="mt-2 text-sm text-gray-600">{autoT('ui_bad420c44035')}</p> : null}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg p-1 text-viridian hover:bg-viridian/10"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-label={expanded ? t('sessions.collapse') : t('sessions.expand')}
        >
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
          {expanded ? <ChevronUp className="h-5 w-5" aria-hidden="true" /> : <ChevronDown className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {expanded ? <>
      {err && <div className="mt-4 text-sm text-red-600">{err}</div>}
      {notice && <div className="mt-4 text-sm text-green-700" role="status">{notice}</div>}
      <div className="mt-4 space-y-3">
        {loading && <div className="text-sm text-gray-500">{autoT('ui_e65200c0481e')}</div>}
        {!loading && sessions.length === 0 && <div className="text-sm text-gray-500">{autoT('ui_385bec66030b')}</div>}
        {sessions.map((session) => (
          <div key={session.id} className="rounded-lg border border-gray-200 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <span className="truncate">{session.userAgent || 'Unbekannter Client'}</span>
                {session.isCurrent && <span className="shrink-0 rounded-full bg-viridian/10 px-2 py-0.5 text-xs font-semibold text-viridian">{autoT('ui_cb82eeaa77b5')}</span>}
              </div>
              <div className="mt-1 text-xs text-gray-500">{autoT('ui_598a1c3abd10')}{formatSessionDate(session.lastUsedAt)}{' '}{autoT('ui_2cd5cfc80c85')}{' '}{formatSessionDate(session.expiresAt)}
              </div>
              {session.ipAddress && <div className="mt-1 text-xs text-gray-500">{autoT('ui_97322c15b2fa')}{' '}{session.ipAddress}</div>}
            </div>
            <Button
              variant="danger"
              size="md"
              disabled={busyId === session.id}
              onClick={() => void revokeSession(session.id)}
              title={session.isCurrent ? autoT('ui_e5f0d590864f') : autoT('ui_d53c36e80d08')}
            >
              <Trash2 className="w-4 h-4" />
              {session.isCurrent ? autoT('ui_e5f0d590864f') : autoT('ui_2c7ccedb30fe')}
            </Button>
          </div>
        ))}
      </div>
      </> : null}
    </div>
  );
}

function ProfileCard({ userName, avatarUrl, onUpdated, email, role, locale }: { userName: string; avatarUrl: string | null; email: string; role: Role; locale: AppLocale; onUpdated: ()=>Promise<void>|void }) {
  const { t } = useTranslation('common');
  const { showToast } = useToast();
  const [name, setName] = useState(userName);
  const [image, setImage] = useState<string | null>(normalizeUploadPath(avatarUrl) || null);
  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<AppLocale>(locale);
  const [avatarActionOpen, setAvatarActionOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nameChanged = name.trim() !== userName.trim();

  useEffect(() => setName(userName), [userName]);
  useEffect(() => setImage(normalizeUploadPath(avatarUrl) || null), [avatarUrl]);
  useEffect(() => setSelectedLocale(locale), [locale]);

  function errorMessage(error: unknown) {
    const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Aktualisierung fehlgeschlagen';
    return Array.isArray(message as string[]) ? (message as string[]).join(', ') : String(message);
  }

  async function persistProfile(patch: { name?: string; avatarUrl?: string | null; locale?: AppLocale }, successMessage: string) {
    try {
      await api.patch('/auth/me', patch);
      showToast(successMessage);
      await onUpdated();
      return true;
    } catch (error: unknown) {
      showToast(errorMessage(error), { type: 'error' });
      return false;
    }
  }

  async function handleFile(file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('variant', 'avatar');
    const res = await api.post('/uploads/images', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return normalizeUploadPath(res.data?.url as string) as string;
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-viridian mb-4">{autoT('ui_669fe25a324e')}</h3>
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
                showToast(errorMessage(error), { type: 'error' });
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
              onClick={() => {
                if (savingAvatar) return;
                if (image) {
                  setAvatarActionOpen(true);
                } else {
                  requestAnimationFrame(() => fileInputRef.current?.click());
                }
              }}
              aria-label={image ? autoT('ui_738c85f6e1ca') : autoT('ui_80417a3b01af')}
              title={image ? autoT('ui_738c85f6e1ca') : autoT('ui_80417a3b01af')}
            >
              {image ? <ProtectedImage src={image} alt={autoT('ui_ff0b65e56977')} className="w-full h-full object-cover" /> : <span className="text-sm">{savingAvatar ? autoT('ui_3489bcab5055') : autoT('ui_bdc5d92d00ca')}</span>}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Camera className="h-4 w-4" />
                {image ? autoT('ui_3789b70204b6') : autoT('ui_06cea5c40f66')}
              </span>
            </button>
          </div>
          <RoleInfo role={role} />
          <div className="text-xs text-gray-500">{autoT('ui_055ae355b1aa')}</div>
        </div>
        <div className="w-full flex-1 space-y-3">
          <div>
            <label className="block text-sm font-medium">{autoT('ui_709a23220f2c')}</label>
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
                  {savingName ? autoT('ui_5fd2cc2355ae') : autoT('ui_70b73bbc118d')}
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">{autoT('ui_9eeffe4b7b6e')}</label>
            <input className="border rounded px-3 py-2 w-full bg-gray-50 text-gray-600" value={email} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="profile-locale">{t('language.label')}</label>
            <select
              id="profile-locale"
              className="mt-1 w-full rounded border px-3 py-2"
              value={selectedLocale}
              disabled={savingLocale}
              onChange={async (event) => {
                const nextLocale = event.target.value as AppLocale;
                const previousLocale = selectedLocale;
                setSelectedLocale(nextLocale);
                setSavingLocale(true);
                const saved = await persistProfile({ locale: nextLocale }, t('language.saved'));
                if (saved) {
                  await setPreferredLocale(nextLocale, { reload: true });
                } else {
                  setSelectedLocale(previousLocale);
                }
                setSavingLocale(false);
              }}
            >
              {APP_LOCALES.map((option) => (
                <option key={option} value={option}>{t(`language.options.${option}`)}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">{savingLocale ? t('language.saving') : t('language.help')}</p>
          </div>

        </div>
      </div>
      </div>

      <Modal open={avatarActionOpen} onClose={() => setAvatarActionOpen(false)} title={autoT('ui_ff0b65e56977')} maxWidth="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {image ? autoT('ui_e26b6ffc4701') : autoT('ui_a6bcd2a318e5')}
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
              {image ? autoT('ui_175c40ccf77b') : autoT('ui_16d5cad2c08f')}
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
              >{autoT('ui_11f8554a1e3a')}</button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

function PasswordSection({ mustChangePassword, onPasswordChanged }: { mustChangePassword: boolean; onPasswordChanged: (session: AuthSessionPayload) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (mustChangePassword) setOpen(true);
  }, [mustChangePassword]);

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-viridian mb-3">{autoT('ui_fc577f211bd3')}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {mustChangePassword
            ? autoT('ui_c939c917ca71')
            : autoT('ui_6ac58132e6f2')}
        </p>
        <button
          type="button"
          className="bg-viridian text-white px-4 py-2 rounded disabled:opacity-60"
          onClick={() => setOpen(true)}
        >{autoT('ui_fc577f211bd3')}</button>
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
  onPasswordChanged: (session: AuthSessionPayload) => void;
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
    <Modal open={open} onClose={onClose} title={autoT('ui_fc577f211bd3')} maxWidth="md">
      {mustChangePassword && (
        <p className="mb-4 text-sm text-gray-600">{autoT('ui_bbf7bc22b497')}</p>
      )}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium">{autoT('ui_f562caab0113')}</label>
          <PasswordInput
            value={currentPassword}
            visible={showCurrentPassword}
            onToggleVisibility={() => setShowCurrentPassword((visible) => !visible)}
            onChange={(value) => setCurrentPassword(value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">{autoT('ui_cc5213bdfc29')}</label>
          <PasswordInput
            value={newPassword}
            visible={showNewPassword}
            onToggleVisibility={() => setShowNewPassword((visible) => !visible)}
            onChange={(value) => setNewPassword(value)}
          />
          <PasswordRequirementsHint password={newPassword} className="mt-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">{autoT('ui_7133e8c0e8b1')}</label>
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
          >{autoT('ui_07af7cb30fca')}</button>
          <button
            className="bg-viridian text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={busy || !currentPassword || !newPassword || newPassword!==confirmPassword || Boolean(passwordValidationMessage)}
            onClick={async()=>{
              setMsg(null); setErr(null); setBusy(true);
              try {
                const response = await api.post<AuthSessionPayload>('/auth/change-password', { currentPassword, newPassword });
                setMsg(autoT('ui_5dca18ea873e'));
                setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
                onPasswordChanged(response.data);
                onClose();
              } catch (e: unknown) {
                const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message || autoT('ui_a987db72eb1d');
                setErr(Array.isArray(m as []) ? (m as string[]).join(', ') : String(m));
              } finally { setBusy(false); }
            }}
          >{autoT('ui_9389a7c1d3e8')}</button>
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
        type={visible ? "text" : "password"}
        className="border rounded px-3 py-2 pr-11 w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-gray-500 hover:text-viridian"
        aria-label={visible ? autoT('ui_79de9effdeda') : autoT('ui_07039cae9ab7')}
        title={visible ? autoT('ui_79de9effdeda') : autoT('ui_07039cae9ab7')}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

