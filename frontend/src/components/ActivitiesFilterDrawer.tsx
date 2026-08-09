import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchActivitiesFilterAvailability,
  type ActivitiesFilter,
} from '@/lib/activities';
import { useOrgScopedQueryState } from '@/lib/orgScope';
import { useTags, useCategories, useCohorts } from '@/lib/taxonomy';
import { useProjects } from '@/lib/projects';
import { useLocations } from '@/lib/locations';
import { useStaff } from '@/lib/staff';
import {
  ACTIVITY_EXECUTION_STATUS_OPTIONS,
  normalizeActivityExecutionStatus,
} from '@/lib/activityExecutionStatus';
import { useTranslation } from 'react-i18next';
import { compareLocalized } from '@/i18n/formatters';
import { ResponsiveFilterPanel } from './ui/ResponsiveFilterPanel';
import { Input } from './ui/Field';

export default function ActivitiesFilterDrawer({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: ActivitiesFilter;
  onClose: () => void;
  onApply: (f: ActivitiesFilter) => void;
}) {
  const { t } = useTranslation('activities');
  const { scope, scopeKey, ready } = useOrgScopedQueryState();
  const [f, setF] = useState<ActivitiesFilter>(initial);
  useEffect(() => {
    if (!open) return;
    setF(initial);
  }, [open, initial]);

  const { data: tags = [] } = useTags({ active: true });
  const { data: categories = [] } = useCategories({ active: true });
  const { data: cohorts = [] } = useCohorts({ active: true });
  const { data: projects = [] } = useProjects();
  const { data: locations = [] } = useLocations({ active: true });
  const { data: staff = [] } = useStaff({ active: true });
  const availabilityQuery = useQuery({
    queryKey: ['activities-filter-taxonomy-availability', scopeKey],
    queryFn: () => fetchActivitiesFilterAvailability(scope),
    enabled: open && ready,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const availableCategoryIds = useMemo(
    () => new Set(availabilityQuery.data?.categoryIds ?? []),
    [availabilityQuery.data?.categoryIds],
  );
  const availableTagIds = useMemo(
    () => new Set(availabilityQuery.data?.tagIds ?? []),
    [availabilityQuery.data?.tagIds],
  );
  const availableExecutionStatuses = useMemo(
    () =>
      new Set(
        (availabilityQuery.data?.executionStatuses ?? []).map(normalizeActivityExecutionStatus),
      ),
    [availabilityQuery.data?.executionStatuses],
  );
  const availabilityLoaded = availabilityQuery.isSuccess;
  const hasUncategorized = availabilityLoaded ? availabilityQuery.data.hasUncategorized : true;
  const availableYears = availabilityQuery.data?.availableYears ?? [];

  const toggleIn = (key: keyof ActivitiesFilter, id: string) => {
    setF((prev) => {
      const cur = new Set<string>((prev[key] as string[] | undefined) || []);
      if (key === 'categoryIds') {
        // Selecting concrete categories clears the uncategorized-only filter.
        const cur = new Set<string>((prev[key] as string[] | undefined) || []);
        if (cur.has(id)) cur.delete(id);
        else cur.add(id);
        return { ...prev, uncategorized: false, [key]: Array.from(cur) };
      }
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...prev, [key]: Array.from(cur) };
    });
  };

  const toggleUncategorized = () => {
    setF((prev) => {
      const next = !prev.uncategorized;
      return {
        ...prev,
        uncategorized: next,
        // Mutually exclusive with specific category selection
        categoryIds: next ? [] : prev.categoryIds,
      };
    });
  };

  const toggleExecutionStatus = (status: (typeof ACTIVITY_EXECUTION_STATUS_OPTIONS)[number]) => {
    setF((prev) => {
      return {
        ...prev,
        executionStatuses:
          prev.executionStatuses?.length === 1 && prev.executionStatuses[0] === status
            ? undefined
            : [status],
      };
    });
  };

  const apply = () => onApply(f);
  const sortedStaff = useMemo(
    () => [...staff].sort((left, right) => compareLocalized(left.name, right.name)),
    [staff],
  );

  return (
    <ResponsiveFilterPanel
      desktopClassName="filter-popover--activities"
      onClose={onClose}
      open={open}
      title={t('filterDrawer.title')}
    >
      <div className="space-y-3">
        {/* Zeitraum */}
        <section>
          <h4 className="font-semibold text-viridian mb-2">{t('filterDrawer.period')}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              type="date"
              value={f.from || ''}
              aria-label={t('filterDrawer.fromDate')}
              onChange={(e) => setF({ ...f, from: e.target.value || undefined })}
            />
            <Input
              type="date"
              value={f.to || ''}
              aria-label={t('filterDrawer.toDate')}
              onChange={(e) => setF({ ...f, to: e.target.value || undefined })}
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            {[
              {
                label: t('filterDrawer.currentMonth'),
                range: (() => {
                  const n = new Date();
                  const y = n.getFullYear();
                  const m = n.getMonth() + 1;
                  return {
                    from: `${y}-${String(m).padStart(2, '0')}-01`,
                    to: `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`,
                  };
                })(),
              },
              {
                label: t('filterDrawer.lastThirtyDays'),
                range: (() => {
                  const t = new Date();
                  const f = new Date();
                  f.setDate(t.getDate() - 30);
                  const s = (d: Date) =>
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  return { from: s(f), to: s(t) };
                })(),
              },
              ...availableYears.map((year) => ({
                label: year,
                range: { from: `${year}-01-01`, to: `${year}-12-31` },
              })),
            ].map((p) => (
              <button
                key={p.label}
                className="px-2 py-1 rounded bg-azure-web hover:bg-mint-green text-viridian"
                onClick={() => setF({ ...f, ...p.range })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* Typen */}
        <section>
          <h4 className="font-semibold text-viridian mb-2">{t('filterDrawer.activityTypes')}</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm lg:grid-cols-3">
            {['open_door', 'project_open', 'project_closed', 'event', 'outreach'].map((typeKey) => (
              <label key={typeKey} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!f.types?.includes(typeKey)}
                  onChange={() => toggleIn('types', typeKey)}
                />
                <span>
                  {t(`types.${typeKey}`)}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Einrichtungen & Projekte */}
        <details className="activity-filter-section" open={Boolean(f.locationIds?.length || f.projectIds?.length)}>
          <summary>{t('filterDrawer.locationsProjects')}</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm lg:grid-cols-2">
            <div>
              <div className="text-xs text-gray-600 mb-1">{t('filters.locations')}</div>
              <div className="max-h-48 md:max-h-64 overflow-auto border rounded p-2 space-y-1">
                {locations.map((l) => (
                  <label key={l.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!f.locationIds?.includes(l.id)}
                      onChange={() => toggleIn('locationIds', l.id)}
                    />
                    <span>{l.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">{t('filters.projects')}</div>
              <div className="max-h-48 md:max-h-64 overflow-auto border rounded p-2 space-y-1">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!f.projectIds?.includes(p.id)}
                      onChange={() => toggleIn('projectIds', p.id)}
                    />
                    <span>{p.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </details>

        <details className="activity-filter-section" open={Boolean(f.staffIds?.length)}>
          <summary>{t('filters.staff')}</summary>
          <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-[var(--border-subtle)] p-2 text-sm space-y-1">
            {sortedStaff.length > 0 ? (
              sortedStaff.map((member) => (
                <label key={member.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!f.staffIds?.includes(member.id)}
                    onChange={() => toggleIn('staffIds', member.id)}
                  />
                  <span>{member.name}</span>
                </label>
              ))
            ) : (
              <div className="text-sm text-gray-500 px-1 py-2">{t('filterDrawer.noStaff')}</div>
            )}
          </div>
        </details>

        {/* Kategorien & Tags */}
        <details className="activity-filter-section" open={Boolean(f.uncategorized || f.categoryIds?.length || f.tagIds?.length)}>
          <summary>{t('filterDrawer.categoriesTags')}</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm lg:grid-cols-2">
            <div>
              <div className="text-xs text-gray-600 mb-1">{t('filters.categories')}</div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const active = !!f.uncategorized;
                  const present = hasUncategorized;
                  const base = present
                    ? "bg-azure-web text-viridian"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed";
                  const disabled = !present && !active;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (!disabled) toggleUncategorized();
                      }}
                      disabled={disabled}
                      title={
                        disabled
                          ? t('filterDrawer.noUncategorized')
                          : undefined
                      }
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? "bg-viridian text-white border-viridian"
                          : `${base} border-transparent`
                      } ${present ? '' : "opacity-80"}`}
                    >
                      {t('filters.uncategorized')}
                    </button>
                  );
                })()}
                {categories.map((c) => {
                  const active = !!f.categoryIds?.includes(c.id);
                  const present = availabilityLoaded ? availableCategoryIds.has(c.id) : true;
                  const base = present
                    ? "bg-azure-web text-viridian"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed";
                  const disabled = !present && !active;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (!disabled) toggleIn('categoryIds', c.id);
                      }}
                      disabled={disabled}
                      title={disabled ? t('filterDrawer.noCategoryActivities') : undefined}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? "bg-viridian text-white border-viridian"
                          : `${base} border-transparent`
                      } ${present ? '' : "opacity-80"}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">{t('filters.tags')}</div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = !!f.tagIds?.includes(tag.id);
                  const present = availabilityLoaded ? availableTagIds.has(tag.id) : true;
                  const base = present
                    ? "bg-azure-web text-viridian"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed";
                  const disabled = !present && !active;
                  return (
                    <button
                      key={tag.id}
                      onClick={() => {
                        if (!disabled) toggleIn('tagIds', tag.id);
                      }}
                      disabled={disabled}
                      title={disabled ? t('filterDrawer.noTagActivities') : undefined}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? "bg-viridian text-white border-viridian"
                          : `${base} border-transparent`
                      } ${present ? '' : "opacity-80"}`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </details>

        {/* Weitere Filter */}
        <details className="activity-filter-section" open={Boolean(f.hasNotes || f.executionStatuses?.length || f.cohortIds?.length || typeof f.participantsMin === 'number' || typeof f.participantsMax === 'number' || typeof f.durationMin === 'number' || typeof f.durationMax === 'number')}>
          <summary>{t('filterDrawer.moreFilters')}</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm lg:grid-cols-2">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!f.hasNotes}
                onChange={(e) => setF({ ...f, hasNotes: e.target.checked })}
              />
              <span>{t('filters.onlyNotes')}</span>
            </label>
            <div>
              <div className="text-xs text-gray-600 mb-1">{t('filters.status')}</div>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_EXECUTION_STATUS_OPTIONS.map((status) => {
                  const active = !!f.executionStatuses?.includes(status);
                  const present = availabilityLoaded ? availableExecutionStatuses.has(status) : true;
                  const base = present
                    ? "bg-azure-web text-viridian"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed";
                  const disabled = !present && !active;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        if (!disabled) toggleExecutionStatus(status);
                      }}
                      disabled={disabled}
                      title={disabled ? t('filterDrawer.noStatusActivities') : undefined}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? "bg-cambridge-blue text-white border-cambridge-blue"
                          : `${base} border-transparent`
                      } ${present ? '' : "opacity-80"}`}
                    >
                      {t(`filterDrawer.${status}`)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">{t('filterDrawer.ageCohorts')}</div>
              <div className="flex flex-wrap gap-2">
                {cohorts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleIn('cohortIds', c.id)}
                    className={`text-xs px-2 py-1 rounded-full border ${f.cohortIds?.includes(c.id) ? "bg-cambridge-blue text-white border-cambridge-blue" : "bg-azure-web text-viridian border-transparent"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-600 mb-1">{t('filterDrawer.participantsTotal')}</div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder={t('filterDrawer.min')}
                    value={f.participantsMin ?? ''}
                    onChange={(e) =>
                      setF({
                        ...f,
                        participantsMin: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder={t('filterDrawer.max')}
                    value={f.participantsMax ?? ''}
                    onChange={(e) =>
                      setF({
                        ...f,
                        participantsMax: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">{t('filterDrawer.durationMinutes')}</div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder={t('filterDrawer.min')}
                    value={f.durationMin ?? ''}
                    onChange={(e) =>
                      setF({
                        ...f,
                        durationMin: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder={t('filterDrawer.max')}
                    value={f.durationMax ?? ''}
                    onChange={(e) =>
                      setF({
                        ...f,
                        durationMax: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </details>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-3 sm:flex-row sm:items-center sm:justify-between">
          <div />
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={onClose}
            >
              {t('filterDrawer.close')}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition-colors"
              onClick={apply}
            >
              {t('filterDrawer.apply')}
            </button>
          </div>
        </div>
      </div>
    </ResponsiveFilterPanel>
  );
}
