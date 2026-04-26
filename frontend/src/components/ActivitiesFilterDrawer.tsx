import Modal from './Modal';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ActivitiesFilter } from '@/lib/activities';
import { useOrgScopeKey } from '@/lib/orgScope';
import { useTags, useCategories, useCohorts } from '@/lib/taxonomy';
import { useProjects } from '@/lib/projects';
import { useLocations } from '@/lib/locations';
import { useStaff } from '@/lib/staff';
import { api } from '@/lib/api';
import {
  ACTIVITY_EXECUTION_STATUS_LABELS,
  ACTIVITY_EXECUTION_STATUS_OPTIONS,
  normalizeActivityExecutionStatus,
} from '@/lib/activityExecutionStatus';

type ActivitiesTaxonomyAvailability = {
  categoryIds: string[];
  tagIds: string[];
  executionStatuses: Array<(typeof ACTIVITY_EXECUTION_STATUS_OPTIONS)[number]>;
  hasUncategorized: boolean;
};

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
  const scopeKey = useOrgScopeKey();
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
    queryFn: async () => {
      const res = await api.get('/activities');
      const list: Array<{
        tags?: Array<{ id: string }>;
        categories?: Array<{ id: string }>;
        executionStatus?: string | null;
      }> = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];

      const categoryIds = new Set<string>();
      const tagIds = new Set<string>();
      const executionStatuses = new Set<(typeof ACTIVITY_EXECUTION_STATUS_OPTIONS)[number]>();
      let hasUncategorized = false;

      for (const activity of list) {
        executionStatuses.add(normalizeActivityExecutionStatus(activity.executionStatus));
        if (!Array.isArray(activity.categories) || activity.categories.length === 0) {
          hasUncategorized = true;
        }
        for (const category of activity.categories || []) {
          if (category?.id) categoryIds.add(category.id);
        }
        for (const tag of activity.tags || []) {
          if (tag?.id) tagIds.add(tag.id);
        }
      }

      return {
        categoryIds: Array.from(categoryIds),
        tagIds: Array.from(tagIds),
        executionStatuses: Array.from(executionStatuses),
        hasUncategorized,
      } satisfies ActivitiesTaxonomyAvailability;
    },
    enabled: open,
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
    () => new Set(availabilityQuery.data?.executionStatuses ?? []),
    [availabilityQuery.data?.executionStatuses],
  );
  const availabilityLoaded = availabilityQuery.isSuccess;
  const hasUncategorized = availabilityLoaded ? availabilityQuery.data.hasUncategorized : true;

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
    () => [...staff].sort((left, right) => left.name.localeCompare(right.name, 'de')),
    [staff],
  );

  return (
    <Modal open={open} onClose={onClose} title="Filter" maxWidth="4xl">
      <div className="space-y-4">
        {/* Zeitraum */}
        <section>
          <h4 className="font-semibold text-viridian mb-2">Zeitraum</h4>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={f.from || ''}
              aria-label="Von-Datum"
              onChange={(e) => setF({ ...f, from: e.target.value || undefined })}
            />
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={f.to || ''}
              aria-label="Bis-Datum"
              onChange={(e) => setF({ ...f, to: e.target.value || undefined })}
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            {[
              {
                label: 'Aktueller Monat',
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
                label: 'Letzte 30 Tage',
                range: (() => {
                  const t = new Date();
                  const f = new Date();
                  f.setDate(t.getDate() - 30);
                  const s = (d: Date) =>
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  return { from: s(f), to: s(t) };
                })(),
              },
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
          <h4 className="font-semibold text-viridian mb-2">Tätigkeitstypen</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {['open_door', 'project_open', 'project_closed', 'event', 'outreach'].map((t) => (
              <label key={t} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!f.types?.includes(t)}
                  onChange={() => toggleIn('types', t)}
                />
                <span>
                  {(
                    {
                      open_door: 'Offene Tür',
                      project_open: 'Projekt (offen)',
                      project_closed: 'Projekt (geschlossen)',
                      event: 'Veranstaltung',
                      outreach: 'Aufsuchend',
                    } as Record<string, string>
                  )[t] || t}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Einrichtungen & Projekte */}
        <section>
          <h4 className="font-semibold text-viridian mb-2">Einrichtungen & Projekte</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-600 mb-1">Einrichtungen</div>
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
              <div className="text-xs text-gray-600 mb-1">Projekte</div>
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
        </section>

        <section>
          <h4 className="font-semibold text-viridian mb-2">Mitarbeitende</h4>
          <div className="max-h-48 md:max-h-64 overflow-auto border rounded p-2 space-y-1 text-sm">
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
              <div className="text-sm text-gray-500 px-1 py-2">Keine Mitarbeitenden verfügbar.</div>
            )}
          </div>
        </section>

        {/* Kategorien & Tags */}
        <section>
          <h4 className="font-semibold text-viridian mb-2">Kategorien & Tags</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-600 mb-1">Kategorien</div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const active = !!f.uncategorized;
                  const present = hasUncategorized;
                  const base = present
                    ? 'bg-azure-web text-viridian'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed';
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
                          ? 'Keine unkategorisierten Aktivitäten vorhanden'
                          : undefined
                      }
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? 'bg-viridian text-white border-viridian'
                          : `${base} border-transparent`
                      } ${present ? '' : 'opacity-80'}`}
                    >
                      Unkategorisiert
                    </button>
                  );
                })()}
                {categories.map((c) => {
                  const active = !!f.categoryIds?.includes(c.id);
                  const present = availabilityLoaded ? availableCategoryIds.has(c.id) : true;
                  const base = present
                    ? 'bg-azure-web text-viridian'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed';
                  const disabled = !present && !active;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (!disabled) toggleIn('categoryIds', c.id);
                      }}
                      disabled={disabled}
                      title={disabled ? 'Keine Aktivitäten mit dieser Kategorie vorhanden' : undefined}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? 'bg-viridian text-white border-viridian'
                          : `${base} border-transparent`
                      } ${present ? '' : 'opacity-80'}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Tags</div>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => {
                  const active = !!f.tagIds?.includes(t.id);
                  const present = availabilityLoaded ? availableTagIds.has(t.id) : true;
                  const base = present
                    ? 'bg-azure-web text-viridian'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed';
                  const disabled = !present && !active;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (!disabled) toggleIn('tagIds', t.id);
                      }}
                      disabled={disabled}
                      title={disabled ? 'Keine Aktivitäten mit diesem Tag vorhanden' : undefined}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? 'bg-viridian text-white border-viridian'
                          : `${base} border-transparent`
                      } ${present ? '' : 'opacity-80'}`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Weitere Filter */}
        <section>
          <h4 className="font-semibold text-viridian mb-2">Weitere Filter</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!f.hasNotes}
                onChange={(e) => setF({ ...f, hasNotes: e.target.checked })}
              />
              <span>Nur mit Notizen</span>
            </label>
            <div>
              <div className="text-xs text-gray-600 mb-1">Status</div>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_EXECUTION_STATUS_OPTIONS.map((status) => {
                  const active = !!f.executionStatuses?.includes(status);
                  const present = availabilityLoaded ? availableExecutionStatuses.has(status) : true;
                  const base = present
                    ? 'bg-azure-web text-viridian'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed';
                  const disabled = !present && !active;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        if (!disabled) toggleExecutionStatus(status);
                      }}
                      disabled={disabled}
                      title={disabled ? 'Keine Aktivitäten mit diesem Status vorhanden' : undefined}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? 'bg-cambridge-blue text-white border-cambridge-blue'
                          : `${base} border-transparent`
                      } ${present ? '' : 'opacity-80'}`}
                    >
                      {ACTIVITY_EXECUTION_STATUS_LABELS[status]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Alterskohorten</div>
              <div className="flex flex-wrap gap-2">
                {cohorts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleIn('cohortIds', c.id)}
                    className={`text-xs px-2 py-1 rounded-full border ${f.cohortIds?.includes(c.id) ? 'bg-cambridge-blue text-white border-cambridge-blue' : 'bg-azure-web text-viridian border-transparent'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-600 mb-1">Teilnehmende gesamt</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="min"
                    value={f.participantsMin ?? ''}
                    onChange={(e) =>
                      setF({
                        ...f,
                        participantsMin: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="max"
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
                <div className="text-xs text-gray-600 mb-1">Dauer (Minuten)</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="min"
                    value={f.durationMin ?? ''}
                    onChange={(e) =>
                      setF({
                        ...f,
                        durationMin: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="max"
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
        </section>

        <div className="flex flex-col gap-3 pt-4 border-t sm:flex-row sm:items-center sm:justify-between">
          <div />
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={onClose}
            >
              Schließen
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-viridian text-white hover:bg-cambridge-blue transition-colors"
              onClick={apply}
            >
              Übernehmen
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
