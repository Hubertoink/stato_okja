import { CalendarDays, ChevronRight, Folder, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { autoT } from '@/i18n/auto';
import type { LogbookEntry } from '@/lib/logbook';

export default function LogbookConnections({ entry }: { entry: LogbookEntry }) {
  if (!entry.activity && !entry.project) return null;
  return (
    <section className="logbook-reading-panel">
      <h2 className="logbook-reading-heading"><Link2 aria-hidden="true" />{autoT('ui_0493d567bdb7')}</h2>
      <div className="logbook-connection-list">
        {entry.project && <Link className="logbook-connection-row" to={`/activities?projectId=${encodeURIComponent(entry.project.id)}`}>
          <span className="logbook-connection-icon"><Folder aria-hidden="true" /></span>
          <span className="logbook-connection-text"><strong>{autoT('ui_30c095c845e0').replace(/:$/, '')}</strong><span>{entry.project.title}</span></span>
          <ChevronRight className="logbook-connection-chevron" aria-hidden="true" />
        </Link>}
        {entry.activity && <Link className="logbook-connection-row" to={`/activities/${entry.activity.id}`}>
          <span className="logbook-connection-icon"><CalendarDays aria-hidden="true" /></span>
          <span className="logbook-connection-text"><strong>{autoT('ui_c71c993f48b0').replace(/:$/, '')}</strong><span>{entry.activity.title || entry.activity.date}</span></span>
          <ChevronRight className="logbook-connection-chevron" aria-hidden="true" />
        </Link>}
      </div>
    </section>
  );
}
