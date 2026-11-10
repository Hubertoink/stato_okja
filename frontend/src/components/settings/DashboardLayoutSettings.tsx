import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, GripVertical, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DASHBOARD_SECTIONS, saveDashboardLayout, useDashboardLayout, type DashboardSectionId } from '@/lib/dashboardLayout';
import { Button, IconButton } from '@/components/ui/Button';

export default function DashboardLayoutSettings() {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const order = useDashboardLayout(user?.id);
  const [dragged, setDragged] = useState<DashboardSectionId | null>(null);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);
  const id = useId();
  const persist = (next: readonly DashboardSectionId[]) => {
    setStatus(saveDashboardLayout(next, user?.id) ? 'saved' : 'error');
  };
  const move = (source: DashboardSectionId, target: DashboardSectionId) => {
    if (source === target) return;
    const next = order.filter(section => section !== source);
    next.splice(order.indexOf(target), 0, source);
    persist(next);
  };
  return (
    <section className="mt-6 border-t border-[var(--border-subtle)] pt-6" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`${id}-title`} className="text-lg font-semibold">{t('dashboardLayout.title')}</h3>
        <Button variant="ghost" onClick={() => persist(DASHBOARD_SECTIONS)}>
          <RotateCcw className="h-4 w-4" />{t('dashboardLayout.reset')}
        </Button>
      </div>
      <p className="my-3 text-sm text-[var(--text-secondary)]">{t('dashboardLayout.description')}</p>
      <ol className="space-y-2" aria-label={t('dashboardLayout.title')}>
        {order.map((section, index) => {
          const label = t(`dashboardLayout.sections.${section}`);
          return (
            <li key={section} draggable onDragStart={event => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', section);
              setDragged(section);
            }} onDragEnd={() => setDragged(null)} onDragOver={event => {
              if (dragged) event.preventDefault();
            }} onDrop={event => {
              event.preventDefault();
              if (dragged) move(dragged, section);
              setDragged(null);
            }} className="settings-mobile-item flex items-center gap-2 rounded-lg px-3 py-2">
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[var(--text-muted)]" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
              <IconButton variant="ghost" aria-label={t('dashboardLayout.up', { section: label })}
                disabled={index === 0} onClick={() => move(section, order[index - 1])}><ArrowUp className="h-4 w-4" /></IconButton>
              <IconButton variant="ghost" aria-label={t('dashboardLayout.down', { section: label })}
                disabled={index === order.length - 1} onClick={() => move(section, order[index + 1])}><ArrowDown className="h-4 w-4" /></IconButton>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{t('dashboardLayout.hint')}</p>
      <p role={status === 'error' ? 'alert' : 'status'} className="mt-2 text-sm text-[var(--text-secondary)]">
        {status ? t(`dashboardLayout.${status}`) : ''}
      </p>
    </section>
  );
}
