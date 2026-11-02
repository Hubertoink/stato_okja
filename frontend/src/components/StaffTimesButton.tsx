import { useState } from 'react';
import { Clock, Minus, Plus, RotateCcw } from 'lucide-react';
import Modal from './Modal';
import { Input } from './ui/Field';
import { Button } from './ui/Button';
import type { ActivityFormState } from '@/pages/activityEditorShared';
import type { StaffMember } from '@/lib/staff';
import { STAFF_ROLE_LABEL } from './settings/EntityFormModals';
import { activityFormMinutes, customStaffTimes } from '@/lib/staffTimes';

export { activityFormMinutes } from '@/lib/staffTimes';

export function StaffTimeIndicator({ form, staffId }: { form: ActivityFormState; staffId: string }) {
  const override = customStaffTimes(form.staffTimes, form.staffIds, activityFormMinutes(form)).find(entry => entry.staffId === staffId);
  if (!override) return null;
  const label = `Angepasste Einsatzzeit: ${Math.floor(override.minutes / 60)} Std. ${override.minutes % 60} Min.`;
  return <span role="img" aria-label={label} title={label} className="ml-1 inline-flex align-middle opacity-80">
    <Clock aria-hidden="true" className="h-3 w-3 shrink-0" />
  </span>;
}

export function StaffTimesButton({
  form,
  staff,
  onChange,
}: {
  form: ActivityFormState;
  staff: StaffMember[];
  onChange: (times: NonNullable<ActivityFormState['staffTimes']>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NonNullable<ActivityFormState['staffTimes']>>([]);
  const duration = activityFormMinutes(form);
  const selected = staff.filter((member) => form.staffIds?.includes(member.id));
  const invalid = draft.some(
    (entry) =>
      !Number.isInteger(entry.minutes) ||
      entry.minutes < 0 ||
      duration === null ||
      entry.minutes > duration,
  );
  const setMinutes = (staffId: string, minutes: number) =>
    setDraft((current) => customStaffTimes([...current.filter((e) => e.staffId !== staffId), { staffId, minutes }], form.staffIds, duration));
  return (
    <>
      <Button
        variant="ghost"
        size="icon-touch"
        aria-label="Einsatzzeiten anpassen"
        title="Einsatzzeiten anpassen"
        onClick={() => {
          setDraft(customStaffTimes(form.staffTimes, form.staffIds, duration));
          setOpen(true);
        }}
      >
        <Clock aria-hidden="true" />
      </Button>
      {open && (
        <Modal open={open} onClose={() => setOpen(false)} title="Einsatzzeiten" variant="form">
          <div className="space-y-4 p-4">
            <section
              aria-label="Zeitraum der Aktivität"
              className="rounded-xl border border-[var(--interactive-soft-border)] bg-[var(--interactive-soft)] p-4"
            >
              <p className="text-xs font-medium text-[var(--text-secondary)]">Aktivitätszeitraum</p>
              {duration === null ? (
                <p className="mt-1">Bitte zuerst Start und Ende der Aktivität eingeben.</p>
              ) : (
                <>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {form.start?.slice(0, 5)} – {form.end?.slice(0, 5)} Uhr
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Gesamtdauer: {Math.floor(duration / 60)} Std. {duration % 60} Min.
                  </p>
                </>
              )}
            </section>
            <p className="text-xs text-[var(--text-secondary)]">
              Ohne Anpassung gilt die volle Aktivitätsdauer. Änderungen werden mit der Aktivität
              gespeichert.
            </p>
            {!selected.length && <p>Bitte zuerst Team-Mitglieder auswählen.</p>}
            {selected.map((member) => {
              const override = draft.find((e) => e.staffId === member.id);
              const value = override?.minutes ?? duration ?? 0;
              return (
                <div
                  key={member.id}
                  className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="block break-words">{member.name}</strong>
                        <Button
                          variant="ghost"
                          size="icon-compact"
                          disabled={!override}
                          aria-label="Aktivitätsdauer übernehmen"
                          title="Aktivitätsdauer übernehmen"
                          onClick={() =>
                            setDraft((current) => current.filter((e) => e.staffId !== member.id))
                          }
                        >
                          <RotateCcw aria-hidden="true" />
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {(Array.isArray(member.roles)
                          ? member.roles
                          : [member.role || member.roles]
                        )
                          .filter(Boolean)
                          .map((role) => STAFF_ROLE_LABEL[role!] || role)
                          .join(' · ') || 'Team-Mitglied'}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                      {override ? 'Angepasst' : 'Automatisch'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <Button variant="secondary" size="icon-touch"
                        aria-label={`${member.name}: Einsatzzeit verkürzen`}
                        disabled={duration === null || value <= 0}
                        onClick={() => setMinutes(member.id, Math.max(0, Math.ceil(value / 15) * 15 - 15))}>
                        <Minus aria-hidden="true" />
                      </Button>
                      <output className="text-lg font-semibold tabular-nums text-center" aria-live="polite">
                        {Math.floor(value / 60)} Std. {value % 60} Min.
                      </output>
                      <Button variant="secondary" size="icon-touch"
                        aria-label={`${member.name}: Einsatzzeit verlängern`}
                        disabled={duration === null || value >= duration}
                        onClick={() => setMinutes(member.id, Math.min(duration ?? 0, Math.floor(value / 15) * 15 + 15))}>
                        <Plus aria-hidden="true" />
                      </Button>
                    </div>
                    <Input type="range" min={0} max={duration || 1} step="any"
                      aria-label={`${member.name}: Einsatzzeit`}
                      aria-valuetext={`${Math.floor(value / 60)} Stunden ${value % 60} Minuten`}
                      disabled={duration === null || duration === 0}
                      value={value}
                      className="cursor-pointer disabled:cursor-not-allowed"
                      style={{ padding: 0, border: 0, boxShadow: 'none', background: 'transparent', accentColor: 'var(--viridian)', minHeight: 44 }}
                      onChange={(event) => {
                        const raw = Number(event.target.value);
                        const rounded = Math.min(duration ?? 0, Math.round(raw / 15) * 15);
                        setMinutes(member.id, Math.abs((duration ?? 0) - raw) < Math.abs(rounded - raw) ? duration ?? 0 : rounded);
                      }}
                      onKeyDown={(event) => {
                        if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                          event.preventDefault();
                          const next = event.key === 'Home' ? 0 : event.key === 'End' ? duration ?? 0
                            : ['ArrowLeft', 'ArrowDown'].includes(event.key)
                              ? Math.ceil(value / 15) * 15 - 15 : Math.floor(value / 15) * 15 + 15;
                          setMinutes(member.id, Math.max(0, Math.min(duration ?? 0, next)));
                        }
                      }}
                    />
                    <div className="flex justify-between gap-3 text-xs text-[var(--text-secondary)]" aria-hidden="true">
                      <span>0 Min.</span>
                      <span>{Math.floor((duration ?? 0) / 60)} Std. {(duration ?? 0) % 60} Min.</span>
                    </div>
                    <p className="pt-2 text-center text-xs text-[var(--text-secondary)]">In 15-Minuten-Schritten · maximal Aktivitätsdauer</p>
                  </div>
                </div>
              );
            })}
            {invalid && (
              <p role="alert" className="text-[var(--status-danger-text)]">
                Die Einsatzzeit muss zwischen 0 und {duration ?? 0} Minuten liegen.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button
                disabled={invalid}
                onClick={() => {
                  onChange(customStaffTimes(draft, form.staffIds, duration));
                  setOpen(false);
                }}
              >
                Übernehmen
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
