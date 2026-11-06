import { useState } from 'react';
import { Save } from 'lucide-react';
import Modal from '@/components/Modal';
import { Tooltip } from '@/components/ui/Tooltip';
import { CloseButton, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { useEditorShortcuts } from '@/lib/useEditorShortcuts';
import { contributionError, useSaveContributor, type Contributor } from '@/lib/contributors';

export function ContributorFormModal({ initial, onClose, onSaved }: { initial: Partial<Contributor>; onClose: () => void; onSaved?: (person: Contributor) => void }) {
  const [name, setName] = useState(initial.name || '');
  const [color, setColor] = useState(initial.color || '#7aa39a');
  const [error, setError] = useState('');
  const save = useSaveContributor();
  const handleSave = async () => {
    if (!name.trim() || save.isPending) return;
    try { const person = await save.mutateAsync({ id: initial.id, name: name.trim(), color }); onSaved?.(person); onClose(); }
    catch (err) { setError(contributionError(err)); }
  };
  useEditorShortcuts({ onClose, onSave: () => void handleSave() });
  return <Modal open onClose={onClose} maxWidth="lg" showCloseButton={false} title={initial.id ? 'Mitwirkende bearbeiten' : 'Mitwirkende anlegen'}>
    <div className="space-y-3">
      <div><label className="block text-sm font-medium mb-1" htmlFor="contributor-name">Name *</label>
        <Input id="contributor-name" required autoFocus maxLength={120} value={name} onChange={event => setName(event.target.value)} /></div>
      <div><label className="block text-sm font-medium mb-1" htmlFor="contributor-color">Farbe</label>
        <ColorPicker id="contributor-color" value={color} onChange={value => setColor(value || '#7aa39a')} /></div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
    <div data-scroll-footer className="settings-modal-actions entity-form-actions -mx-4 md:-mx-6 px-4 md:px-6">
      <div className="flex-1 flex items-center"><Tooltip text="Abbrechen"><CloseButton onClick={onClose} aria-label="Abbrechen" /></Tooltip></div>
      <div className="flex-1 flex items-center justify-end"><Tooltip text="Speichern"><IconButton disabled={!name.trim() || save.isPending} onClick={() => void handleSave()} aria-label="Speichern"><Save className="w-5 h-5" /></IconButton></Tooltip></div>
    </div>
  </Modal>;
}
