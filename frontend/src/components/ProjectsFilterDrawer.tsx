import { useState, type RefObject } from 'react';
import type { Project } from '@/lib/projects';
import { projectStaffNames } from '@/lib/projectsFilters';
import { compareLocalized } from '@/i18n/formatters';
import { ResponsiveFilterPanel } from './ui/ResponsiveFilterPanel';
import { Button } from './ui/Button';
import { Input } from './ui/Field';

type Filters = { staffNames: string[]; categoryIds: string[]; showArchived: boolean };

export default function ProjectsFilterDrawer({ anchorRef, projects, categories, initial, archivedCount, onClose, onApply }: {
  anchorRef: RefObject<HTMLElement | null>;
  projects: Project[];
  categories: Array<{ id: string; name: string }>;
  initial: Filters;
  archivedCount: number;
  onClose: () => void;
  onApply: (filters: Filters) => void;
}) {
  const [filters, setFilters] = useState(initial);
  const staffNames = [...new Set([...projects.flatMap(projectStaffNames), ...initial.staffNames])].sort(compareLocalized);
  const categoryOptions = [...new Map([
    ...categories,
    ...projects.flatMap(project => project.categories || []),
  ].map(category => [category.id, category])).values()].sort((a, b) => compareLocalized(a.name, b.name));
  const toggle = (key: 'staffNames' | 'categoryIds', value: string) => {
    setFilters(current => ({ ...current, [key]: current[key].includes(value)
      ? current[key].filter(entry => entry !== value) : [...current[key], value] }));
  };

  return <ResponsiveFilterPanel
    open anchorRef={anchorRef} title="Projekte filtern" desktopClassName="filter-popover--logbook" onClose={onClose}
    footer={<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
      <Button size="sm" variant="ghost" onClick={() => setFilters({ staffNames: [], categoryIds: [], showArchived: false })}>Zurücksetzen</Button>
      <div className="flex gap-3">
        <Button size="sm" variant="secondary" onClick={onClose}>Schließen</Button>
        <Button size="sm" onClick={() => onApply(filters)}>Übernehmen</Button>
      </div>
    </div>}
  >
    <div className="space-y-3">
      <details className="activity-filter-section" open={initial.staffNames.length > 0}>
        <summary>Mitarbeitende{filters.staffNames.length > 0 ? ` (${filters.staffNames.length})` : ''}</summary>
        <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-[var(--border-subtle)] p-2 text-sm space-y-1">
          {staffNames.map(name => <label key={name} className="flex items-center gap-2">
            <Input type="checkbox" className="h-4 !min-h-0 !w-4 p-0" checked={filters.staffNames.includes(name)} onChange={() => toggle('staffNames', name)} />
            <span>{name}</span>
          </label>)}
          {!staffNames.length && <p className="px-1 py-2 text-[var(--text-muted)]">Keine Mitarbeitenden zugeordnet.</p>}
        </div>
      </details>
      <details className="activity-filter-section" open={initial.categoryIds.length > 0}>
        <summary>Kategorien{filters.categoryIds.length > 0 ? ` (${filters.categoryIds.length})` : ''}</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {categoryOptions.map(category => <Button key={category.id} size="sm" variant={filters.categoryIds.includes(category.id) ? 'primary' : 'ghost'}
            aria-pressed={filters.categoryIds.includes(category.id)} onClick={() => toggle('categoryIds', category.id)}
            className={`!min-h-0 !px-2 !py-1 !rounded-full !font-normal ${filters.categoryIds.includes(category.id) ? '' : '!bg-azure-web !text-viridian'}`}>
            {category.name}
          </Button>)}
          {!categoryOptions.length && <p className="text-sm text-[var(--text-muted)]">Keine Kategorien vorhanden.</p>}
        </div>
      </details>
      <label className="filter-archive-option">
        <Input type="checkbox" className="h-4 !min-h-0 !w-4 p-0" checked={filters.showArchived}
          onChange={event => setFilters(current => ({ ...current, showArchived: event.target.checked }))} />
        <span>Archivierte Projekte einblenden{archivedCount > 0 ? ` (${archivedCount})` : ''}</span>
      </label>
    </div>
  </ResponsiveFilterPanel>;
}
