import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { germanStates as states, type StateCode } from '@/lib/holidays';

export default function SettingsHolidays() {
  const [selected, setSelected] = useState<StateCode | ''>('');
  const [showSchool, setShowSchool] = useState(false);

  // load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('holidayPrefs');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj?.state) setSelected(obj.state as StateCode);
        if (typeof obj?.school === 'boolean') setShowSchool(obj.school);
      }
    } catch {
      // Local storage may be unavailable or contain malformed legacy data.
    }
  }, []);

  // save to localStorage
  useEffect(() => {
    const payload = JSON.stringify({ state: selected || null, school: showSchool });
    localStorage.setItem('holidayPrefs', payload);
  }, [selected, showSchool]);

  const label = useMemo(() => {
    const s = states.find((x) => x.code === selected);
    return s ? s.name : 'Kein Bundesland ausgewählt';
  }, [selected]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-xl font-semibold text-viridian mb-2">Feiertage im Kalender</h3>
      <p className="text-gray-600 mb-4">
        Wähle dein Bundesland, damit gesetzliche Feiertage im Kalender angezeigt werden. Optional
        können Schulferien eingeblendet werden.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <label className="text-gray-700 font-medium">Bundesland</label>
        <select
          className="border rounded px-3 py-2"
          value={selected}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setSelected(e.target.value as StateCode | '')
          }
        >
          <option value="">– Auswahl –</option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={showSchool}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowSchool(e.target.checked)}
          />
          Schulferien anzeigen (wenn verfügbar)
        </label>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        {selected ? (
          <>
            <div>
              Aktuelle Auswahl:{' '}
              <span className="font-medium">
                {label} ({selected})
              </span>
              {showSchool ? ' · Schulferien: an' : ''}
            </div>
            <div className="text-gray-500 mt-1">
              Die Auswahl wird lokal gespeichert und beim Kalender berücksichtigt.
            </div>
          </>
        ) : (
          <div>Es ist noch kein Bundesland ausgewählt.</div>
        )}
      </div>
    </div>
  );
}
