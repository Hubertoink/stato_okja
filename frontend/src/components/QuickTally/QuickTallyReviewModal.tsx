import { useState, useMemo, useEffect } from 'react';
import { X, Save, Clock, MapPin, AlertCircle } from 'lucide-react';
import { useProjects, type Project } from '@/lib/projects';
import { useCohorts, useTags, useCategories } from '@/lib/taxonomy';
import { useLocations } from '@/lib/locations';
import { useStaff } from '@/lib/staff';
import { useCreateActivity } from '@/lib/activities';
import { getSelectableTaxonomyChipStyle } from '@/lib/taxonomyChipStyles';
import { useToast } from '@/components/Toast';
import type { TallySession } from './useQuickTallySession';
import { autoT } from '@/i18n/auto';

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
  const [startTime, setStartTime] = useState<string>(session.startTime);
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

  useEffect(() => {
    setStartTime(session.startTime);
  }, [session.startTime]);

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
    (project.categories || []).forEach((category) => set.add(category.id));
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
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

      await createActivity.mutateAsync({
        date: session.date,
        projectId: session.projectId,
        locationId: session.locationId || undefined,
        startTime: startTime,
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

      showToast(autoT('ui_62fbe1c2ddfe'), { type: 'success' });
      onSaved();
    } catch (error) {
      console.error('Failed to save activity:', error);
      showToast(autoT('ui_668612cbdcd6'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 flex items-end md:items-center justify-center p-0 md:p-6" style={{ backgroundColor: 'var(--overlay-backdrop)' }}>
      <div
        className="w-full md:max-w-lg rounded-t-2xl md:rounded-lg max-h-[90vh] overflow-y-auto border"
        style={{ backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
      >
        <div className="sticky top-0 border-b px-4 md:px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-xl font-bold text-viridian">{autoT('ui_f6d3cc8bec17')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          <div className="rounded-lg p-4 space-y-2 border" style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <Clock className="w-4 h-4" />
              <span className="font-medium">{formatDate(session.date)}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {startTime} – {endTime}
              </span>
            </div>
            {project && <div className="font-semibold text-viridian">{project.title}</div>}
            {location && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <MapPin className="w-4 h-4" />
                {location.name}
              </div>
            )}
          </div>

          <div className="bg-mint-green rounded-lg p-4">
            <h4 className="font-semibold text-viridian mb-3">{autoT('ui_dc230696907d')}</h4>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="summary-metric-card py-2">
                <div className="summary-metric-label text-xs">{autoT('ui_37c1e4b405c4')}</div>
                <div className="text-xl font-bold text-viridian">{totals.m}</div>
              </div>
              <div className="summary-metric-card py-2">
                <div className="summary-metric-label text-xs">{autoT('ui_2d18dfa3e9fd')}</div>
                <div className="text-xl font-bold text-viridian">{totals.w}</div>
              </div>
              <div className="summary-metric-card py-2">
                <div className="summary-metric-label text-xs">{autoT('ui_d4deea2b7d14')}</div>
                <div className="text-xl font-bold text-viridian">{totals.d}</div>
              </div>
              <div className="summary-metric-card-total py-2">
                <div className="summary-metric-label text-xs">{autoT('ui_2a8a291a83fb')}</div>
                <div className="text-2xl font-bold text-viridian">{totals.total}</div>
              </div>
            </div>
          </div>

          {cohortBreakdown.length > 0 && (
            <div>
              <h4 className="font-semibold text-viridian mb-2">{autoT('ui_acf8763813f6')}</h4>
              <div className="space-y-1">
                {cohortBreakdown.map(({ cohort, counts, total }) => (
                  <div
                    key={cohort.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div>
                      <span className="font-medium">{cohort.name}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                        ({cohort.minAge}–{cohort.maxAge}{autoT('ui_a89b17fb6a17')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span title={autoT('ui_897ccce3f38f')}>{autoT('ui_6b0d31c0d563')}{' '}{counts.m}</span>
                      <span title={autoT('ui_aeff6199c838')}>{autoT('ui_aff024fe4ab0')}{' '}{counts.w}</span>
                      <span title={autoT('ui_9a2dd276e60f')}>{autoT('ui_3c363836cf4e')}{' '}{counts.d}</span>
                      <span className="font-bold text-viridian">= {total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">{autoT('ui_4aa533c84189')}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
              style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{autoT('ui_352471b9c9cc')}</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
              style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{autoT('ui_81bb3e27efd1')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={autoT('ui_b2459f8b2a18')}
              className="w-full border rounded-lg px-4 py-3"
              style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>

          {!isOpenDoor && (categories || []).length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">{autoT('ui_4e1e15e17610')}</label>
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
                      style={getSelectableTaxonomyChipStyle(active, bg)}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(tags || []).length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">{autoT('ui_848eed0fbd54')}</label>
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
                      style={getSelectableTaxonomyChipStyle(active, bg)}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(staff || []).filter((s) =>
            Array.isArray(s.roles)
              ? s.roles.includes('lead') || s.roles.includes('employee')
              : s.role === 'lead' || s.role === 'employee'
          ).length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">{autoT('ui_93d76ef57f64')}</label>
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
                        className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                        style={active
                          ? { backgroundColor: 'var(--cambridge-blue)', color: '#fff', borderColor: 'var(--cambridge-blue)' }
                          : { backgroundColor: 'var(--surface-1)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                      >
                        {s.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {(staff || []).filter((s) =>
            Array.isArray(s.roles)
              ? s.roles.includes('volunteer') || s.roles.includes('helper')
              : s.role === 'volunteer' || s.role === 'helper'
          ).length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">{autoT('ui_4ac524334f49')}</label>
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
                        className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                        style={active
                          ? { backgroundColor: 'var(--mint-green)', color: 'var(--text-primary)', borderColor: 'var(--mint-green)' }
                          : { backgroundColor: 'var(--surface-1)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                      >
                        {s.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">{autoT('ui_6139cff2b081')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={autoT('ui_d73e0e0799f9')}
              className="w-full border rounded-lg px-4 py-3 resize-none"
              style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>

          {totals.total === 0 && (
            <div className="flex items-center gap-2 text-amber-600 rounded-lg p-3" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{autoT('ui_1ecada05b583')}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border px-6 py-3 rounded-lg font-medium transition-colors"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-1)' }}
            >{autoT('ui_4080624342b2')}</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || totals.total === 0}
              className="flex-1 theme-accent-solid-button px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>{autoT('ui_3b922c6b470b')}</>
              ) : (
                <>
                  <Save className="w-5 h-5" />{autoT('ui_70b73bbc118d')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
