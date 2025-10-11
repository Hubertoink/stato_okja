import { useState } from 'react';
import { Folder, Tag as TagIcon, Users as UsersIcon, Calendar, MapPin } from 'lucide-react';
import SettingsTeam from './SettingsTeam';
import SettingsCategories from './SettingsCategories';
import SettingsTags from './SettingsTags';
import SettingsCohorts from './SettingsCohorts';
import SettingsLocations from './SettingsLocations';

type Tab = 'categories' | 'tags' | 'cohorts' | 'team' | 'locations';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('categories');

  const tabs = [
    { id: 'categories' as Tab, label: 'Kategorien', icon: Folder },
    { id: 'tags' as Tab, label: 'Tags', icon: TagIcon },
    { id: 'cohorts' as Tab, label: 'Kohorten', icon: Calendar },
    { id: 'team' as Tab, label: 'Team', icon: UsersIcon },
    { id: 'locations' as Tab, label: 'Einrichtungen', icon: MapPin },
  ];

  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Einstellungen</h2>


      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow mb-6 overflow-x-auto">
        <div className="flex border-b">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-viridian border-b-2 border-viridian'
                    : 'text-gray-600 hover:text-viridian'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'categories' && <SettingsCategories />}

      {activeTab === 'tags' && <SettingsTags />}

      {activeTab === 'cohorts' && <SettingsCohorts />}

      {activeTab === 'team' && <SettingsTeam />}

  {activeTab === 'locations' && <SettingsLocations />}
    </div>
  );
}
