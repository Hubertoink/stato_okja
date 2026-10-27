import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import {
  applyTheme,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  normalizeThemeMode,
  THEME_DEFINITIONS,
  type ThemeMode,
} from '@/lib/theme';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { autoT } from '@/i18n/auto';

export default function AppearanceSettings() {
  const { user, refresh } = useAuth();
  const { showToast } = useToast();
  const theme = user?.theme || DEFAULT_LIGHT_THEME;
  const themeMode = user?.themeMode || 'system';
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [selectedThemeMode, setSelectedThemeMode] = useState<ThemeMode>(
    normalizeThemeMode(themeMode),
  );
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  useEffect(() => setSelectedTheme(theme), [theme]);
  useEffect(() => setSelectedThemeMode(normalizeThemeMode(themeMode)), [themeMode]);

  async function persistProfile(
    patch: { theme?: string; themeMode?: ThemeMode },
    successMessage: string,
  ) {
    try {
      await api.patch('/auth/me', patch);
      await refresh();
      showToast(successMessage);
      return true;
    } catch {
      showToast('Aktualisierung fehlgeschlagen', { type: 'error' });
      return false;
    }
  }
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
      <Button
        variant="ghost"
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setAppearanceExpanded((current) => !current)}
        aria-expanded={appearanceExpanded}
      >
        <div>
          <div className="text-sm font-medium">{autoT('ui_76a523492a64')}</div>
          <div className="mt-1 text-xs text-gray-500">
            {autoT('ui_0485a0265960')}{' '}
            {selectedThemeMode === 'system'
              ? 'System'
              : selectedThemeMode === 'light'
                ? 'Hell'
                : selectedThemeMode === 'dark'
                  ? 'Dunkel'
                  : selectedTheme}
          </div>
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]">
          {appearanceExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </Button>

      {appearanceExpanded && (
        <div className="mt-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="profile-theme-mode">
              Helligkeit
            </label>
            <Select
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
                void persistProfile({ themeMode: nextMode }, 'Darstellung aktualisiert').then(
                  (saved) => {
                    if (!saved) {
                      setSelectedThemeMode(previousMode);
                      applyTheme(selectedTheme, previousMode);
                    }
                    setSavingAppearance(false);
                  },
                );
              }}
            >
              <option value="system">System (empfohlen)</option>
              <option value="light">Hell · {DEFAULT_LIGHT_THEME}</option>
              <option value="dark">Dunkel · {DEFAULT_DARK_THEME}</option>
              <option value="custom">Individuelles Design-Theme</option>
            </Select>
            <p className="mt-1 text-xs text-gray-500">
              System nutzt hell das Standard-Theme und dunkel Catppuccin Mocha.
            </p>
          </div>
          {selectedThemeMode === 'custom' && (
            <div>
              <label className="block text-sm font-medium mb-1">{autoT('ui_b1f7fecaf7ce')}</label>
              <ThemePicker
                value={selectedTheme}
                disabled={savingAppearance}
                onChange={(nextTheme) => {
                  const previousTheme = selectedTheme;
                  setSelectedTheme(nextTheme);
                  const previousMode = selectedThemeMode;
                  setSelectedThemeMode('custom');
                  applyTheme(nextTheme, 'custom');
                  setSavingAppearance(true);
                  void persistProfile(
                    { theme: nextTheme, themeMode: 'custom' },
                    'Darstellung aktualisiert',
                  ).then((saved) => {
                    if (!saved) {
                      setSelectedTheme(previousTheme);
                      setSelectedThemeMode(previousMode);
                      applyTheme(previousTheme, previousMode);
                    }
                    setSavingAppearance(false);
                  });
                }}
              />
              {savingAppearance && (
                <div className="mt-2 text-xs text-gray-500">{autoT('ui_ec67d4590e12')}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThemePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (t: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEME_DEFINITIONS.map((t) => (
          <Button
            variant="ghost"
            disabled={disabled}
            key={t.name}
            type="button"
            onClick={() => onChange(t.name)}
            className={`flex-col items-start border rounded p-2 text-left ${value === t.name ? 'ring-2 ring-viridian' : ''}`}
          >
            <div className="font-medium text-sm">{t.name}</div>
            <div className="text-xs text-gray-500 mb-2">{t.description}</div>
            <div className="flex -space-x-1">
              {t.colors.map((c, i) => (
                <span
                  key={i}
                  className="inline-block w-6 h-6 rounded border"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Button>
        ))}
      </div>
      <div className="text-xs text-gray-500">{autoT('ui_f39141ec73c7')}</div>
    </div>
  );
}
