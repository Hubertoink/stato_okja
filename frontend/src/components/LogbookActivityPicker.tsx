import { useMemo, useState } from 'react';
import Modal from './Modal';
import ProtectedImage from './ProtectedImage';
import { useActivitiesPaged } from '@/lib/activities';
import { logbookActivityPickerRange } from '@/lib/logbookDate';
import { colorFromStringHash } from '@/lib/colors';
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import { Input } from './ui/Field';
import { Button } from './ui/Button';
export default function LogbookActivityPicker({
  open,
  onClose,
  onPick,
  occurredAt,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  occurredAt: string;
}) {
  const [search, setSearch] = useState('');
  const range = useMemo(() => {
    return logbookActivityPickerRange(occurredAt);
  }, [occurredAt]);
  const { data: activityPage, isLoading } = useActivitiesPaged(
    { ...range, search: search.trim() || undefined, order: 'desc' },
    1,
    50,
    { staleTimeMs: 30_000 },
  );
  const activities = activityPage?.data || [];
  return (
    <Modal open={open} onClose={onClose} title={autoT('ui_ab6635285bc7')} maxWidth="2xl" variant="form">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-6 md:pb-6">
        <p className="mb-3 shrink-0 text-sm text-gray-600">{autoT('ui_3c4b1175587b')}</p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={autoT('ui_cdcd2f758fec')}
          className="mb-3 w-full shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
        />
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {isLoading ? <p className="py-6 text-center text-sm text-gray-500">{autoT('ui_a7151ad4e39f')}</p> : null}
        {!isLoading && activities.map((activity) => {
          const project = activity.project;
          const projectColor = project
            ? project.color || colorFromStringHash(project.title)
            : undefined;

          return (
            <Button
              variant="ghost"
              key={activity.id}
              type="button"
              onClick={() => {
                onPick(activity.id);
                onClose();
              }}
              className="relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl border border-gray-100 bg-white p-3 text-left transition hover:border-viridian hover:bg-viridian/5"
            >
              {project?.imageUrl ? (
                <>
                  <ProtectedImage
                    src={project.imageUrl}
                    alt=""
                    aria-hidden
                    className="absolute inset-y-0 right-0 h-full w-1/3 object-cover opacity-85 sm:w-1/4"
                  />
                  <div
                    className="activity-image-fade-mobile absolute inset-y-0 right-0 w-1/3 sm:w-1/4"
                    aria-hidden
                  />
                </>
              ) : projectColor ? (
                <>
                  <div
                    className="absolute inset-y-0 right-0 w-1/3 opacity-80 sm:w-1/4"
                    style={{
                      background: `linear-gradient(225deg, ${projectColor} 0%, color-mix(in srgb, ${projectColor} 68%, white) 100%)`,
                    }}
                    aria-hidden
                  />
                  <div
                    className="activity-image-fade-mobile absolute inset-y-0 right-0 w-1/3 sm:w-1/4"
                    aria-hidden
                  />
                </>
              ) : null}
              <span className="relative z-10 min-w-0">
                <span className="block font-semibold text-gray-800">
                  {activity.title || project?.title || autoT('ui_1c4aaccf808e')}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  {new Date(`${activity.date}T12:00:00`).toLocaleDateString(getCurrentIntlLocale())} ·{' '}
                  {project?.title || autoT('ui_5b4a4a84148c')}
                </span>
              </span>
              <span className="relative z-10 shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-600">
                {activity.countTotal || 0}{autoT('ui_f79fa2d4a0a2')}</span>
            </Button>
          );
        })}
        {!isLoading && activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">{autoT('ui_118fdc8c2826')}</p>
        ) : null}
        </div>
      </div>
    </Modal>
  );
}

