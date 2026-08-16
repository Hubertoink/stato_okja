import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, type AuthSessionPayload } from '@/lib/auth';
import { api } from '@/lib/api';
import { applyTheme, DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, normalizeThemeMode, THEME_DEFINITIONS, type ThemeMode } from '@/lib/theme';
import Modal from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import PasswordRequirementsHint from '@/components/PasswordRequirementsHint';
import { Camera, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { normalizeUploadPath } from '@/lib/uploadPaths';
import { getPasswordValidationMessage } from '@/lib/passwordPolicy';
import { getMobileNavLayout, MOBILE_NAV_ITEM_IDS, resetMobileNavLayout, saveMobileNavLayout, type MobileNavItemId } from '@/lib/mobileNavigation';
import { useProcessOAccess } from '@/lib/processes';
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
          <ProfileCard userName={user?.name || ''} avatarUrl={user?.avatarUrl || null} onUpdated={refresh} email={user?.email || ''} theme={user?.theme || DEFAULT_LIGHT_THEME} themeMode={user?.themeMode || 'system'} locale={user?.locale || 'de'} />
        )}
        {!mustChangePassword && <MobileNavigationSettings userId={user?.id} />}
        <PasswordSection mustChangePassword={mustChangePassword} onPasswordChanged={replaceSession} />
        {!mustChangePassword && <SessionsSection />}
      </div>
    </div>
  );
}

function MobileNavigationSettings({ userId }: { userId?: string }) {
  const { t } = useTranslation('common');
  const processOAccess = useProcessOAccess();
  const availableItemIds = useMemo(
    () => processOAccess.data?.enabled ? MOBILE_NAV_ITEM_IDS : MOBILE_NAV_ITEM_IDS.filter((id) => id !== 'processes'),
    [processOAccess.data?.enabled],
  );
  const mobileNavLabels: Record<MobileNavItemId, string> = {
    dashboard: t('navigation.dashboard'),
    activities: t('navigation.activities'),
    logbook: t('navigation.logbook'),
    calendar: t('navigation.calendar'),
    projects: t('navigation.projects'),
    processes: t('navigation.processes'),
    surveys: t('navigation.surveys'),
    statistics: t('navigation.statistics'),
    settings: t('navigation.settings'),
  };
  const [bottom, setBottom] = useState<MobileNavItemId[]>(() => getMobileNavLayout(userId, availableItemIds).bottom);
  const [dragged, setDragged] = useState<MobileNavItemId | null>(null);
  useEffect(() => setBottom(getMobileNavLayout(userId, availableItemIds).bottom), [availableItemIds, userId]);
  const more = availableItemIds.filter((id) => !bottom.includes(id));
  const persist = (next: MobileNavItemId[]) => {
    setBottom(next);
    saveMobileNavLayout({ bottom: next }, userId, availableItemIds);
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
    <div className="settings-profile-card bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-viridian">{autoT('ui_23f0292a1de9')}</h3>
          <p className="mt-1 text-sm text-gray-600">{autoT('ui_393e7b57db57')}</p>
        </div>
        <button type="button" onClick={() => { resetMobileNavLayout(userId, availableItemIds); setBottom(getMobileNavLayout(userId, availableItemIds).bottom); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100">
          <RotateCcw className="h-4 w-4" />{autoT('ui_a4565af537e2')}</button>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <MobileNavigationList labels={mobileNavLabels} title={autoT('ui_71156a85ad75')} ids={bottom} dragged={dragged} setDragged={setDragged} onDrop={swapWithBottom} onMove={(id) => {
          const replacement = more[0];
          if (replacement) persist(bottom.map((item) => item === id ? replacement : item));
        }} actionLabel={autoT('ui_30ef5576c197')} emphasis />
        <MobileNavigationList labels={mobileNavLabels} title={autoT('ui_3b1556f1c066')} ids={more} dragged={dragged} setDragged={setDragged} onDrop={swapWithBottom} onMove={(id) => persist([...bottom.slice(0, 3), id])} actionLabel={autoT('ui_006cca9235b0')} />
      </div>
      <p className="mt-3 text-xs text-gray-500">{autoT('ui_dafbef2f8f5e')}</p>
    </div>
  );
}

function MobileNavigationList({ labels, title, ids, dragged, setDragged, onDrop, onMove, actionLabel, emphasis = false }: {
  labels: Record<MobileNavItemId, string>;
  title: string; ids: MobileNavItemId[]; dragged: MobileNavItemId | null; setDragged: (id: MobileNavItemId | null) => void;
  onDrop: (source: MobileNavItemId, target: MobileNavItemId) => void; onMove: (id: MobileNavItemId) => void;
  actionLabel: string; emphasis?: boolean;
}) {
  return <section><h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{title}</h4><div className={`settings-mobile-list space-y-2 rounded-xl border p-2 ${emphasis ? "settings-mobile-list-emphasis" : ""}`}>{ids.map((id) => <div key={id} draggable onDragStart={() => setDragged(id)} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged) onDrop(dragged, id); setDragged(null); }} className="settings-mobile-item flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium"><GripVertical className="h-4 w-4 text-[var(--text-muted)]" /><span className="min-w-0 flex-1">{labels[id]}</span><button type="button" onClick={() => onMove(id)} className={`min-h-11 shrink-0 px-2 text-xs font-semibold ${emphasis ? "text-[var(--text-secondary)] hover:text-viridian" : "text-viridian"}`}>{actionLabel}</button></div>)}</div></section>;
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

function ProfileCard({ userName, avatarUrl, onUpdated, email, theme, themeMode, locale }: { userName: string; avatarUrl: string | null; email: string; theme: string; themeMode: ThemeMode; locale: AppLocale; onUpdated: ()=>Promise<void>|void }) {
  const { t } = useTranslation('common');
  const { showToast } = useToast();
  const [name, setName] = useState(userName);
  const [image, setImage] = useState<string | null>(normalizeUploadPath(avatarUrl) || null);
  const [savingName, setSavingName] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string>(theme);
  const [selectedThemeMode, setSelectedThemeMode] = useState<ThemeMode>(normalizeThemeMode(themeMode));
  const [selectedLocale, setSelectedLocale] = useState<AppLocale>(locale);
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [avatarActionOpen, setAvatarActionOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nameChanged = name.trim() !== userName.trim();

  useEffect(() => setName(userName), [userName]);
  useEffect(() => setImage(normalizeUploadPath(avatarUrl) || null), [avatarUrl]);
  useEffect(() => setSelectedTheme(theme), [theme]);
  useEffect(() => setSelectedThemeMode(normalizeThemeMode(themeMode)), [themeMode]);
  useEffect(() => setSelectedLocale(locale), [locale]);

  function errorMessage(error: unknown) {
    const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Aktualisierung fehlgeschlagen';
    return Array.isArray(message as string[]) ? (message as string[]).join(', ') : String(message);
  }

  async function persistProfile(patch: { name?: string; avatarUrl?: string | null; theme?: string; themeMode?: ThemeMode; locale?: AppLocale }, successMessage: string) {
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
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left"
              onClick={() => setAppearanceExpanded((current) => !current)}
              aria-expanded={appearanceExpanded}
            >
              <div>
                <div className="text-sm font-medium">{autoT('ui_76a523492a64')}</div>
                <div className="mt-1 text-xs text-gray-500">{autoT('ui_0485a0265960')}{' '}{selectedThemeMode === 'system' ? 'System' : selectedThemeMode === 'light' ? 'Hell' : selectedThemeMode === 'dark' ? 'Dunkel' : selectedTheme}</div>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]">
                {appearanceExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>

            {appearanceExpanded && (
              <div className="mt-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="profile-theme-mode">Helligkeit</label>
                  <select
                    id="profile-theme-mode"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={selectedThemeMode}
                    disabled={savingAppearance}
                    onChange={(event) => {
                      const nextMode = normalizeThemeMode(event.target.value);
                      const previousMode = selectedThemeMode;
                      setSelectedThemeMode(nextMode);
                      applyTheme(selectedTheme, nextMode);
                      setSavingAppearance(true);
                      void persistProfile({ themeMode: nextMode }, 'Darstellung aktualisiert').then((saved) => {
                        if (!saved) {
                          setSelectedThemeMode(previousMode);
                          applyTheme(selectedTheme, previousMode);
                        }
                        setSavingAppearance(false);
                      });
                    }}
                  >
                    <option value="system">System (empfohlen)</option>
                    <option value="light">Hell · {DEFAULT_LIGHT_THEME}</option>
                    <option value="dark">Dunkel · {DEFAULT_DARK_THEME}</option>
                    <option value="custom">Individuelles Design-Theme</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">System nutzt hell das Standard-Theme und dunkel Catppuccin Mocha.</p>
                </div>
                {selectedThemeMode === 'custom' && <div>
                  <label className="block text-sm font-medium mb-1">{autoT('ui_b1f7fecaf7ce')}</label>
                  <ThemePicker
                    value={selectedTheme}
                    onChange={(nextTheme) => {
                      const previousTheme = selectedTheme;
                      setSelectedTheme(nextTheme);
                      const previousMode = selectedThemeMode;
                      setSelectedThemeMode('custom');
                      applyTheme(nextTheme, 'custom');
                      setSavingAppearance(true);
                      void persistProfile({ theme: nextTheme, themeMode: 'custom' }, 'Darstellung aktualisiert').then((saved) => {
                        if (!saved) {
                          setSelectedTheme(previousTheme);
                          setSelectedThemeMode(previousMode);
                          applyTheme(previousTheme, previousMode);
                        }
                        setSavingAppearance(false);
                      });
                    }}
                  />
                  {savingAppearance && <div className="mt-2 text-xs text-gray-500">{autoT('ui_ec67d4590e12')}</div>}
                </div>}
              </div>
            )}
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

function ThemePicker({ value, onChange }: { value: string; onChange: (t: string)=>void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEME_DEFINITIONS.map(t => (
          <button
            key={t.name}
            type="button"
            onClick={()=> onChange(t.name)}
            className={`border rounded p-2 text-left ${value===t.name ? "ring-2 ring-viridian" : ''}`}
          >
            <div className="font-medium text-sm">{t.name}</div>
            <div className="text-xs text-gray-500 mb-2">{t.description}</div>
            <div className="flex -space-x-1">
              {t.colors.map((c,i)=> (<span key={i} className="inline-block w-6 h-6 rounded border" style={{ backgroundColor: c }} />))}
            </div>
          </button>
        ))}
      </div>
      <div className="text-xs text-gray-500">{autoT('ui_f39141ec73c7')}</div>
    </div>
  );
}

