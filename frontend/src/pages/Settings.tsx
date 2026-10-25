import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import DemoHoverHint from '@/demo/DemoHoverHint';
import SettingsContent from '@/components/settings/SettingsContent';
import {
  getLegacySettingsPath,
  getSettingsTabs,
  getSettingsSection,
} from '@/components/settings/settingsSections';

export default function Settings() {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const location = useLocation();
  const section = getSettingsSection(location.pathname);
  const [params] = useSearchParams();
  const tabs = getSettingsTabs(section, user?.role);
  const active = tabs.find((tab) => tab.id === params.get('tab')) || tabs[0];
  const legacyPath = section === 'personal' ? getLegacySettingsPath(params.get('tab')) : null;
  if (legacyPath)
    return (
      <Navigate
        replace
        to={{ pathname: legacyPath, search: location.search, hash: location.hash }}
      />
    );

  return (
    <div className="settings-page">
      <h2 className="text-3xl font-bold text-viridian mb-2">{t(`sections.${section}.title`)}</h2>
      <p className="mb-6 text-[var(--text-secondary)]">{t(`sections.${section}.description`)}</p>
      {tabs.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2 border-b border-[var(--border-subtle)] pb-3" aria-label={t(`sections.${section}.title`)}>
          {tabs.map((tab) => {
            const query = new URLSearchParams(params);
            query.set('tab', tab.id);
            return (
              <Link
                key={tab.id}
                to={{ pathname: location.pathname, search: `?${query}` }}
                className={`max-w-full rounded-xl px-4 py-2 text-sm font-medium break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${tab.id === active.id ? 'bg-viridian text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}`}
                aria-current={tab.id === active.id ? 'page' : undefined}
              >
                <span>{t(`tabs.${tab.id}`)}</span>
              </Link>
            );
          })}
        </nav>
      )}
      <DemoHoverHint
        title={t(`tabs.${active.id}`)}
        description={t(`descriptions.${active.id}`)}
        placement="bottom"
      >
        <SettingsContent tab={active.id} />
      </DemoHoverHint>
    </div>
  );
}
