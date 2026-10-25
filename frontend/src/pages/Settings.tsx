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
import '@/components/settings/settings-sections.css';

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
        <nav className="configuration-tabs" aria-label={t(`sections.${section}.title`)}>
          {tabs.map((tab) => {
            const query = new URLSearchParams(params);
            query.set('tab', tab.id);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                to={{ pathname: location.pathname, search: `?${query}` }}
                className="configuration-tab"
                aria-current={tab.id === active.id ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
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
