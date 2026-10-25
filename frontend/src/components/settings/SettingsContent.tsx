import AppearanceSettings from './AppearanceSettings';
import MobileNavigationSettings from './MobileNavigationSettings';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NavigationSettings from './NavigationSettings';
import ViewDensitySettings from './ViewDensitySettings';
import SettingsCategories from '@/pages/SettingsCategories';
import SettingsTags from '@/pages/SettingsTags';
import SettingsCohorts from '@/pages/SettingsCohorts';
import SettingsTeam from '@/pages/SettingsTeam';
import SettingsLocations from '@/pages/SettingsLocations';
import SettingsProjectTemplates from '@/pages/SettingsProjectTemplates';
import SettingsOpeningHours from '@/pages/SettingsOpeningHours';
import SettingsHolidays from '@/pages/SettingsHolidays';
import type { SettingsTab } from './settingsSections';

export default function SettingsContent({ tab }: { tab: SettingsTab }) {
  const { t } = useTranslation('settings');
  switch (tab) {
    case 'appearance':
      return (
        <div className="space-y-6">
          <Link
            to="/me"
            className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3 text-viridian underline underline-offset-2"
          >
            {t('sections.profileLink')}
          </Link>
          <AppearanceSettings />
          <NavigationSettings />
          <MobileNavigationSettings />
          <ViewDensitySettings />
        </div>
      );
    case 'categories':
      return <SettingsCategories />;
    case 'tags':
      return <SettingsTags />;
    case 'cohorts':
      return <SettingsCohorts />;
    case 'team':
      return <SettingsTeam />;
    case 'locations':
      return <SettingsLocations />;
    case 'templates':
      return <SettingsProjectTemplates />;
    case 'openingHours':
      return <SettingsOpeningHours />;
    case 'holidays':
      return <SettingsHolidays />;
  }
}
