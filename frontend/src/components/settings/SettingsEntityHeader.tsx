import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import Toggle from '@/components/Toggle';
import { IconButton } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { autoT } from '@/i18n/auto';

export default function SettingsEntityHeader({ title, description, archivedCount, showArchived, onShowArchived, canCreate, createLabel, onCreate }: {
  title: string;
  description?: ReactNode;
  archivedCount: number;
  showArchived: boolean;
  onShowArchived: (value: boolean) => void;
  canCreate: boolean;
  createLabel: string;
  onCreate: () => void;
}) {
  return <div className="mb-4 grid min-w-0 grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
    <div className="min-w-0">
      <h3 className="break-words text-xl font-semibold text-viridian">{title}</h3>
      {description && <p className="text-gray-600">{description}</p>}
    </div>
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
      {archivedCount > 0 && <Toggle checked={showArchived} onChange={onShowArchived} label={`${autoT('ui_d9431e38c8b6')} (${archivedCount})`} />}
      <Tooltip text={createLabel}><IconButton size="icon-touch" className="!rounded-full shrink-0 shadow" disabled={!canCreate} aria-label={createLabel} onClick={onCreate}><Plus /></IconButton></Tooltip>
    </div>
  </div>;
}
