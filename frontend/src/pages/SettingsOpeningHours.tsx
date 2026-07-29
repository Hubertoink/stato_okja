import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOpeningHours, updateOpeningHours, OpeningHours, DayOpeningHours, DEFAULT_OPENING_HOURS } from '@/lib/orgs';
import { useAuth } from '@/lib/auth';
import { useOrgScope } from '@/lib/orgScope';
import { Save as SaveIcon, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DAYS: Array<keyof OpeningHours> = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function SettingsOpeningHours() {
  const { t } = useTranslation(['settings', 'common']);
  const { user } = useAuth();
  const { scope } = useOrgScope();
  const qc = useQueryClient();

  // Determine effective orgId: for superadmin use scope, for others use user.orgId
  // scope can be: undefined (global), null (root), or a string (specific orgId)
  const effectiveOrgId = user?.role === 'superadmin'
    ? (typeof scope === 'string' ? scope : null)
    : (user?.orgId ?? null);

  const { data: savedHours, isLoading } = useQuery({
    queryKey: ['opening-hours', effectiveOrgId],
    queryFn: () => getOpeningHours(effectiveOrgId!),
    enabled: !!effectiveOrgId,
  });

  const [hours, setHours] = useState<OpeningHours>(DEFAULT_OPENING_HOURS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (savedHours) {
      setHours(savedHours);
    } else {
      // Reset to defaults when switching org
      setHours(DEFAULT_OPENING_HOURS);
    }
    setDirty(false);
  }, [savedHours, effectiveOrgId]);

  const mutation = useMutation({
    mutationFn: () => updateOpeningHours(effectiveOrgId!, hours),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opening-hours', effectiveOrgId] });
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

  if (!effectiveOrgId) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          {user?.role === 'superadmin'
            ? t('openingHours.selectOrg')
            : t('openingHours.noOrg')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t('openingHours.title')}
          </h3>
          <p className="text-gray-600">{t('openingHours.subtitle')}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition disabled:opacity-50"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <SaveIcon className="w-5 h-5" />
          {t('common:actions.save')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">{t('openingHours.loading')}</p>
      ) : (
        <div className="space-y-3">
          {DAYS.map((key) => {
            const day = hours[key];
            return (
              <div key={key} className="flex flex-col gap-3 py-3 border-b last:border-0 sm:flex-row sm:items-center">
                {/* Day name and toggle */}
                <label className="flex items-center gap-3 sm:min-w-[140px]">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-viridian rounded focus:ring-viridian"
                    checked={day.open}
                    onChange={(e) => updateDay(key, { open: e.target.checked })}
                  />
                  <span className="font-medium text-gray-800 w-24">{t(`openingHours.days.${key}`)}</span>
                </label>

                {/* Time inputs */}
                {day.open ? (
                  <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-wrap">
                    <div className="flex min-w-0 flex-1 items-center gap-1 sm:flex-initial">
                      <label className="text-sm text-gray-600">{t('openingHours.from')}</label>
                      <input
                        type="time"
                        className="min-w-0 flex-1 border rounded px-2 py-1 text-sm sm:w-auto sm:flex-none"
                        value={day.from || '08:00'}
                        onChange={(e) => updateDay(key, { from: e.target.value })}
                      />
                    </div>
                    <span className="shrink-0 text-gray-400">–</span>
                    <div className="flex min-w-0 flex-1 items-center gap-1 sm:flex-initial">
                      <label className="text-sm text-gray-600">{t('openingHours.to')}</label>
                      <input
                        type="time"
                        className="min-w-0 flex-1 border rounded px-2 py-1 text-sm sm:w-auto sm:flex-none"
                        value={day.to || '17:00'}
                        onChange={(e) => updateDay(key, { to: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400 italic">{t('openingHours.closed')}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mutation.isSuccess && (
        <p className="mt-4 text-sm text-green-600">{t('openingHours.saved')}</p>
      )}
      {mutation.isError && (
        <p className="mt-4 text-sm text-red-600">{t('openingHours.saveError')}</p>
      )}
    </div>
  );
}
