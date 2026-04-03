import { useState } from 'react';
import { Folder, Tag as TagIcon, Users as UsersIcon, Calendar, MapPin, Sun, LayoutTemplate, Clock, Database } from 'lucide-react';
import SettingsTeam from './SettingsTeam';
import SettingsCategories from './SettingsCategories';
import SettingsTags from './SettingsTags';
import SettingsCohorts from './SettingsCohorts';
import SettingsLocations from './SettingsLocations';
import SettingsHolidays from './SettingsHolidays';
import SettingsProjectTemplates from './SettingsProjectTemplates';
import SettingsOpeningHours from './SettingsOpeningHours';
import SettingsTestData from './SettingsTestData';
import { useAuth } from '@/lib/auth';

type Tab = 'categories' | 'templates' | 'tags' | 'cohorts' | 'team' | 'locations' | 'holidays' | 'openingHours' | 'testData';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('categories');

  const canManageTemplates = user?.role === 'superadmin' || user?.role === 'org_admin';
  const canUseTestData = user?.role === 'superadmin' || user?.role === 'org_admin';

  const tabs = [
    { id: 'categories' as Tab, label: 'Kategorien', icon: Folder },
    ...(canManageTemplates ? [{ id: 'templates' as Tab, label: 'Vorlagen', icon: LayoutTemplate }] : []),
    { id: 'tags' as Tab, label: 'Tags', icon: TagIcon },
    { id: 'cohorts' as Tab, label: 'Kohorten', icon: Calendar },
    { id: 'team' as Tab, label: 'Team', icon: UsersIcon },
    { id: 'locations' as Tab, label: 'Einrichtungen', icon: MapPin },
    { id: 'holidays' as Tab, label: 'Feiertage', icon: Sun },
    { id: 'openingHours' as Tab, label: 'Öffnungszeiten', icon: Clock },
    ...(canUseTestData ? [{ id: 'testData' as Tab, label: 'Testdaten', icon: Database }] : []),
  ];

  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Einstellungen</h2>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow mb-6 overflow-x-auto overflow-y-hidden md:overflow-x-visible md:overflow-y-visible">
        <div className="flex border-b">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`group relative inline-flex items-center justify-center lg:justify-start gap-2 px-4 py-3 font-medium transition-colors whitespace-nowrap w-12 sm:w-14 md:w-16 lg:w-auto ${
                  activeTab === tab.id
                    ? 'text-viridian border-b-2 border-viridian'
                    : 'text-gray-600 hover:text-viridian'
                }`}
              >
                <Icon className="w-5 h-5" />
                {/* Labels only on desktop to prevent tablet horizontal scroll */}
                <span className="hidden lg:inline">{tab.label}</span>
                {/* Custom tooltip for icon-only mode (mobile/tablet) */}
                <span
                  className="settings-tab-tooltip lg:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 whitespace-nowrap rounded-md bg-gray-900/95 text-white text-xs px-2 py-1 shadow-lg opacity-0 translate-y-1 transition-all duration-150"
                  role="tooltip"
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'categories' && <SettingsCategories />}

      {activeTab === 'templates' && <SettingsProjectTemplates />}

      {activeTab === 'tags' && <SettingsTags />}

      {activeTab === 'cohorts' && <SettingsCohorts />}

      {activeTab === 'team' && <SettingsTeam />}

      {activeTab === 'locations' && <SettingsLocations />}
      {activeTab === 'holidays' && <SettingsHolidays />}
      {activeTab === 'openingHours' && <SettingsOpeningHours />}
      {activeTab === 'testData' && <SettingsTestData />}
    </div>
  );
}
