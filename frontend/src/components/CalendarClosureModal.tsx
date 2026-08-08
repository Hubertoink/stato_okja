import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, Save, Trash2, X } from 'lucide-react';
import type { OrganizationClosureDay } from '@/lib/orgs';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { ModalBackdrop, useModalHistory } from '@/components/Modal';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

function formatDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map((value) => Number(value));
  const parsed = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat(getCurrentIntlLocale(), {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

export default function CalendarClosureModal({
  date,
  closureDay,
  onClose,
  onSave,
  onDelete,
  saving = false,
  deleting = false,
}: {
  date: string;
  closureDay?: OrganizationClosureDay | null;
  onClose: () => void;
  onSave: (payload: Pick<OrganizationClosureDay, 'from' | 'to'>) => void;
  onDelete: () => void;
  saving?: boolean;
  deleting?: boolean;
}) {
  useBodyScrollLock(true);
  const { dismiss } = useModalHistory(onClose);
  const [fullDay, setFullDay] = useState(!(closureDay?.from || closureDay?.to));
  const [from, setFrom] = useState(closureDay?.from ?? '08:00');
  const [to, setTo] = useState(closureDay?.to ?? '17:00');

  useEffect(() => {
    setFullDay(!(closureDay?.from || closureDay?.to));
    setFrom(closureDay?.from ?? '08:00');
    setTo(closureDay?.to ?? '17:00');
  }, [closureDay?.date, closureDay?.from, closureDay?.to, date]);

  const dateLabel = useMemo(() => formatDateLabel(date), [date]);
  const canSave = fullDay || (!!from && !!to);

  const content = (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-0 md:items-center md:p-4"
      onWheel={(event) => event.stopPropagation()}
    >
      <ModalBackdrop className="modal-overlay bg-black/45" onClick={dismiss} />
      <div
        aria-label={autoT('ui_afd5e7713414')}
        aria-modal="true"
        className="calendar-closure-modal relative z-10 w-full rounded-t-2xl border px-4 py-4 shadow-2xl md:max-w-md md:rounded-2xl md:px-6 md:py-6"
        style={{
          background: 'var(--surface-elevated)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>{autoT('ui_afd5e7713414')}</div>
            <h3 className="mt-1 text-lg font-semibold">{dateLabel}</h3>
          </div>
          <IconButton
            className="modal-close-button rounded-full"
            onClick={dismiss}
            aria-label={autoT('ui_44424b18700e')}
            title={autoT('ui_44424b18700e')}
            variant="ghost"
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>

        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{autoT('ui_aaa8dd1e7161')}</p>

        <label className="mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <input
            type="checkbox"
            checked={fullDay}
            onChange={(event) => setFullDay(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
          />
          <span className="text-sm font-medium">{autoT('ui_865b5487eec6')}</span>
        </label>

        {!fullDay && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                <Clock3 className="h-4 w-4" />{autoT('ui_a4b078f9eb7b')}</div>
              <Input
                type="time"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                <Clock3 className="h-4 w-4" />{autoT('ui_0afaa0e566a1')}</div>
              <Input
                type="time"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
        )}

        <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>{autoT('ui_4275a5b67e40')}</div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {closureDay ? (
              <Button
                className="w-full sm:w-auto"
                onClick={onDelete}
                disabled={deleting}
                variant="danger"
              >
                <Trash2 aria-hidden="true" />
                {deleting ? autoT('ui_2b5a5dd9afbb') : autoT('ui_c7728aae980f')}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={dismiss}
              variant="secondary"
            >{autoT('ui_07af7cb30fca')}</Button>
            <Button
              disabled={!canSave || saving}
              onClick={() => onSave(fullDay ? { from: null, to: null } : { from, to })}
            >
              <Save aria-hidden="true" />
              {saving ? autoT('ui_b202bdfb661a') : closureDay ? "Aktualisieren" : autoT('ui_70b73bbc118d')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') return createPortal(content, document.body);
  return content;
}
