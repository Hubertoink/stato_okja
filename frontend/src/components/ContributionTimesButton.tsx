import './StaffTimesButton.css';
import { useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import Modal from './Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Field';
import { formatContributionMinutes, type Contribution, type Contributor } from '@/lib/contributors';

export function ContributionTimesButton({ value, people, duration, startTime, endTime, disabled, onChange }: {
  value: Contribution[]; people: Contributor[]; duration?: number | null; startTime?: string; endTime?: string;
  disabled?: boolean; onChange: (entries: Contribution[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Contribution[]>([]);
  const max = duration ?? 0;
  const invalid = !max || draft.some(entry => !Number.isInteger(entry.minutes) || entry.minutes < 1 || entry.minutes > max);
  const setMinutes = (id: string, minutes: number) => setDraft(current => current.map(entry => entry.contributorId === id ? { ...entry, minutes, automatic: minutes === max } : entry));
  return <>
    <Button variant="ghost" size="icon-touch" aria-label="Mitwirkungszeiten anpassen" title="Mitwirkungszeiten anpassen" disabled={disabled || !value.length} onClick={() => { setDraft(value.map(entry => ({ ...entry }))); setOpen(true); }}><Clock aria-hidden="true" /></Button>
    {open && <Modal open onClose={() => setOpen(false)} title="Mitwirkungszeiten" variant="form">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 p-4" role="region" aria-label="Mitwirkungszeiten">
        <section aria-label="Zeitraum der Aktivität" className="rounded-xl border border-[var(--interactive-soft-border)] bg-[var(--interactive-soft)] p-4">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Aktivitätszeitraum</p>
          {!max ? <p className="mt-1">Bitte zuerst Start und Ende der Aktivität eingeben.</p> : <>
            {startTime && endTime && <p className="mt-1 text-xl font-semibold tabular-nums">{startTime.slice(0, 5)} – {endTime.slice(0, 5)} Uhr</p>}
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Gesamtdauer: {formatContributionMinutes(max)}</p>
          </>}
        </section>
        <p className="text-xs text-[var(--text-secondary)]">Ohne Anpassung gilt die volle Aktivitätsdauer. Änderungen werden mit der Aktivität gespeichert.</p>
        {draft.map(entry => {
          const name = people.find(person => person.id === entry.contributorId)?.name || 'Mitwirkende Person';
          const minutes = entry.minutes;
          const decrease = () => setMinutes(entry.contributorId, Math.max(0, Math.ceil(minutes / 15) * 15 - 15));
          const increase = () => setMinutes(entry.contributorId, Math.min(max, Math.floor(minutes / 15) * 15 + 15));
          return <div key={entry.contributorId} className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-3">
            <strong className="block break-words border-b border-[var(--border-subtle)] pb-3">{name}</strong>
            <output className="block pb-1 text-xl font-semibold tabular-nums text-center" aria-live="polite">{minutes ? formatContributionMinutes(minutes) : 'Dauer auswählen'}</output>
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--interactive-soft)] px-1">
              <Button variant="ghost" size="icon-touch" className="shrink-0 text-viridian" aria-label={`${name}: Mitwirkungszeit verkürzen`} disabled={!max || minutes <= 0} onClick={decrease}><ChevronLeft aria-hidden="true" /></Button>
              <Input type="range" min={0} max={max || 1} step="any" aria-label={`${name}: Mitwirkungszeit`} aria-valuetext={formatContributionMinutes(minutes)} disabled={!max} value={Math.min(minutes, max)}
                className="staff-time-slider min-w-0 flex-1" style={{ '--staff-time-fill': `${Math.min(100, Math.max(0, minutes / (max || 1) * 100))}%` } as CSSProperties}
                onChange={event => { const raw = Number(event.target.value); const rounded = Math.min(max, Math.round(raw / 15) * 15); setMinutes(entry.contributorId, Math.abs(max - raw) < Math.abs(rounded - raw) ? max : rounded); }}
                onKeyDown={event => {
                  if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  if (event.key === 'Home') setMinutes(entry.contributorId, 0);
                  else if (event.key === 'End') setMinutes(entry.contributorId, max);
                  else if (['ArrowLeft', 'ArrowDown'].includes(event.key)) decrease(); else increase();
                }} />
              <Button variant="ghost" size="icon-touch" className="shrink-0 text-viridian" aria-label={`${name}: Mitwirkungszeit verlängern`} disabled={!max || minutes >= max} onClick={increase}><ChevronRight aria-hidden="true" /></Button>
            </div>
            <div className="flex justify-between gap-3 text-xs text-[var(--text-secondary)]" aria-hidden="true"><span>0 Min.</span><span>{formatContributionMinutes(max)}</span></div>
          </div>;
        })}
        {invalid && <p role="alert" className="text-[var(--status-danger-text)]">Bitte für jede Person eine positive Dauer bis höchstens zur Aktivitätsdauer auswählen.</p>}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 pb-safe">
        <Button variant="secondary" onClick={() => setOpen(false)}>Abbrechen</Button>
        <Button disabled={invalid} onClick={() => { onChange(draft); setOpen(false); }}>Übernehmen</Button>
      </div>
    </Modal>}
  </>;
}
