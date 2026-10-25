import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, type AuthUser } from '@/lib/auth';
import { api, getAuthSessionGeneration } from '@/lib/api';
import { Input } from '@/components/ui/Field';
type NavigationLayout = 'sidebar' | 'top';
import './ViewDensitySettings.css';

export default function NavigationSettings() {
  const { t } = useTranslation('settings');
  const { user, updateSessionUser } = useAuth();
  const id = useId();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);
  const layout = user?.navigationLayout === 'top' ? 'top' : 'sidebar';

  async function selectLayout(next: NavigationLayout) {
    if (!user || saving || next === layout) return;
    const generation = getAuthSessionGeneration();
    setSaving(true);
    setStatus(null);
    try {
      const response = await api.patch<AuthUser>('/auth/me', { navigationLayout: next });
      if (generation !== getAuthSessionGeneration()) return;
      updateSessionUser(response.data);
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="modern-card p-6">
      <fieldset disabled={saving || !user} aria-describedby={`${id}-help`} aria-busy={saving}>
        <legend className="text-lg font-semibold text-[var(--text-primary)]">
          {t('navigationLayout.title')}
        </legend>
        <p id={`${id}-help`} className="mt-2 text-sm text-[var(--text-secondary)]">
          {t('navigationLayout.description')}
        </p>
        <div className="view-density-options">
          {(['sidebar', 'top'] as const).map((option) => (
            <label
              key={option}
              className={`view-density-option ${layout === option ? 'view-density-option-selected' : ''}`}
            >
              <div className="flex items-start gap-3">
                <Input
                  type="radio"
                  name={`${id}-navigation`}
                  value={option}
                  checked={layout === option}
                  onChange={() => void selectLayout(option)}
                  className="mt-1 accent-[var(--viridian)]"
                  aria-labelledby={`${id}-${option}-label`}
                  aria-describedby={`${id}-${option}-description`}
                />
                <div>
                  <span
                    id={`${id}-${option}-label`}
                    className="font-semibold text-[var(--text-primary)]"
                  >
                    {t(`navigationLayout.${option}`)}
                  </span>
                  <p
                    id={`${id}-${option}-description`}
                    className="mt-1 text-sm text-[var(--text-secondary)]"
                  >
                    {t(`navigationLayout.${option}Description`)}
                  </p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{t('navigationLayout.deviceHint')}</p>
      <p
        role={status === 'error' ? 'alert' : 'status'}
        className={`mt-2 min-h-5 text-sm ${status === 'error' ? 'text-red-600' : 'text-[var(--text-secondary)]'}`}
      >
        {saving ? t('navigationLayout.saving') : status ? t(`navigationLayout.${status}`) : ''}
      </p>
    </section>
  );
}
