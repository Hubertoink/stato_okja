import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useProjects } from '@/lib/projects';
import type { LogbookAdvancedFilters } from '@/lib/logbookFilterStorage';
import { logbookStatusLabels, logbookTypeLabels } from '@/lib/logbookLabels';
import { Button } from '@/components/ui/Button';
import { FieldLabel, Input, Select } from '@/components/ui/Field';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation(['logbook', 'common']);
  const [filters, setFilters] = useState<LogbookAdvancedFilters>(initial);
  const { data: projects = [] } = useProjects();

  useEffect(() => {
    if (open) setFilters(initial);
  }, [initial, open]);

  return (
    <Modal open={open} onClose={onClose} title={t('filter.title')} maxWidth="lg">
      <div className="space-y-5">
        <section>
          <h4 className="mb-2 font-semibold text-viridian">{t('filter.period')}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldLabel>
              {t('filter.from')}
              <Input
                type="date"
                value={filters.from || ''}
                onChange={(event) =>
                  setFilters({ ...filters, from: event.target.value || undefined })
                }
              />
            </FieldLabel>
            <FieldLabel>
              {t('filter.to')}
              <Input
                type="date"
                value={filters.to || ''}
                onChange={(event) =>
                  setFilters({ ...filters, to: event.target.value || undefined })
                }
              />
            </FieldLabel>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldLabel>
            {t('filter.type')}
            <Select
              value={filters.type || ''}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  type: (event.target.value || undefined) as LogbookAdvancedFilters['type'],
                })
              }
            >
              <option value="">{t('filter.allTypes')}</option>
              {Object.keys(logbookTypeLabels).map((value) => (
                <option key={value} value={value}>
                  {t(`types.${value}`)}
                </option>
              ))}
            </Select>
          </FieldLabel>
          <FieldLabel>
            {t('filter.status')}
            <Select
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
            >
              <option value="">{t('filter.allStatuses')}</option>
              {Object.keys(logbookStatusLabels).map((value) => (
                <option key={value} value={value}>
                  {t(`common:logbookStatus.${value}`)}
                </option>
              ))}
            </Select>
          </FieldLabel>
        </section>

        <section>
          <FieldLabel>
            {t('filter.project')}
            <Select
              value={filters.projectId || ''}
              onChange={(event) =>
                setFilters({ ...filters, projectId: event.target.value || undefined })
              }
            >
              <option value="">{t('filter.allProjects')}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </Select>
          </FieldLabel>
        </section>

        <label className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-sm font-medium text-[var(--text-primary)]">
          <input
            type="checkbox"
            checked={!!filters.includeArchived}
            onChange={(event) =>
              setFilters({ ...filters, includeArchived: event.target.checked || undefined })
            }
          />
          {t('filter.archived')}
        </label>

        <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={() => onApply(filters)}
          >
            {t('filter.apply')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
