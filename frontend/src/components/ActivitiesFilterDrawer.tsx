import Modal from './Modal';
import { useEffect, useMemo, useState } from 'react';
import { X as XIcon } from 'lucide-react';
import type { ActivitiesFilter } from '@/lib/activities';
import { useTags, useCategories, useCohorts } from '@/lib/taxonomy';
import { useProjects } from '@/lib/projects';
import { useLocations } from '@/lib/locations';
import { api } from '@/lib/api';

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
  const [f, setF] = useState<ActivitiesFilter>(initial);
  const { data: tags = [] } = useTags({ active: true });
  const { data: categories = [] } = useCategories({ active: true });
  const { data: cohorts = [] } = useCohorts({ active: true });
  const { data: projects = [] } = useProjects();
  const { data: locations = [] } = useLocations({ active: true });

  // Compute availability of categories/tags among activities matching the current modal filter
  // (excluding categoryIds/tagIds so the user can see what would be available to select)
  // Availability is expressed via counts; sets removed to avoid unused-state warnings
  const [catCounts, setCatCounts] = useState<Map<string, number>>(new Map());
  const [tagCounts, setTagCounts] = useState<Map<string, number>>(new Map());

  // Debounce inputs to avoid spamming the API while typing
  const depsKey = useMemo(
    () =>
      JSON.stringify({
        from: f.from,
        to: f.to,
        types: f.types,
        locationIds: f.locationIds,
        projectIds: f.projectIds,
        cohortIds: f.cohortIds,
        hasNotes: f.hasNotes,
        participantsMin: f.participantsMin,
        participantsMax: f.participantsMax,
        durationMin: f.durationMin,
        durationMax: f.durationMax,
      }),
    [f],
  );

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        // Build query params like useActivities/useActivitiesPaged but without categoryIds/tagIds
        const base: ActivitiesFilter = JSON.parse(depsKey);
        const qp: Record<string, unknown> = { ...base };
        const arrayKeys: (keyof ActivitiesFilter)[] = [
          'types',
          'locationIds',
          'projectIds',
          'cohortIds',
        ];
        for (const k of arrayKeys) {
          const v = (base as Record<string, unknown>)[k as string];
          if (Array.isArray(v) && v.length) qp[k as string] = (v as string[]).join(',');
          else if (Array.isArray(v)) delete qp[k as string];
        }
        const res = await api.get('/activities', { params: qp });
        const list: Array<{
          tags?: Array<{ id: string }>;
          categories?: Array<{ id: string }>;
          project?: { type?: string | null };
        }> = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];
        const cset = new Set<string>();
        const tset = new Set<string>();
        const ccount = new Map<string, number>();
        const tcount = new Map<string, number>();
        for (const a of list) {
          for (const c of a.categories || [])
            if (c?.id) {
              cset.add(c.id);
              ccount.set(c.id, (ccount.get(c.id) || 0) + 1);
            }
          for (const t of a.tags || [])
            if (t?.id) {
              tset.add(t.id);
              tcount.set(t.id, (tcount.get(t.id) || 0) + 1);
            }
        }
        if (!cancelled) {
          setCatCounts(ccount);
          setTagCounts(tcount);
        }
      } catch {
        if (!cancelled) {
          setCatCounts(new Map());
          setTagCounts(new Map());
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [depsKey]);

  const isDirty = useMemo(() => {
    const obj = f as Record<string, unknown>;
    return Object.entries(obj).some(([k, v]) => {
      if (k === undefined) return false;
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== null && v !== '';
    });
  }, [f]);

  const toggleIn = (key: keyof ActivitiesFilter, id: string) => {
    setF((prev) => {
      const cur = new Set<string>((prev[key] as string[] | undefined) || []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...prev, [key]: Array.from(cur) };
    });
  };

  const reset = () => setF({});

  const apply = () => onApply(f);

  return (
    <Modal open={open} onClose={onClose} title="Filter" maxWidth="xl">
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
              <div className="max-h-40 overflow-auto border rounded p-2 space-y-1">
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
              <div className="max-h-40 overflow-auto border rounded p-2 space-y-1">
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

        {/* Kategorien & Tags */}
        <section>
          <h4 className="font-semibold text-viridian mb-2">Kategorien & Tags</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-600 mb-1">Kategorien</div>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const active = !!f.categoryIds?.includes(c.id);
                  const count = catCounts.get(c.id) ?? 0;
                  const present = count > 0;
                  const base = present
                    ? 'bg-azure-web text-viridian'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed';
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (present) toggleIn('categoryIds', c.id);
                      }}
                      disabled={!present}
                      title={present ? undefined : 'Keine Ergebnisse mit aktuellen Filtern'}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? 'bg-viridian text-white border-viridian'
                          : `${base} border-transparent`
                      } ${present ? '' : 'opacity-80'}`}
                    >
                      {c.name} ({count})
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
                  const count = tagCounts.get(t.id) ?? 0;
                  const present = count > 0;
                  const base = present
                    ? 'bg-azure-web text-viridian'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed';
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (present) toggleIn('tagIds', t.id);
                      }}
                      disabled={!present}
                      title={present ? undefined : 'Keine Ergebnisse mit aktuellen Filtern'}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? 'bg-viridian text-white border-viridian'
                          : `${base} border-transparent`
                      } ${present ? '' : 'opacity-80'}`}
                    >
                      {t.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Weitere Filter */}
        <section>
          <h4 className="font-semibold text-viridian mb-2">Weitere</h4>
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

        <div className="sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 -mb-4 md:-mb-6 px-4 md:px-6 flex items-center justify-between gap-3 border-t">
          <button
            aria-label="Schließen"
            title="Schließen"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border bg-white text-gray-700"
            onClick={onClose}
          >
            <XIcon className="w-4 h-4" />
          </button>
          {isDirty ? (
            <button className="text-viridian underline" onClick={reset}>
              Zurücksetzen
            </button>
          ) : (
            <span />
          )}
          <button
            className="bg-viridian text-white px-4 py-2 rounded hover:bg-cambridge-blue"
            onClick={apply}
          >
            Anwenden
          </button>
        </div>
      </div>
    </Modal>
  );
}
