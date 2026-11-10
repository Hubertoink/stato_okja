import { ContributorFormModal } from '@/components/settings/ContributorFormModal';
import { useCallback, useState } from 'react';
import { Pencil } from 'lucide-react';
import SettingsEntityHeader from '@/components/settings/SettingsEntityHeader';
import EntityRemovalDialog from '@/components/settings/EntityRemovalDialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { ArchiveIconButton, DeleteIconButton, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { canManageSettingsDestructiveActions, useAuth } from '@/lib/auth';
import { contributionError, contributorUsage, useDeleteContributor, useContributors, useSaveContributor, type Contributor } from '@/lib/contributors';

export default function SettingsContributors() {
  const [editing, setEditing] = useState<Partial<Contributor> | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const people = useContributors();
  const save = useSaveContributor();
  const remove = useDeleteContributor();
  const [removing, setRemoving] = useState<Contributor | null>(null);
  const loadUsage = useCallback(() => contributorUsage(removing!.id), [removing?.id]);
  const { user } = useAuth();
  const canEdit = canManageSettingsDestructiveActions(user?.role);
  const archivedCount = (people.data || []).filter(person => !person.active).length;
  const filtered = (people.data || []).filter(person => (showArchived || person.active) && person.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  return <div className="modern-card p-6">
    <SettingsEntityHeader title="Mitwirkende" archivedCount={archivedCount}
      showArchived={showArchived} onShowArchived={setShowArchived} canCreate={canEdit}
      createLabel="Mitwirkende anlegen" onCreate={() => setEditing({})} />
    {(people.data?.length || 0) > 10 && <Input type="search" aria-label="Mitwirkende suchen" placeholder="Mitwirkende suchen …" value={search} onChange={event => setSearch(event.target.value)} className="mb-4" />}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {people.isPending && <p role="status">Mitwirkende werden geladen …</p>}
    {people.isError && <p role="alert">Mitwirkende konnten nicht geladen werden.</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{filtered.map(person => <div key={person.id} className="p-3 rounded border border-gray-200 flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-3"><span className="inline-block shrink-0 h-4 w-4 rounded" style={{ backgroundColor: person.color || '#7aa39a' }} /><span className="min-w-0 font-medium text-viridian break-words">{person.name}{!person.active && <span className="ml-2 text-xs text-gray-500">Archiviert</span>}</span></div>
      {canEdit && <div className="flex shrink-0 gap-2">
        {!person.active && <Tooltip text="Reaktivieren"><ArchiveIconButton size="icon-compact" restore disabled={save.isPending} aria-label={`${person.name} reaktivieren`} onClick={async () => {
          setError(''); try { await save.mutateAsync({ id: person.id, active: true }); } catch (err) { setError(contributionError(err)); }
        }} /></Tooltip>}
        <Tooltip text="Bearbeiten"><IconButton size="icon-compact" variant="ghost" className="!rounded-full bg-viridian/10 hover:bg-viridian/20 text-viridian" aria-label={`${person.name} bearbeiten`} onClick={() => setEditing(person)}><Pencil /></IconButton></Tooltip>
        <Tooltip text="Löschen"><DeleteIconButton size="icon-compact" aria-label={`${person.name} löschen`} onClick={() => setRemoving(person)} /></Tooltip>
      </div>}
    </div>)}</div>
    {people.isSuccess && !filtered.length && <p className="text-gray-500 py-6">Keine Mitwirkenden vorhanden.</p>}
    {removing && <EntityRemovalDialog key={removing.id} title="Mitwirkende Person löschen?"
      name={removing.name} archived={!removing.active} loadUsage={loadUsage}
      warning="Wenn du diese Person löschst, verlieren Aktivitäten ihre Zuordnung und die erfassten Mitwirkungszeiten dieser Person. Historische Auswertungen ändern sich rückwirkend."
      onArchive={() => save.mutateAsync({ id: removing.id, active: false })}
      onDelete={() => remove.mutateAsync(removing.id)} onClose={() => setRemoving(null)} />}
    {editing && <ContributorFormModal initial={editing} onClose={() => setEditing(null)} />}
  </div>;
}
