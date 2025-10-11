import { Project, useProjects } from '@/lib/projects';
import { useEffect, useMemo, useState } from 'react';
import { Save as SaveIcon, X as XIcon, Boxes, Trash2 as TrashIcon } from 'lucide-react';
import ProjectPickerModal from './ProjectPickerModal';
import { useStaff } from '@/lib/staff';
import { useTags, useCohorts } from '@/lib/taxonomy';
import type { Activity } from '@/lib/activities';
import { useCreateActivity, useUpdateActivity, useRemoveActivity } from '@/lib/activities';
import ConfirmModal from '@/components/ConfirmModal';
import { useLocations } from '@/lib/locations';
import { useToast } from '@/components/Toast';

type GenderKey = 'm' | 'w' | 'd';

export default function ActivityQuickAdd({ dateISO, onClose, project: initialProject, activity }: { dateISO: string; onClose: () => void; project?: Project; activity?: Activity }) {
  const { data: projects } = useProjects({ archived: false });
  const { data: staff } = useStaff({ active: true });
  const { data: tags } = useTags({ active: true });
  const { data: cohorts } = useCohorts({ active: true });
  const { data: locations } = useLocations({ active: true });
  const [picker, setPicker] = useState(false);
  // mismatch confirm removed; totals derive from cohort columns now
  const [errorOpen, setErrorOpen] = useState<string | null>(null);
  const { showToast } = useToast();
  const [form, setForm] = useState<{
    date?: string;
    projectId?: string;
    locationId?: string;
    start?: string;
    end?: string;
    title?: string;
    tagIds?: string[];
    notes?: string;
    staffIds?: string[];
    // gendered cohort counts: cohortId -> { m,w,d }
    cohortCounts?: Record<string, { m: number; w: number; d: number }>;
  }>(() => {
    return { cohortCounts: {}, date: (dateISO || '').slice(0,10) };
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const selectedProject: Project | undefined = useMemo(() => (projects || []).find(p => p.id === form.projectId) || initialProject, [projects, form.projectId, initialProject]);

  useEffect(() => {
    // Default times; if project provided, prefill from defaults
    setForm((f) => ({ start: f.start || (initialProject?.defaultStartTime || '15:00'), end: f.end || (initialProject?.defaultEndTime || '17:00'), projectId: f.projectId || initialProject?.id, date: f.date || (dateISO || '').slice(0,10), ...f }));
  }, [initialProject]);
  useEffect(() => {
    // Prefill for edit mode
    if (activity) {
      setForm((f) => ({
        ...f,
        date: (activity.date || f.date || dateISO).slice(0,10),
        projectId: activity.projectId || activity.project?.id || f.projectId || initialProject?.id,
        locationId: activity.locationId || activity.location?.id || f.locationId,
        start: activity.startTime || f.start || initialProject?.defaultStartTime || '15:00',
        end: activity.endTime || f.end || initialProject?.defaultEndTime || '17:00',
        title: activity.title || f.title,
        tagIds: (activity.tags || []).map(t=>t.id),
        staffIds: (activity.staff || []).map(s=>s.id),
        notes: activity.notes || f.notes,
        cohortCounts: (() => {
          const obj: Record<string, { m: number; w: number; d: number }> = {};
          (activity.cohorts || []).forEach((c) => {
            obj[c.cohortId] = { m: c.m || 0, w: c.w || 0, d: c.d || 0 };
          });
          return Object.keys(obj).length ? obj : f.cohortCounts;
        })(),
      }));
      return;
    }
    // Default times; if project provided, prefill from defaults
    setForm((f) => ({ start: f.start || (initialProject?.defaultStartTime || '15:00'), end: f.end || (initialProject?.defaultEndTime || '17:00'), projectId: f.projectId || initialProject?.id, date: f.date || (dateISO || '').slice(0,10), ...f }));
  }, [initialProject, activity]);

  // Prefill default staff/category from project if provided
  useEffect(() => {
    if (!initialProject) return;
    setForm((f) => {
      const updated = { ...f };
      // Staff: parse CSVs, we only prefill staffIds by name match where possible
      const names = (initialProject.defaultStaff || '').split(',').map(s=>s.trim()).filter(Boolean);
      const volNames = (initialProject.defaultVolunteers || '').split(',').map(s=>s.trim()).filter(Boolean);
      const byName = new Map((staff||[]).map(s=>[s.name, s.id] as const));
      const ids = new Set<string>(f.staffIds || []);
      names.forEach(n=>{ const id = byName.get(n); if (id) ids.add(id); });
      volNames.forEach(n=>{ const id = byName.get(n); if (id) ids.add(id); });
      updated.staffIds = Array.from(ids);
      // category -> we don't store in activity payload yet; skip for now (backend accepts categoryIds)
      return updated;
    });
  }, [initialProject, staff]);

  const create = useCreateActivity();
  const update = useUpdateActivity();
  const remove = useRemoveActivity();

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-lg pt-4 md:pt-6 px-4 md:px-6 pb-0 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
  <h3 className="text-xl font-semibold text-viridian mb-2">Aktivität am {(() => { const s=(form.date||dateISO||'').slice(0,10); const [y,m,d]=s.split('-'); return `${d}.${m}.${y}`; })()}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Datum *</label>
            <input type="date" value={(form.date || '').slice(0,10)} onChange={(e)=> setForm({ ...form, date: e.target.value })} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Standort *</label>
            <select value={form.locationId || ''} onChange={(e)=> setForm({ ...form, locationId: e.target.value || undefined })} className="w-full border rounded px-3 py-2">
              <option value="">— Standort wählen —</option>
              {(locations || []).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Titel</label>
            <input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="z. B. Werkraum, Offene Tür" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Projekt *</label>
            {selectedProject ? (
              <button type="button" onClick={() => setPicker(true)} className="w-full border rounded p-2 flex items-center gap-3 text-left">
                <div className="w-12 h-10 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                  {selectedProject.imageUrl ? <img src={selectedProject.imageUrl} className="w-full h-full object-cover" /> : <Boxes className="w-6 h-6 text-gray-500" />}
                </div>
                <div>
                  <div className="font-medium text-viridian">{selectedProject.title}</div>
                  <div className="text-xs text-gray-600">{selectedProject.targetGroup || '—'}</div>
                </div>
              </button>
            ) : (
              <button type="button" onClick={() => setPicker(true)} className="w-full border rounded p-3 text-left text-gray-600">Projekt wählen…</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start</label>
              <input type="time" value={form.start || ''} onChange={(e) => setForm({ ...form, start: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ende</label>
              <input type="time" value={form.end || ''} onChange={(e) => setForm({ ...form, end: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          {/* Cohort breakdown per gender */}
          <div>
            <label className="block text-sm font-medium mb-1">Alterskohorten</label>
            <div className="space-y-2">
              {/* Column headers for gender columns */}
              <div className="grid grid-cols-[auto_repeat(3,minmax(3.5rem,5rem))] items-center gap-2">
                <span className="text-xs text-gray-500" />
                <span className="text-xs text-gray-600 font-medium text-center" title="Männlich" aria-label="Männlich">♂</span>
                <span className="text-xs text-gray-600 font-medium text-center" title="Weiblich" aria-label="Weiblich">♀</span>
                <span className="text-xs text-gray-600 font-medium text-center" title="Divers" aria-label="Divers">⚧</span>
              </div>
              {(cohorts || []).map((c) => {
                const entry = form.cohortCounts?.[c.id] || { m: 0, w: 0, d: 0 };
                const update = (g: GenderKey, val: number) => { setForm({
                  ...form,
                  cohortCounts: {
                    ...form.cohortCounts!,
                    [c.id]: { ...entry, [g]: val },
                  },
                }); };
                return (
                  <div key={c.id} className="grid grid-cols-[auto_repeat(3,minmax(3.5rem,5rem))] items-center gap-2">
                    <span className="text-sm text-gray-700 truncate">{c.name}</span>
                    {(['m','w','d'] as const).map((g) => (
                      <input key={g} type="number" min={0} value={entry[g] ?? 0} onChange={(e)=> update(g, Number(e.target.value||0))} className="w-full border rounded px-2 py-1 text-center" placeholder={g==='m'?'♂':g==='w'?'♀':'⚧'} aria-label={`${c.name} ${g.toUpperCase()}`} />
                    ))}
                  </div>
                );
              })}
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
                  <button key={t.id} type="button" onClick={() => {
                    const set = new Set(form.tagIds||[]);
                    if (set.has(t.id)) set.delete(t.id); else set.add(t.id);
                    setForm({ ...form, tagIds: Array.from(set) });
                  }} className={`px-2 py-1 rounded-full text-xs border`} style={active?{ backgroundColor: bg, color: '#fff', borderColor: bg }:{ backgroundColor: '#fff', color: '#374151', borderColor: bg }}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Staff multi-select split by roles */}
          <div>
            <label className="block text-sm font-medium mb-1">Mitarbeitende</label>
            <div className="flex flex-wrap gap-2">
              {(staff || []).filter(s=> (Array.isArray(s.roles)? s.roles.includes('lead') || s.roles.includes('employee') : (s.role==='lead' || s.role==='employee'))).map((s) => {
                const active = form.staffIds?.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => {
                    const set = new Set(form.staffIds||[]);
                    if (set.has(s.id)) set.delete(s.id); else set.add(s.id);
                    setForm({ ...form, staffIds: Array.from(set) });
                  }} className={`px-2 py-1 rounded-full text-xs border ${active?'bg-cambridge-blue text-white':'bg-white text-gray-700'}`}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ehrenamtliche</label>
            <div className="flex flex-wrap gap-2">
              {(staff || []).filter(s=> (Array.isArray(s.roles)? s.roles.includes('volunteer') || s.roles.includes('helper') : (s.role==='volunteer' || s.role==='helper'))).map((s) => {
                const active = form.staffIds?.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => {
                    const set = new Set(form.staffIds||[]);
                    if (set.has(s.id)) set.delete(s.id); else set.add(s.id);
                    setForm({ ...form, staffIds: Array.from(set) });
                  }} className={`px-2 py-1 rounded-full text-xs border ${active?'bg-cambridge-blue text-white':'bg-white text-gray-700'}`}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notizen</label>
            <textarea value={form.notes || ''} onChange={(e)=> setForm({ ...form, notes: e.target.value })} rows={3} className="w-full border rounded px-3 py-2" />
          </div>
        </div>

        <div className="mt-4 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 -mb-4 md:-mb-6 px-4 md:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700" onClick={onClose} title="Abbrechen" aria-label="Abbrechen">
              <XIcon className="w-5 h-5" />
            </button>
            {activity && (
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-full bg-red-100 text-red-700"
                onClick={() => setDeleteOpen(true)}
                title="Löschen"
                aria-label="Löschen"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-full bg-viridian text-white"
            onClick={() => {
              // Validation: require project, and per-gender sums must match
              if (!form.date) { setErrorOpen('Bitte ein Datum wählen.'); return; }
              if (!form.projectId) { setErrorOpen('Bitte ein Projekt wählen.'); return; }
              if (!form.locationId) { setErrorOpen('Bitte einen Standort wählen.'); return; }
              const cohortSums: Record<GenderKey, number> = { m: 0, w: 0, d: 0 };
              Object.values(form.cohortCounts || {}).forEach((e) => {
                cohortSums.m += e.m || 0;
                cohortSums.w += e.w || 0;
                cohortSums.d += e.d || 0;
              });
              const totalsByGender: Record<GenderKey, number> = { ...cohortSums };
              // Build payload for POST
              const toMinutes = (hhmm?: string | null) => {
                if (!hhmm) return undefined;
                const [hh, mm] = hhmm.split(':').map((v) => parseInt(v, 10));
                if (Number.isNaN(hh) || Number.isNaN(mm)) return undefined;
                return hh * 60 + mm;
              };
              const startM = toMinutes(form.start || selectedProject?.defaultStartTime || null);
              const endM = toMinutes(form.end || selectedProject?.defaultEndTime || null);
              const durationMinutes = startM !== undefined && endM !== undefined && endM >= startM ? (endM - startM) : undefined;
              const payloadBase = {
                date: (form.date || (activity?.date || dateISO)).slice(0,10),
                startTime: form.start || null,
                endTime: form.end || null,
                // Always derive activity type from selected project (matches data model)
                type: (selectedProject?.type || activity?.type || 'project_open'),
                projectId: form.projectId,
                locationId: form.locationId!,
                title: form.title || null,
                notes: form.notes || null,
                tagIds: form.tagIds || [],
                staffIds: form.staffIds || [],
                durationMinutes,
              } as Record<string, unknown>;
              // Always send per-gender cohort breakdown
              payloadBase.countMale = totalsByGender.m;
              payloadBase.countFemale = totalsByGender.w;
              payloadBase.countDiverse = totalsByGender.d;
              payloadBase.countTotal = totalsByGender.m + totalsByGender.w + totalsByGender.d;
              payloadBase.cohorts = Object.entries(form.cohortCounts || {}).map(([cohortId, gcounts]) => ({
                cohortId,
                m: (gcounts as { m: number; w: number; d: number }).m || 0,
                w: (gcounts as { m: number; w: number; d: number }).w || 0,
                d: (gcounts as { m: number; w: number; d: number }).d || 0,
              }));
              // POST/PATCH and close (error handling basic for now)
              const doCreate = () => create.mutate(payloadBase, { onSuccess: () => { showToast('Aktivität gespeichert'); onClose(); } , onError: (e: unknown)=>{
                console.error(e);
                setErrorOpen('Speichern fehlgeschlagen.');
              }});
              const doUpdate = () => update.mutate({ id: activity!.id, data: payloadBase }, { onSuccess: () => { showToast('Aktivität aktualisiert'); onClose(); } , onError: (e: unknown)=>{
                console.error(e);
                setErrorOpen('Speichern fehlgeschlagen.');
              }});
              if (activity) doUpdate(); else doCreate();
            }}
            title="Speichern"
            aria-label="Speichern"
          >
            <SaveIcon className="w-5 h-5" />
          </button>
        </div>
        {picker && (
          <ProjectPickerModal onPick={(p) => { setForm({ ...form, projectId: p.id }); setPicker(false); }} onClose={() => setPicker(false)} />
        )}
        <ConfirmModal
          open={Boolean(errorOpen)}
          title="Fehler"
          message={errorOpen || ''}
          onCancel={() => setErrorOpen(null)}
          onConfirm={() => setErrorOpen(null)}
          showCancel={false}
          confirmLabel="OK"
        />
        {activity && (
          <ConfirmModal
            open={deleteOpen}
            title="Aktivität löschen?"
            message="Diese Aktion kann nicht rückgängig gemacht werden."
            onCancel={() => setDeleteOpen(false)}
            onConfirm={() => {
              remove.mutate(activity.id, {
                onSuccess: () => {
                  showToast('Aktivität gelöscht');
                  setDeleteOpen(false);
                  onClose();
                },
                onError: (e: unknown) => {
                  console.error(e);
                  setDeleteOpen(false);
                  setErrorOpen('Löschen fehlgeschlagen.');
                },
              });
            }}
            confirmLabel="Löschen"
          />
        )}
      </div>
    </div>
  );
}
