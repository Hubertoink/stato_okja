import { ContributorFormModal } from '@/components/settings/ContributorFormModal';
import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import Toggle from '@/components/Toggle';
import { Tooltip } from '@/components/ui/Tooltip';
import { ArchiveIconButton, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { canManageSettingsDestructiveActions, useAuth } from '@/lib/auth';
import { contributionError, useContributors, useSaveContributor, type Contributor } from '@/lib/contributors';

export default function SettingsContributors() {
  const [editing, setEditing] = useState<Partial<Contributor> | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const people = useContributors();
  const save = useSaveContributor();
  const { user } = useAuth();
  const canEdit = canManageSettingsDestructiveActions(user?.role);
  const archivedCount = (people.data || []).filter(person => !person.active).length;
  const filtered = (people.data || []).filter(person => (showArchived || person.active) && person.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  return <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center justify-between mb-4 gap-3">
      <h3 className="text-xl font-semibold text-viridian">Mitwirkende</h3>
      <div className="flex items-center gap-3">
        {archivedCount > 0 && <Toggle checked={showArchived} onChange={setShowArchived} label={`Archivierte anzeigen (${archivedCount})`} />}
        {canEdit && <Tooltip text="Mitwirkende anlegen"><IconButton size="icon-touch" className="!rounded-full shadow" aria-label="Mitwirkende anlegen" onClick={() => setEditing({})}><Plus /></IconButton></Tooltip>}
      </div>
    </div>
    {(people.data?.length || 0) > 10 && <Input type="search" aria-label="Mitwirkende suchen" placeholder="Mitwirkende suchen …" value={search} onChange={event => setSearch(event.target.value)} className="mb-4" />}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {people.isPending && <p role="status">Mitwirkende werden geladen …</p>}
    {people.isError && <p role="alert">Mitwirkende konnten nicht geladen werden.</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{filtered.map(person => <div key={person.id} className="p-3 rounded border border-gray-200 flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-3"><span className="inline-block shrink-0 h-4 w-4 rounded" style={{ backgroundColor: person.color || '#7aa39a' }} /><span className="font-medium text-viridian break-words">{person.name}{!person.active && <span className="ml-2 text-xs text-gray-500">Archiviert</span>}</span></div>
      {canEdit && <div className="flex gap-2">
        <Tooltip text="Bearbeiten"><IconButton size="icon-compact" variant="ghost" className="!rounded-full bg-viridian/10 hover:bg-viridian/20 text-viridian" aria-label={`${person.name} bearbeiten`} onClick={() => setEditing(person)}><Pencil /></IconButton></Tooltip>
        <Tooltip text={person.active ? 'Archivieren' : 'Reaktivieren'}><ArchiveIconButton size="icon-compact" restore={!person.active} disabled={save.isPending} aria-label={`${person.name} ${person.active ? 'archivieren' : 'reaktivieren'}`} onClick={async () => {
          setError(''); try { await save.mutateAsync({ id: person.id, active: !person.active }); } catch (err) { setError(contributionError(err)); }
        }} /></Tooltip>
      </div>}
    </div>)}</div>
    {people.isSuccess && !filtered.length && <p className="text-gray-500 py-6">Keine Mitwirkenden vorhanden.</p>}
    {editing && <ContributorFormModal initial={editing} onClose={() => setEditing(null)} />}
  </div>;
}
