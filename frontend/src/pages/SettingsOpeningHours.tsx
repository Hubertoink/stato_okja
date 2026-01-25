import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOpeningHours, updateOpeningHours, OpeningHours, DayOpeningHours, DEFAULT_OPENING_HOURS } from '@/lib/orgs';
import { useAuth } from '@/lib/auth';
import { Save as SaveIcon, Clock } from 'lucide-react';

const DAYS: Array<{ key: keyof OpeningHours; labelDe: string }> = [
  { key: 'monday', labelDe: 'Montag' },
  { key: 'tuesday', labelDe: 'Dienstag' },
  { key: 'wednesday', labelDe: 'Mittwoch' },
  { key: 'thursday', labelDe: 'Donnerstag' },
  { key: 'friday', labelDe: 'Freitag' },
  { key: 'saturday', labelDe: 'Samstag' },
  { key: 'sunday', labelDe: 'Sonntag' },
];

export default function SettingsOpeningHours() {
  const { user } = useAuth();
  const orgId = user?.orgId;
  const qc = useQueryClient();

  const { data: savedHours, isLoading } = useQuery({
    queryKey: ['opening-hours', orgId],
    queryFn: () => getOpeningHours(orgId!),
    enabled: !!orgId,
  });

  const [hours, setHours] = useState<OpeningHours>(DEFAULT_OPENING_HOURS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (savedHours) {
      setHours(savedHours);
    }
  }, [savedHours]);

  const mutation = useMutation({
    mutationFn: () => updateOpeningHours(orgId!, hours),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opening-hours', orgId] });
      setDirty(false);
    },
  });

  const updateDay = (day: keyof OpeningHours, patch: Partial<DayOpeningHours>) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
    setDirty(true);
  };

  if (!orgId) return <p className="text-gray-600">Keine Organisation ausgewählt.</p>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Öffnungszeiten
          </h3>
          <p className="text-gray-600">Öffnungszeiten der Organisation (werden im Kalender und Dashboard angezeigt)</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition disabled:opacity-50"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <SaveIcon className="w-5 h-5" />
          Speichern
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Laden...</p>
      ) : (
        <div className="space-y-3">
          {DAYS.map(({ key, labelDe }) => {
            const day = hours[key];
            return (
              <div key={key} className="flex flex-wrap items-center gap-3 py-3 border-b last:border-0">
                {/* Day name and toggle */}
                <label className="flex items-center gap-3 min-w-[140px]">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-viridian rounded focus:ring-viridian"
                    checked={day.open}
                    onChange={(e) => updateDay(key, { open: e.target.checked })}
                  />
                  <span className="font-medium text-gray-800 w-24">{labelDe}</span>
                </label>

                {/* Time inputs */}
                {day.open ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <label className="text-sm text-gray-600">Von:</label>
                      <input
                        type="time"
                        className="border rounded px-2 py-1 text-sm"
                        value={day.from || '08:00'}
                        onChange={(e) => updateDay(key, { from: e.target.value })}
                      />
                    </div>
                    <span className="text-gray-400">–</span>
                    <div className="flex items-center gap-1">
                      <label className="text-sm text-gray-600">Bis:</label>
                      <input
                        type="time"
                        className="border rounded px-2 py-1 text-sm"
                        value={day.to || '17:00'}
                        onChange={(e) => updateDay(key, { to: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400 italic">Geschlossen</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mutation.isSuccess && (
        <p className="mt-4 text-sm text-green-600">✓ Öffnungszeiten gespeichert</p>
      )}
      {mutation.isError && (
        <p className="mt-4 text-sm text-red-600">Fehler beim Speichern</p>
      )}
    </div>
  );
}
