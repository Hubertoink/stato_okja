import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, type AuthUser } from '@/lib/auth';
import { api, getAuthSessionGeneration } from '@/lib/api';
import { Input } from '@/components/ui/Field';
import { normalizeViewDensity, type ViewDensity } from '@/lib/viewDensity';
import './ViewDensitySettings.css';

export default function ViewDensitySettings() {
  const { t } = useTranslation('settings');
  const { user, updateSessionUser } = useAuth();
  const id = useId();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);
  const density = normalizeViewDensity(user?.viewDensity);

  async function selectDensity(next: ViewDensity) {
    if (!user || saving || next === density) return;
    const generation = getAuthSessionGeneration();
    setSaving(true);
    setStatus(null);
    try {
      const response = await api.patch<AuthUser>('/auth/me', { viewDensity: next });
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
        <legend className="text-lg font-semibold text-[var(--text-primary)]">{t('viewDensity.title')}</legend>
        <p id={`${id}-help`} className="mt-2 text-sm text-[var(--text-secondary)]">{t('viewDensity.description')}</p>
        <div className="view-density-options">
          {(['normal', 'compact'] as const).map((option) => (
            <label key={option} className={`view-density-option ${density === option ? 'view-density-option-selected' : ''}`}>
              <div className="view-density-preview" aria-hidden="true">
                <div className={`view-density-preview-app view-density-preview-app-${option}`}>
                  <div className="view-density-preview-header"><span /><span /><span /></div>
                  <div className="view-density-preview-content">
                    <div className="view-density-preview-title" />
                    <div className="view-density-preview-cards"><span /><span /><span /></div>
                    {Array.from({ length: option === 'compact' ? 6 : 4 }, (_, index) => (
                      <div className="view-density-preview-row" key={index}><span /><span /><span /></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Input type="radio" name={`${id}-density`} value={option} checked={density === option}
                  onChange={() => void selectDensity(option)} className="mt-1 accent-[var(--viridian)]"
                  aria-labelledby={`${id}-${option}-label`} aria-describedby={`${id}-${option}-description`} />
                <div>
                  <span id={`${id}-${option}-label`} className="font-semibold text-[var(--text-primary)]">{t(`viewDensity.${option}`)}</span>
                  <p id={`${id}-${option}-description`} className="mt-1 text-sm text-[var(--text-secondary)]">{t(`viewDensity.${option}Description`)}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{t('viewDensity.deviceHint')}</p>
      <p role={status === 'error' ? 'alert' : 'status'} className={`mt-2 min-h-5 text-sm ${status === 'error' ? 'text-red-600' : 'text-[var(--text-secondary)]'}`}>
        {saving ? t('viewDensity.saving') : status ? t(`viewDensity.${status}`) : ''}
      </p>
    </section>
  );
}
