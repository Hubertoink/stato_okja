import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { germanStates as states, type StateCode } from '@/lib/holidays';
import { useTranslation } from 'react-i18next';

export default function SettingsHolidays() {
  const { t } = useTranslation('settings');
  const [selected, setSelected] = useState<StateCode | ''>('');
  const [showPublicHolidays, setShowPublicHolidays] = useState(true);
  const [showSchool, setShowSchool] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('holidayPrefs');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj?.state) setSelected(obj.state as StateCode);
        if (typeof obj?.publicHolidays === 'boolean') setShowPublicHolidays(obj.publicHolidays);
        if (typeof obj?.school === 'boolean') setShowSchool(obj.school);
      }
    } catch {
      // Local storage may be unavailable or contain malformed legacy data.
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);

  // save to localStorage
  useEffect(() => {
    if (!preferencesLoaded) return;
    const payload = JSON.stringify({
      state: selected || null,
      publicHolidays: showPublicHolidays,
      school: showSchool,
    });
    localStorage.setItem('holidayPrefs', payload);
  }, [preferencesLoaded, selected, showPublicHolidays, showSchool]);

  const label = useMemo(() => {
    const s = states.find((x) => x.code === selected);
    return s ? s.name : t('holidays.none');
  }, [selected, t]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-xl font-semibold text-viridian mb-2">{t('holidays.title')}</h3>
      <p className="text-gray-600 mb-4">
        {t('holidays.intro')}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <label className="text-gray-700 font-medium">{t('holidays.state')}</label>
        <select
          className="border rounded px-3 py-2"
          value={selected}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setSelected(e.target.value as StateCode | '')
          }
        >
          <option value="">{t('holidays.select')}</option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={showPublicHolidays}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowPublicHolidays(e.target.checked)}
          />
          {t('holidays.public')}
        </label>
        <label className="inline-flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={showSchool}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowSchool(e.target.checked)}
          />
          {t('holidays.school')}
        </label>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        {selected ? (
          <>
            <div>
              {t('holidays.current', { value: `${label} (${selected})` })}
              {showPublicHolidays ? t('holidays.publicOn') : t('holidays.publicOff')}
              {showSchool ? t('holidays.schoolOn') : ''}
            </div>
            <div className="text-gray-500 mt-1">
              {t('holidays.saved')}
            </div>
          </>
        ) : (
          <div>{t('holidays.noSelection')}</div>
        )}
      </div>
    </div>
  );
}
