import { useEffect, useMemo, useState } from 'react';
import { X as XIcon, Save as SaveIcon } from 'lucide-react';
import { useActivity, useUpdateActivity, Activity } from '@/lib/activities';
import { useProjects, Project } from '@/lib/projects';
import { useLocations } from '@/lib/locations';
import { useTags, useCohorts as useCohortsQuery } from '@/lib/taxonomy';
import type { Cohort } from '@/lib/taxonomy';
import { useStaff } from '@/lib/staff';
import ConfirmModal from '@/components/ConfirmModal';
import { Boxes } from 'lucide-react';
import ProjectPickerModal from './ProjectPickerModal';
import { useToast } from '@/components/Toast';

type GenderKey = 'm' | 'w' | 'd';

export default function ActivityEditModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: activity } = useActivity(id);
  const { data: projects } = useProjects({ archived: false });
  const { data: locations } = useLocations({ active: true });
  const { data: tags } = useTags({ active: true });
  const { data: cohorts } = useCohortsQuery({ active: true });
  const { data: staff } = useStaff({ active: true });
  const update = useUpdateActivity();
  const { showToast } = useToast();
  const [picker, setPicker] = useState(false);
  const [confirmMismatchOpen, setConfirmMismatchOpen] = useState(false);
  const [pendingPost, setPendingPost] = useState<null | (() => void)>(null);

  const [form, setForm] = useState<{
    projectId?: string;
    locationId?: string;
    start?: string;
    end?: string;
    title?: string;
    tagIds?: string[];
    notes?: string;
    staffIds?: string[];
    cohortCounts?: Record<string, { m: number; w: number; d: number }>;
    topCounts?: { m: number; w: number; d: number; total: number };
  }>({ cohortCounts: {} });

  useEffect(() => {
    if (!activity) return;
    const cohortCounts: Record<string, { m: number; w: number; d: number }> = {};
    // Map activity.cohorts (if present) into editable map keyed by cohortId
    if (Array.isArray(activity.cohorts)) {
      for (const c of activity.cohorts) {
        const prev = cohortCounts[c.cohortId] || { m: 0, w: 0, d: 0 };
        cohortCounts[c.cohortId] = {
          m: (prev.m || 0) + (c.m || 0),
          w: (prev.w || 0) + (c.w || 0),
          d: (prev.d || 0) + (c.d || 0),
        };
      }
    }
    const m = activity.countMale || 0;
    const w = activity.countFemale || 0;
    const d = activity.countDiverse || 0;
    setForm({
      projectId: activity.projectId || activity.project?.id || undefined,
      locationId: activity.locationId || activity.location?.id || undefined,
      start: activity.startTime || undefined,
      end: activity.endTime || undefined,
      title: activity.title || undefined,
      tagIds: (activity.tags || []).map((t) => t.id),
      notes: activity.notes || undefined,
      staffIds: (activity.staff || []).map((s) => s.id),
      cohortCounts,
      topCounts: { m, w, d, total: (activity.countTotal ?? (m + w + d)) || 0 },
    });
  }, [activity]);

  const selectedProject: Project | undefined = useMemo(
    () => (projects || []).find((p) => p.id === form.projectId),
    [projects, form.projectId]
  );

  if (!activity) return null;

  // Derive cohort sums and decide if we use cohort-based counts or top-level
  const cohortSums = useMemo(() => {
    const sums: { m: number; w: number; d: number } = { m: 0, w: 0, d: 0 };
    Object.values(form.cohortCounts || {}).forEach((e) => {
      sums.m += e.m || 0;
      sums.w += e.w || 0;
      sums.d += e.d || 0;
    });
    return sums;
  }, [form.cohortCounts]);
  const cohortTotal = cohortSums.m + cohortSums.w + cohortSums.d;
  const hasCohortData = cohortTotal > 0;
  const displayCounts = useMemo(() => {
    if (hasCohortData) {
      return { ...cohortSums, total: cohortTotal };
    }
    const t = form.topCounts || { m: 0, w: 0, d: 0, total: 0 };
    return { ...t, total: (t.m || 0) + (t.w || 0) + (t.d || 0) };
  }, [hasCohortData, cohortSums, cohortTotal, form.topCounts]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <h3 className="text-xl font-semibold text-viridian mb-2">Aktivität bearbeiten</h3>
        <div className="space-y-3">
          {/* Participants summary (editable if no cohort data) */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-viridian">Teilnehmende</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['m', 'w', 'd'] as const).map((g) => (
                <div key={g}>
                  <label className="block text-sm font-medium mb-1">{g === 'm' ? 'Männlich' : g === 'w' ? 'Weiblich' : 'Divers'}</label>
                  <input
                    type="number"
                    min={0}
                    value={displayCounts[g] ?? 0}
                    onChange={(e) => {
                      if (hasCohortData) return; // lock when cohorts present
                      const val = Number(e.target.value || 0);
                      const cur = form.topCounts || { m: 0, w: 0, d: 0, total: 0 };
                      setForm({ ...form, topCounts: { ...cur, [g]: val, total: (g === 'm' ? val : cur.m) + (g === 'w' ? val : cur.w) + (g === 'd' ? val : cur.d) } });
                    }}
                    className={`w-full border rounded px-3 py-2 ${hasCohortData ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    disabled={hasCohortData}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium mb-1">Gesamt</label>
                <input
                  type="number"
                  min={0}
                  value={displayCounts.total ?? 0}
                  readOnly
                  className="w-full border rounded px-3 py-2 bg-gray-50"
                />
              </div>
            </div>
            {hasCohortData && (
              <p className="text-xs text-gray-500 mt-1">Die Werte ergeben sich aus den Alterskohorten.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Standort *</label>
            <select
              value={form.locationId || ''}
              onChange={(e) => setForm({ ...form, locationId: e.target.value || undefined })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">— Standort wählen —</option>
              {(locations || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Titel</label>
            <input
              value={form.title || ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="z. B. Werkraum, Offene Tür"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Projekt *</label>
            {selectedProject ? (
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="w-full border rounded p-2 flex items-center gap-3 text-left"
              >
                <div className="w-12 h-10 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                  {selectedProject.imageUrl ? (
                    <img src={selectedProject.imageUrl} className="w-full h-full object-cover" />
                  ) : (
                    <Boxes className="w-6 h-6 text-gray-500" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-viridian">{selectedProject.title}</div>
                  <div className="text-xs text-gray-600">{selectedProject.targetGroup || '—'}</div>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="w-full border rounded p-3 text-left text-gray-600"
              >
                Projekt wählen…
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start</label>
              <input
                type="time"
                value={form.start || ''}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ende</label>
              <input
                type="time"
                value={form.end || ''}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          {/* Cohorts */}
          <div>
            <label className="block text-sm font-medium mb-1">Alterskohorten</label>
            <div className="text-xs text-gray-600 mb-2">Summe aktuell: m:{displayCounts.m ?? 0} · w:{displayCounts.w ?? 0} · d:{displayCounts.d ?? 0}</div>
            <div className="space-y-2">
              <div className="grid grid-cols-[auto_repeat(3,minmax(3.5rem,5rem))] items-center gap-2">
                <span className="text-xs text-gray-500" />
                <span className="text-xs text-gray-600 font-medium text-center" title="Männlich" aria-label="Männlich">
                  ♂
                </span>
                <span className="text-xs text-gray-600 font-medium text-center" title="Weiblich" aria-label="Weiblich">
                  ♀
                </span>
                <span className="text-xs text-gray-600 font-medium text-center" title="Divers" aria-label="Divers">
                  ⚧
                </span>
              </div>
              {(cohorts || []).map((c: Cohort) => {
                const entry = form.cohortCounts?.[c.id] || { m: 0, w: 0, d: 0 };
                const updateC = (g: GenderKey, val: number) =>
                  setForm({
                    ...form,
                    cohortCounts: { ...form.cohortCounts!, [c.id]: { ...entry, [g]: val } },
                  });
                return (
                  <div key={c.id} className="grid grid-cols-[auto_repeat(3,minmax(3.5rem,5rem))] items-center gap-2">
                    <span className="text-sm text-gray-700 truncate">{c.name}</span>
                    {(['m', 'w', 'd'] as const).map((g) => (
                      <input
                        key={g}
                        type="number"
                        min={0}
                        value={entry[g] ?? 0}
                        onChange={(e) => updateC(g, Number(e.target.value || 0))}
                        className="w-full border rounded px-2 py-1 text-center"
                        placeholder={g.toUpperCase()}
                        aria-label={`${c.name} ${g.toUpperCase()}`}
                      />
                    ))}
                  </div>
                );
              })}
              {!hasCohortData && (
                <p className="text-xs text-gray-500">Noch keine Kohorten erfasst – die Gesamtsummen oben sind editierbar.</p>
              )}
            </div>
          </div>
          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <div className="flex flex-wrap gap-2">
              {(tags || []).map((t) => {
                const active = form.tagIds?.includes(t.id);
                const bg = t.color || '#7aa39a';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const set = new Set(form.tagIds || []);
                      if (set.has(t.id)) set.delete(t.id);
                      else set.add(t.id);
                      setForm({ ...form, tagIds: Array.from(set) });
                    }}
                    className={`px-2 py-1 rounded-full text-xs border`}
                    style={
                      active
                        ? { backgroundColor: bg, color: '#fff', borderColor: bg }
                        : { backgroundColor: '#fff', color: '#374151', borderColor: bg }
                    }
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Staff */}
          <div>
            <label className="block text-sm font-medium mb-1">Mitarbeitende</label>
            <div className="flex flex-wrap gap-2">
              {(staff || [])
                .filter((s) =>
                  Array.isArray(s.roles)
                    ? s.roles.includes('lead') || s.roles.includes('employee')
                    : s.role === 'lead' || s.role === 'employee'
                )
                .map((s) => {
                  const active = form.staffIds?.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(form.staffIds || []);
                        if (set.has(s.id)) set.delete(s.id);
                        else set.add(s.id);
                        setForm({ ...form, staffIds: Array.from(set) });
                      }}
                      className={`px-2 py-1 rounded-full text-xs border ${active ? 'bg-cambridge-blue text-white' : 'bg-white text-gray-700'}`}
                    >
                      {s.name}
                    </button>
                  );
                })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ehrenamtliche</label>
            <div className="flex flex-wrap gap-2">
              {(staff || [])
                .filter((s) =>
                  Array.isArray(s.roles)
                    ? s.roles.includes('volunteer') || s.roles.includes('helper')
                    : s.role === 'volunteer' || s.role === 'helper'
                )
                .map((s) => {
                  const active = form.staffIds?.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(form.staffIds || []);
                        if (set.has(s.id)) set.delete(s.id);
                        else set.add(s.id);
                        setForm({ ...form, staffIds: Array.from(set) });
                      }}
                      className={`px-2 py-1 rounded-full text-xs border ${active ? 'bg-cambridge-blue text-white' : 'bg-white text-gray-700'}`}
                    >
                      {s.name}
                    </button>
                  );
                })}
            </div>
          </div>
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notizen</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-4 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 -mb-4 md:-mb-6 px-4 md:px-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
            onClick={onClose}
            title="Abbrechen"
            aria-label="Abbrechen"
          >
            <XIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
            onClick={() => {
              if (!form.projectId) return;
              if (!form.locationId) return;
              const cohortSumsLocal: Record<GenderKey, number> = { m: 0, w: 0, d: 0 };
              Object.values(form.cohortCounts || {}).forEach((e) => {
                cohortSumsLocal.m += e.m || 0;
                cohortSumsLocal.w += e.w || 0;
                cohortSumsLocal.d += e.d || 0;
              });
              const useCoh = (cohortSumsLocal.m + cohortSumsLocal.w + cohortSumsLocal.d) > 0;
              const counts = useCoh
                ? cohortSumsLocal
                : { m: form.topCounts?.m || 0, w: form.topCounts?.w || 0, d: form.topCounts?.d || 0 };
              const payload: Record<string, unknown> = {
                date: activity.date,
                startTime: form.start || null,
                endTime: form.end || null,
                type: activity.type,
                projectId: form.projectId,
                locationId: form.locationId!,
                title: form.title || null,
                notes: form.notes || null,
                tagIds: form.tagIds || [],
                staffIds: form.staffIds || [],
                durationMinutes: activity.durationMinutes,
                countMale: counts.m,
                countFemale: counts.w,
                countDiverse: counts.d,
                countTotal: counts.m + counts.w + counts.d,
                cohorts: useCoh
                  ? Object.entries(form.cohortCounts || {}).flatMap(([cohortId, gcounts]) => {
                      const arr: Array<{ cohortId: string; count: number; gender: GenderKey }> = [];
                      (['m', 'w', 'd'] as GenderKey[]).forEach((g) => {
                        const v = (gcounts as { m: number; w: number; d: number })[g] || 0;
                        if (v > 0) arr.push({ cohortId, count: v, gender: g });
                      });
                      return arr;
                    })
                  : [],
              };
              update.mutate({ id, data: payload as Partial<Activity> & Record<string, unknown> }, { onSuccess: () => { showToast('Aktivität aktualisiert'); onClose(); } });
            }}
            title="Speichern"
            aria-label="Speichern"
          >
            <SaveIcon className="w-5 h-5" />
          </button>
        </div>
        {picker && (
          <ProjectPickerModal
            onPick={(p) => {
              setForm({ ...form, projectId: p.id });
              setPicker(false);
            }}
            onClose={() => setPicker(false)}
          />
        )}
        <ConfirmModal
          open={confirmMismatchOpen}
          title="Abweichende Kohorten-Summen"
          message={`Die Summen der Alterskohorten weichen von M/W/D ab. Trotzdem speichern?`}
          onCancel={() => setConfirmMismatchOpen(false)}
          onConfirm={() => {
            setConfirmMismatchOpen(false);
            const fn = pendingPost;
            setPendingPost(null);
            if (fn) fn();
          }}
        />
      </div>
    </div>
  );
}
