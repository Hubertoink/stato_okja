import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useProjects } from '@/lib/projects';
import type { LogbookAdvancedFilters } from '@/lib/logbookFilterStorage';
import { logbookStatusLabels, logbookTypeLabels } from '@/lib/logbookLabels';

export default function LogbookFilterDrawer({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: LogbookAdvancedFilters;
  onClose: () => void;
  onApply: (filters: LogbookAdvancedFilters) => void;
}) {
  const [filters, setFilters] = useState<LogbookAdvancedFilters>(initial);
  const { data: projects = [] } = useProjects();

  useEffect(() => {
    if (open) setFilters(initial);
  }, [initial, open]);

  return (
    <Modal open={open} onClose={onClose} title="Logbuch filtern" maxWidth="lg">
      <div className="space-y-5">
        <section>
          <h4 className="mb-2 font-semibold text-viridian">Zeitraum</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Von
              <input
                type="date"
                value={filters.from || ''}
                onChange={(event) =>
                  setFilters({ ...filters, from: event.target.value || undefined })
                }
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Bis
              <input
                type="date"
                value={filters.to || ''}
                onChange={(event) =>
                  setFilters({ ...filters, to: event.target.value || undefined })
                }
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
              />
            </label>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Eintragsart
            <select
              value={filters.type || ''}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  type: (event.target.value || undefined) as LogbookAdvancedFilters['type'],
                })
              }
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <option value="">Alle Eintragsarten</option>
              {Object.entries(logbookTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Status
            <select
              value={filters.status || ''}
              onChange={(event) => {
                const status = (event.target.value ||
                  undefined) as LogbookAdvancedFilters['status'];
                setFilters({
                  ...filters,
                  status,
                  includeArchived: status === 'archived' ? true : filters.includeArchived,
                });
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <option value="">Alle Status</option>
              {Object.entries(logbookStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section>
          <label className="text-sm font-medium text-gray-700">
            Projekt
            <select
              value={filters.projectId || ''}
              onChange={(event) =>
                setFilters({ ...filters, projectId: event.target.value || undefined })
              }
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <option value="">Alle Projekte</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
        </section>

        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={!!filters.includeArchived}
            onChange={(event) =>
              setFilters({ ...filters, includeArchived: event.target.checked || undefined })
            }
          />
          Archivierte Einträge einbeziehen
        </label>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => onApply(filters)}
            className="rounded-lg bg-viridian px-4 py-2 text-sm font-semibold text-white hover:bg-cambridge-blue"
          >
            Übernehmen
          </button>
        </div>
      </div>
    </Modal>
  );
}
