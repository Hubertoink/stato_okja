import { useEffect, useState } from 'react';
import { Folder, Tag as TagIcon, Users as UsersIcon, Calendar, MapPin, Sun, LayoutTemplate, Clock, Menu, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import SettingsTeam from './SettingsTeam';
import SettingsCategories from './SettingsCategories';
import SettingsTags from './SettingsTags';
import SettingsCohorts from './SettingsCohorts';
import SettingsLocations from './SettingsLocations';
import SettingsHolidays from './SettingsHolidays';
import SettingsProjectTemplates from './SettingsProjectTemplates';
import SettingsOpeningHours from './SettingsOpeningHours';
import { useAuth } from '@/lib/auth';
import { useIsMobile } from '@/lib/useIsMobile';
import DemoHoverHint from '@/demo/DemoHoverHint';

type Tab = 'categories' | 'templates' | 'tags' | 'cohorts' | 'team' | 'locations' | 'holidays' | 'openingHours';
const VALID_TABS: ReadonlySet<string> = new Set<Tab>(['categories', 'templates', 'tags', 'cohorts', 'team', 'locations', 'holidays', 'openingHours']);

const SETTINGS_DEMO_DESCRIPTION_BY_TAB: Record<Tab, string> = {
  categories: 'Kategorien geben der Dokumentation eine feste fachliche Struktur. Sie machen sichtbar, welche Schwerpunkte eine Aktivität abdeckt, und halten Erfassung und Auswertung vergleichbar.',
  templates: 'Vorlagen übersetzen wiederkehrende Angebotsformen in vorbereitete Projekte. So startet die Dokumentation konsistent, statt jedes Mal dieselben Grunddaten neu zu setzen.',
  tags: 'Tags ergänzen Kategorien um flexible Merkmale. Sie helfen, besondere Themen, Methoden oder Zielsetzungen später gezielt zu filtern und auszuwerten.',
  cohorts: 'Kohorten definieren die Altersgruppen, nach denen Teilnahmen dokumentiert werden. Dadurch bleiben Eingaben im Alltag schnell und die Auswertung spricht dieselbe Sprache.',
  team: 'Teamdaten ordnen Aktivitäten den beteiligten Mitarbeitenden zu. Das schafft Nachvollziehbarkeit für die Dokumentation, ohne in jedem Eintrag Namen neu pflegen zu müssen.',
  locations: 'Einrichtungen bilden die Orte der Arbeit ab. Sie verbinden Angebote mit Standorten und ermöglichen später standortbezogene Kalender- und Statistikansichten.',
  holidays: 'Feiertage markieren Tage, die für Planung und Auswertung besonders sind. Das Dokumentationstool kann Aktivitäten dadurch besser in den richtigen Kalenderkontext setzen.',
  openingHours: 'Öffnungszeiten beschreiben den regulären Angebotsrahmen. Sie geben Kalender und Dokumentation eine gemeinsame Grundlage dafür, wann Arbeit üblicherweise stattfindet.',
};

export default function Settings() {
  const { user } = useAuth();
  const isMobile = useIsMobile(768);
  const [params] = useSearchParams();
  const tabParam = params.get('tab') || '';
  const initialTab: Tab = VALID_TABS.has(tabParam) ? (tabParam as Tab) : 'categories';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canManageTemplates = user?.role === 'superadmin' || user?.role === 'org_admin';

  const tabs = [
    { id: 'categories' as Tab, label: 'Kategorien', icon: Folder },
    ...(canManageTemplates ? [{ id: 'templates' as Tab, label: 'Vorlagen', icon: LayoutTemplate }] : []),
    { id: 'tags' as Tab, label: 'Tags', icon: TagIcon },
    { id: 'cohorts' as Tab, label: 'Kohorten', icon: Calendar },
    { id: 'team' as Tab, label: 'Team', icon: UsersIcon },
    { id: 'locations' as Tab, label: 'Einrichtungen', icon: MapPin },
    { id: 'holidays' as Tab, label: 'Feiertage', icon: Sun },
    { id: 'openingHours' as Tab, label: 'Öffnungszeiten', icon: Clock },
  ];
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Einstellungen</h2>

      {/* Tab Navigation */}
      <DemoHoverHint
        title="Einstellungsbereiche"
        description="Die Einstellungsbereiche sind die gemeinsame Stammdatenbasis des Dokumentationstools. Hier werden Begriffe, Orte, Gruppen und Zeitregeln gepflegt, auf die Erfassung, Kalender und Auswertungen zurückgreifen."
        placement="bottom"
      >
        {isMobile ? (
          <div className="relative mb-6 z-20">
            {mobileMenuOpen && (
              <button
                type="button"
                aria-label="Menü schließen"
                className="fixed inset-0 z-10 bg-transparent"
                onClick={() => setMobileMenuOpen(false)}
              />
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="settings-mobile-trigger relative z-20 w-full flex items-center justify-between gap-4 rounded-lg px-4 py-4 text-left"
              aria-expanded={mobileMenuOpen}
              aria-controls="settings-mobile-navigation"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="settings-mobile-icon-shell inline-flex items-center justify-center w-11 h-11 rounded-2xl shrink-0">
                  <activeTabMeta.icon className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <div className="settings-mobile-trigger-label text-xs font-semibold uppercase tracking-[0.18em]">Bereich</div>
                  <div className="text-base font-semibold text-viridian truncate">{activeTabMeta.label}</div>
                </div>
              </div>
              <span className="settings-mobile-trigger-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium shrink-0">
                Menü
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </span>
            </button>

            {mobileMenuOpen && (
              <div
                id="settings-mobile-navigation"
                className="settings-mobile-menu absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl px-3 py-3 shadow-2xl backdrop-blur"
              >
                <div className="flex flex-col gap-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`settings-mobile-option w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                          active
                            ? 'settings-mobile-option-active shadow-sm'
                            : ''
                        }`}
                      >
                        <span className={`settings-mobile-icon-shell inline-flex items-center justify-center w-10 h-10 rounded-xl ${active ? 'settings-mobile-icon-shell-active' : ''}`}>
                          <Icon className="w-5 h-5" />
                        </span>
                        <span className="font-medium">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="settings-nav-surface mb-6 overflow-x-auto overflow-y-hidden rounded-lg md:overflow-x-visible md:overflow-y-visible">
            <div className="flex">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.label}
                    className={`settings-tab-button group relative inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 py-3 font-medium transition-colors sm:w-14 md:w-16 xl:w-auto xl:justify-start xl:px-4 ${
                      activeTab === tab.id
                        ? 'settings-tab-button-active'
                        : ''
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="hidden xl:inline">{tab.label}</span>
                    <span
                      className="settings-tab-tooltip xl:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 whitespace-nowrap rounded-md bg-gray-900/95 text-white text-xs px-2 py-1 shadow-lg opacity-0 translate-y-1 transition-all duration-150"
                      role="tooltip"
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DemoHoverHint>

      {/* Tab Content */}
      <DemoHoverHint
        title={activeTabMeta.label}
        description={SETTINGS_DEMO_DESCRIPTION_BY_TAB[activeTab]}
        placement="bottom"
      >
        {activeTab === 'categories' && <SettingsCategories />}

        {activeTab === 'templates' && <SettingsProjectTemplates />}

        {activeTab === 'tags' && <SettingsTags />}

        {activeTab === 'cohorts' && <SettingsCohorts />}

        {activeTab === 'team' && <SettingsTeam />}

        {activeTab === 'locations' && <SettingsLocations />}
        {activeTab === 'holidays' && <SettingsHolidays />}
        {activeTab === 'openingHours' && <SettingsOpeningHours />}
      </DemoHoverHint>
    </div>
  );
}
