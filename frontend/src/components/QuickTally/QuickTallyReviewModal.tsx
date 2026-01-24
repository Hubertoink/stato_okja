import { useState, useMemo, useEffect } from 'react';
import { X, Save, Clock, MapPin, AlertCircle } from 'lucide-react';
import { useProjects, type Project } from '@/lib/projects';
import { useCohorts, useTags, useCategories } from '@/lib/taxonomy';
import { useLocations } from '@/lib/locations';
import { useStaff } from '@/lib/staff';
import { useCreateActivity } from '@/lib/activities';
import { useToast } from '@/components/Toast';
import type { TallySession } from './useQuickTallySession';

interface QuickTallyReviewModalProps {
  session: TallySession;
  onClose: () => void;
  onSaved: () => void;
}

export default function QuickTallyReviewModal({
  session,
  onClose,
  onSaved,
}: QuickTallyReviewModalProps) {
  const { data: projects } = useProjects({ archived: false });
  const { data: cohorts } = useCohorts({ active: true });
  const { data: locations } = useLocations({ active: true });
  const { data: tags } = useTags({ active: true });
  const { data: categories } = useCategories({ active: true });
  const { data: staff } = useStaff({ active: true });
  const createActivity = useCreateActivity();
  const { showToast } = useToast();

  const [endTime, setEndTime] = useState<string>(
    `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
  );
  const [notes, setNotes] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const project = useMemo(
    () => (projects || []).find((p: Project) => p.id === session.projectId),
    [projects, session.projectId]
  );

  const location = useMemo(
    () => (locations || []).find((l) => l.id === session.locationId),
    [locations, session.locationId]
  );

  const isOpenDoor = project?.type === 'open_door';

  // Prefill tags from project defaults
  useEffect(() => {
    if (!project || !tags) return;
    const names = (project.tag || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const byName = new Map((tags || []).map((t) => [t.name, t.id] as const));
    const ids = Array.from(new Set(names.map((n) => byName.get(n)).filter(Boolean))) as string[];
    if (ids.length > 0) setSelectedTagIds(ids);
  }, [project, tags]);

  // Prefill categories from project
  useEffect(() => {
    if (!project || isOpenDoor) return;
    const set = new Set<string>();
    (project.categories || []).forEach((c: any) => set.add(c.id));
    if (project.categoryId) set.add(project.categoryId);
    if (set.size > 0) setSelectedCategoryIds(Array.from(set));
  }, [project, isOpenDoor]);

  // Prefill staff from project defaults
  useEffect(() => {
    if (!project || !staff) return;
    const names: string[] = (project.defaultStaff || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const volNames: string[] = (project.defaultVolunteers || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const byName = new Map((staff || []).map((s) => [s.name, s.id] as const));
    const ids = new Set<string>();
    [...names, ...volNames].forEach((n) => {
      const id = byName.get(n);
      if (id) ids.add(id);
    });
    if (ids.size > 0) setSelectedStaffIds(Array.from(ids));
  }, [project, staff]);

  // Calculate totals
  const totals = useMemo(() => {
    let m = 0,
      w = 0,
      d = 0;
    Object.values(session.counts).forEach((c) => {
      m += c.m || 0;
      w += c.w || 0;
      d += c.d || 0;
    });
    return { m, w, d, total: m + w + d };
  }, [session.counts]);

  // Cohort breakdown for display
  const cohortBreakdown = useMemo(() => {
    return (cohorts || [])
      .map((cohort) => {
        const counts = session.counts[cohort.id] || { m: 0, w: 0, d: 0 };
        const total = counts.m + counts.w + counts.d;
        return { cohort, counts, total };
      })
      .filter((item) => item.total > 0);
  }, [cohorts, session.counts]);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build cohorts array in the format expected by backend (same as CalendarQuickAddModal)
      const cohorts = Object.entries(session.counts)
        .filter(([_, counts]) => counts.m > 0 || counts.w > 0 || counts.d > 0)
        .map(([cohortId, counts]) => ({
          cohortId,
          m: counts.m || 0,
          w: counts.w || 0,
          d: counts.d || 0,
        }));

      // Calculate duration in minutes
      const [startH, startM] = session.startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

      await createActivity.mutateAsync({
        date: session.date,
        projectId: session.projectId,
        locationId: session.locationId || undefined,
        startTime: session.startTime,
        endTime: endTime,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        // Send totals for backwards compatibility
        countMale: totals.m,
        countFemale: totals.w,
        countDiverse: totals.d,
        countTotal: totals.total,
        // Send cohorts array (this is what the backend expects)
        cohorts,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        categoryIds: !isOpenDoor && selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        staffIds: selectedStaffIds.length > 0 ? selectedStaffIds : undefined,
        durationMinutes: durationMinutes > 0 ? durationMinutes : undefined,
        // Type derived from project or default to open_door
        type: project?.type || 'open_door',
      } as Record<string, unknown>);

      showToast('Aktivität erfolgreich gespeichert!', 'success');
      onSaved();
    } catch (error) {
      console.error('Failed to save activity:', error);
      showToast('Fehler beim Speichern. Bitte erneut versuchen.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 md:px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-viridian">Erfassung abschließen</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Summary Info */}
          <div className="bg-azure-web rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{formatDate(session.date)}</span>
              <span className="text-gray-500">
                {session.startTime} – {endTime}
              </span>
            </div>
            {project && (
              <div className="font-semibold text-viridian">{project.title}</div>
            )}
            {location && (
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <MapPin className="w-4 h-4" />
                {location.name}
              </div>
            )}
          </div>

          {/* Totals Summary */}
          <div className="bg-mint-green rounded-lg p-4">
            <h4 className="font-semibold text-viridian mb-3">Zusammenfassung</h4>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-xs text-gray-600">♂ Männlich</div>
                <div className="text-xl font-bold text-viridian">{totals.m}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">♀ Weiblich</div>
                <div className="text-xl font-bold text-viridian">{totals.w}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">⚧ Divers</div>
                <div className="text-xl font-bold text-viridian">{totals.d}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Gesamt</div>
                <div className="text-2xl font-bold text-viridian">{totals.total}</div>
              </div>
            </div>
          </div>

          {/* Cohort Breakdown */}
          {cohortBreakdown.length > 0 && (
            <div>
              <h4 className="font-semibold text-viridian mb-2">Nach Alterskohorte</h4>
              <div className="space-y-1">
                {cohortBreakdown.map(({ cohort, counts, total }) => (
                  <div
                    key={cohort.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <span className="font-medium">{cohort.name}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({cohort.minAge}–{cohort.maxAge} J.)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span title="Männlich">♂ {counts.m}</span>
                      <span title="Weiblich">♀ {counts.w}</span>
                      <span title="Divers">⚧ {counts.d}</span>
                      <span className="font-bold text-viridian">= {total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium mb-1">Endzeit</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          {/* Title (optional) */}
          <div>
            <label className="block text-sm font-medium mb-1">Titel (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Werkraum, Offene Tür"
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          {/* Categories (hidden for open_door) */}
          {!isOpenDoor && (categories || []).length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Kategorien</label>
              <div className="flex flex-wrap gap-2">
                {(categories || []).map((c) => {
                  const active = selectedCategoryIds.includes(c.id);
                  const bg = c.color || '#7aa39a';
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(selectedCategoryIds);
                        if (set.has(c.id)) set.delete(c.id);
                        else set.add(c.id);
                        setSelectedCategoryIds(Array.from(set));
                      }}
                      className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                      style={
                        active
                          ? { backgroundColor: bg, color: '#fff', borderColor: bg }
                          : { backgroundColor: '#fff', color: '#374151', borderColor: bg }
                      }
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          {(tags || []).length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {(tags || []).map((t) => {
                  const active = selectedTagIds.includes(t.id);
                  const bg = t.color || '#7aa39a';
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(selectedTagIds);
                        if (set.has(t.id)) set.delete(t.id);
                        else set.add(t.id);
                        setSelectedTagIds(Array.from(set));
                      }}
                      className="px-3 py-1.5 rounded-full text-sm border transition-colors"
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
          )}

          {/* Staff (employees/leads) */}
          {(staff || []).filter((s) =>
            Array.isArray(s.roles)
              ? s.roles.includes('lead') || s.roles.includes('employee')
              : s.role === 'lead' || s.role === 'employee'
          ).length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Mitarbeitende</label>
              <div className="flex flex-wrap gap-2">
                {(staff || [])
                  .filter((s) =>
                    Array.isArray(s.roles)
                      ? s.roles.includes('lead') || s.roles.includes('employee')
                      : s.role === 'lead' || s.role === 'employee'
                  )
                  .map((s) => {
                    const active = selectedStaffIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          const set = new Set(selectedStaffIds);
                          if (set.has(s.id)) set.delete(s.id);
                          else set.add(s.id);
                          setSelectedStaffIds(Array.from(set));
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          active 
                            ? 'bg-cambridge-blue text-white border-cambridge-blue' 
                            : 'bg-white text-gray-700 border-gray-300 hover:border-cambridge-blue'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Volunteers */}
          {(staff || []).filter((s) =>
            Array.isArray(s.roles)
              ? s.roles.includes('volunteer') || s.roles.includes('helper')
              : s.role === 'volunteer' || s.role === 'helper'
          ).length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Ehrenamtliche</label>
              <div className="flex flex-wrap gap-2">
                {(staff || [])
                  .filter((s) =>
                    Array.isArray(s.roles)
                      ? s.roles.includes('volunteer') || s.roles.includes('helper')
                      : s.role === 'volunteer' || s.role === 'helper'
                  )
                  .map((s) => {
                    const active = selectedStaffIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          const set = new Set(selectedStaffIds);
                          if (set.has(s.id)) set.delete(s.id);
                          else set.add(s.id);
                          setSelectedStaffIds(Array.from(set));
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          active 
                            ? 'bg-mint-green text-viridian border-mint-green' 
                            : 'bg-white text-gray-700 border-gray-300 hover:border-mint-green'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Notizen / Besondere Vorkommnisse
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="z.B. Konflikt zwischen Besuchern, besonderes Ereignis, Feedback..."
              className="w-full border rounded-lg px-4 py-3 resize-none"
            />
          </div>

          {/* Warning if no participants */}
          {totals.total === 0 && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">
                Keine Teilnehmenden erfasst. Bitte prüfen.
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Zurück
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || totals.total === 0}
              className="flex-1 bg-viridian text-white px-6 py-3 rounded-lg font-semibold hover:bg-cambridge-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Speichern...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Speichern
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
