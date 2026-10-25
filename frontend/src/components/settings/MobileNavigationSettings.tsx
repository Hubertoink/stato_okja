import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useOrganizationModules } from '@/lib/organizationModules';
import { useProcessOAccess } from '@/lib/processes';
import {
  getMobileNavLayout,
  MOBILE_NAV_ITEM_IDS,
  resetMobileNavLayout,
  saveMobileNavLayout,
  type MobileNavItemId,
} from '@/lib/mobileNavigation';
import { autoT } from '@/i18n/auto';
import { Button } from '@/components/ui/Button';

export default function MobileNavigationSettings() {
  const { user } = useAuth();
  const userId = user?.id;
  const { t } = useTranslation('common');
  const modules = useOrganizationModules();
  const processOAccess = useProcessOAccess();
  const availableItemIds = useMemo(
    () =>
      MOBILE_NAV_ITEM_IDS.filter(
        (id) =>
          (id !== 'processes' || processOAccess.data?.enabled) &&
          (id !== 'logbook' || modules.data?.logbook) &&
          (id !== 'surveys' || modules.data?.surveys),
      ),
    [processOAccess.data?.enabled, modules.data?.logbook, modules.data?.surveys],
  );
  const mobileNavLabels: Record<MobileNavItemId, string> = {
    dashboard: t('navigation.dashboard'),
    activities: t('navigation.activities'),
    logbook: t('navigation.logbook'),
    calendar: t('navigation.calendar'),
    projects: t('navigation.projects'),
    processes: t('navigation.processes'),
    surveys: t('navigation.surveys'),
    statistics: t('navigation.statistics'),
    masterData: t('navigation.masterData'),
    operations: t('navigation.operations'),
    settings: t('navigation.settings'),
  };
  const [bottom, setBottom] = useState<MobileNavItemId[]>(
    () => getMobileNavLayout(userId, availableItemIds).bottom,
  );
  const [dragged, setDragged] = useState<MobileNavItemId | null>(null);
  useEffect(
    () => setBottom(getMobileNavLayout(userId, availableItemIds).bottom),
    [availableItemIds, userId],
  );
  const more = availableItemIds.filter((id) => !bottom.includes(id));
  const persist = (next: MobileNavItemId[]) => {
    setBottom(next);
    saveMobileNavLayout({ bottom: next }, userId, availableItemIds);
  };
  const swapWithBottom = (id: MobileNavItemId, target: MobileNavItemId) => {
    if (id === target) return;
    const sourceIsBottom = bottom.includes(id);
    const targetIsBottom = bottom.includes(target);
    if (sourceIsBottom && targetIsBottom) {
      const next = [...bottom];
      const from = next.indexOf(id);
      const to = next.indexOf(target);
      next.splice(from, 1);
      next.splice(to, 0, id);
      persist(next);
      return;
    }
    if (sourceIsBottom) persist(bottom.map((item) => (item === id ? target : item)));
    else if (targetIsBottom) persist(bottom.map((item) => (item === target ? id : item)));
  };
  return (
    <div className="settings-profile-card bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-viridian">{autoT('ui_23f0292a1de9')}</h3>
          <p className="mt-1 text-sm text-gray-600">{autoT('ui_393e7b57db57')}</p>
        </div>
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            resetMobileNavLayout(userId, availableItemIds);
            setBottom(getMobileNavLayout(userId, availableItemIds).bottom);
          }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          <RotateCcw className="h-4 w-4" />
          {autoT('ui_a4565af537e2')}
        </Button>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <MobileNavigationList
          labels={mobileNavLabels}
          title={autoT('ui_71156a85ad75')}
          ids={bottom}
          dragged={dragged}
          setDragged={setDragged}
          onDrop={swapWithBottom}
          onMove={(id) => {
            const replacement = more[0];
            if (replacement) persist(bottom.map((item) => (item === id ? replacement : item)));
          }}
          actionLabel={autoT('ui_30ef5576c197')}
          emphasis
        />
        <MobileNavigationList
          labels={mobileNavLabels}
          title={autoT('ui_3b1556f1c066')}
          ids={more}
          dragged={dragged}
          setDragged={setDragged}
          onDrop={swapWithBottom}
          onMove={(id) => persist([...bottom.slice(0, 3), id])}
          actionLabel={autoT('ui_006cca9235b0')}
        />
      </div>
      <p className="mt-3 text-xs text-gray-500">{autoT('ui_dafbef2f8f5e')}</p>
    </div>
  );
}

function MobileNavigationList({
  labels,
  title,
  ids,
  dragged,
  setDragged,
  onDrop,
  onMove,
  actionLabel,
  emphasis = false,
}: {
  labels: Record<MobileNavItemId, string>;
  title: string;
  ids: MobileNavItemId[];
  dragged: MobileNavItemId | null;
  setDragged: (id: MobileNavItemId | null) => void;
  onDrop: (source: MobileNavItemId, target: MobileNavItemId) => void;
  onMove: (id: MobileNavItemId) => void;
  actionLabel: string;
  emphasis?: boolean;
}) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{title}</h4>
      <div
        className={`settings-mobile-list space-y-2 rounded-xl border p-2 ${emphasis ? 'settings-mobile-list-emphasis' : ''}`}
      >
        {ids.map((id) => (
          <div
            key={id}
            draggable
            onDragStart={() => setDragged(id)}
            onDragEnd={() => setDragged(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragged) onDrop(dragged, id);
              setDragged(null);
            }}
            className="settings-mobile-item flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium"
          >
            <GripVertical className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="min-w-0 flex-1">{labels[id]}</span>
            <Button
              variant="ghost"
              type="button"
              onClick={() => onMove(id)}
              className={`min-h-11 shrink-0 px-2 text-xs font-semibold ${emphasis ? 'text-[var(--text-secondary)] hover:text-viridian' : 'text-viridian'}`}
            >
              {actionLabel}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
