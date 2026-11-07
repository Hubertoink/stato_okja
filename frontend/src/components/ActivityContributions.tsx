import { resolveContributionTimes } from '@/lib/contributionTimes';
import { useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ContributionTimesButton } from './ContributionTimesButton';
import { ContributorFormModal } from './settings/ContributorFormModal';
import { getSelectableTaxonomyChipStyle } from '@/lib/taxonomyChipStyles';
import { canManageSettingsDestructiveActions, useAuth } from '@/lib/auth';
import { formatContributionMinutes, useContributors, type Contribution } from '@/lib/contributors';

export function ActivityContributions({ value, onChange, durationMinutes, startTime, endTime, completed = true }: {
  value: Contribution[]; onChange: (entries: Contribution[]) => void; durationMinutes?: number | null;
  startTime?: string; endTime?: string; completed?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const people = useContributors();
  const { user } = useAuth();
  const canCreate = canManageSettingsDestructiveActions(user?.role);
  const resolved = resolveContributionTimes(value, durationMinutes);
  const selected = new Set(value.map(entry => entry.contributorId));
  const visiblePeople = (people.data || []).filter(person => person.active || selected.has(person.id));
  return <section aria-label="Mitwirkende">
    <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="block text-sm font-medium">Mitwirkende</span>
      {canCreate && <Button variant="ghost" className="!min-h-0 !p-0 !gap-1 !text-sm !font-medium !text-viridian hover:!bg-transparent hover:!text-viridian/80" aria-label="Mitwirkende hinzufügen" disabled={!completed} onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Hinzufügen</Button>}
      <ContributionTimesButton value={value.map(entry => ({ ...entry, minutes: resolved.find(item => item.contributorId === entry.contributorId)!.minutes }))} people={people.data || []} duration={durationMinutes} startTime={startTime} endTime={endTime} disabled={!completed} onChange={onChange} />
    </div>
    {people.isPending && <p role="status">Mitwirkende werden geladen …</p>}
    {people.isError && <p role="alert">Mitwirkende konnten nicht geladen werden. <Button variant="ghost" onClick={() => void people.refetch()}>Erneut versuchen</Button></p>}
    <div className="flex flex-wrap gap-2">
      {visiblePeople.map(person => {
        const entry = resolved.find(item => item.contributorId === person.id);
        const active = Boolean(entry);
        return <Button key={person.id} variant="ghost" className="!min-h-8 !px-2 !py-1 !rounded-full !text-xs !font-normal border" style={getSelectableTaxonomyChipStyle(active, person.color)}
          aria-pressed={active} aria-label={`${person.name}${!person.active ? ' (archiviert)' : ''}`} disabled={!completed && !active}
          title={entry?.minutes ? `${person.name}: ${formatContributionMinutes(entry.minutes)}` : person.name}
          onClick={() => onChange(active ? value.filter(item => item.contributorId !== person.id) : [...value, { contributorId: person.id, minutes: durationMinutes ?? 0, automatic: true }])}>
          {person.name}{!person.active && ' (archiviert)'}{active && entry?.minutes !== durationMinutes && !value.find(item => item.contributorId === person.id)?.automatic && <span role="img" aria-label={`Angepasste Mitwirkungszeit: ${formatContributionMinutes(entry?.minutes || 0)}`}><Clock aria-hidden="true" className="!h-3 !w-3" /></span>}
        </Button>;
      })}
    </div>
    {creating && <ContributorFormModal initial={{}} onClose={() => setCreating(false)} onSaved={person => onChange([...value, { contributorId: person.id, minutes: durationMinutes ?? 0, automatic: true }])} />}
  </section>;
}

export function ActivityContributionDetails({ entries }: { entries: Contribution[] }) {
  const people = useContributors();
  if (!entries.length) return null;
  return <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
    <h2 className="mb-3 flex items-center gap-2 font-semibold">Mitwirkung</h2>
    {people.isError && <p role="alert">Namen konnten nicht geladen werden.</p>}
    <ul className="space-y-2">{entries.map(entry => <li key={entry.contributorId} className="flex justify-between gap-4 text-sm">
      <span>{people.data?.find(person => person.id === entry.contributorId)?.name || 'Mitwirkende Person'}</span><span>{formatContributionMinutes(entry.minutes)}</span>
    </li>)}</ul>
  </section>;
}
