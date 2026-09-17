import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Folder, Link2, X } from 'lucide-react';
import type { LogbookEntry } from '@/lib/logbook';
import type { LogbookDraft } from '@/lib/logbookEdit';
import { useProjects } from '@/lib/projects';
import { useActivity } from '@/lib/activities';
import { autoT } from '@/i18n/auto';
import ProjectPickerModal from '@/pages/ProjectPickerModal';
import LogbookActivityPicker from './LogbookActivityPicker';
import { Button, IconButton } from './ui/Button';

export default function LogbookEditableConnections({ entry, draft, onChange }: {
  entry: LogbookEntry; draft: LogbookDraft; onChange: (next: LogbookDraft) => void;
}) {
  const [picker, setPicker] = useState<'project' | 'activity' | null>(null);
  const { t } = useTranslation('logbook');
  const { data: projects = [] } = useProjects({ archived: false });
  const { data: activity } = useActivity(draft.activityId || undefined);
  const project = projects.find(item => item.id === draft.projectId) || (entry.project?.id === draft.projectId ? entry.project : null);
  const selectedActivity = activity || (entry.activity?.id === draft.activityId ? entry.activity : null);
  return <section className="logbook-reading-panel">
    <h2 className="logbook-reading-heading"><Link2 aria-hidden="true" />{autoT('ui_0493d567bdb7')}</h2>
    <div className="logbook-connection-list">
      <div className="logbook-edit-connection">
        <Button variant="ghost" className="logbook-connection-row" onClick={() => setPicker('project')}>
          <span className="logbook-connection-icon"><Folder aria-hidden="true" /></span>
          <span className="logbook-connection-text"><strong>{autoT('ui_30c095c845e0')}</strong><span>{project?.title || autoT('ui_5b4a4a84148c')}</span></span>
        </Button>
        {draft.projectId && <IconButton variant="ghost" aria-label={t('unlinkProject')} onClick={() => onChange({ ...draft, projectId: '' })}><X /></IconButton>}
      </div>
      <div className="logbook-edit-connection">
        <Button variant="ghost" className="logbook-connection-row" onClick={() => setPicker('activity')}>
          <span className="logbook-connection-icon"><CalendarDays aria-hidden="true" /></span>
          <span className="logbook-connection-text"><strong>{autoT('ui_c71c993f48b0')}</strong><span>{selectedActivity?.title || selectedActivity?.date || autoT('ui_ab6635285bc7')}</span></span>
        </Button>
        {draft.activityId && <IconButton variant="ghost" aria-label={t('unlinkActivity')} onClick={() => onChange({ ...draft, activityId: '' })}><X /></IconButton>}
      </div>
    </div>
    {picker && <div data-logbook-picker>
      {picker === 'project' && <ProjectPickerModal onClose={() => setPicker(null)} onPick={item => { onChange({ ...draft, projectId: item.id }); setPicker(null); }} />}
      {picker === 'activity' && <LogbookActivityPicker open occurredAt={draft.occurredAt} onClose={() => setPicker(null)} onPick={id => onChange({ ...draft, activityId: id })} />}
    </div>}
  </section>;
}
