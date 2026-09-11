import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, FileText, ListChecks, LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import type { LogbookEntry } from '@/lib/logbook';
import { logbookTypeLabels } from '@/lib/logbookLabels';
import { autoT } from '@/i18n/auto';
import { formatDate } from '@/i18n/formatters';
import ProtectedImage from './ProtectedImage';
import LogbookTypeBadge from './LogbookTypeBadge';
import LogbookStatusBadge from './LogbookStatusBadge';
import LogbookConnections from './LogbookConnections';

/** Shared reading layout for the detail dialog and the standalone entry page. */
export default function LogbookDetailContent({ entry }: { entry: LogbookEntry }) {
  const { user } = useAuth();
  const { t } = useTranslation('logbook');
  const avatarUrl = entry.createdByUser?.avatarUrl ?? (entry.createdByUserId === user?.id ? user?.avatarUrl : null);
  const initials = entry.createdByName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const notes = [
    { value: entry.highlights, title: autoT('ui_ed124d299865'), tone: 'success', Icon: Check },
    { value: entry.challenges, title: autoT('ui_24cb5c6fa8e6'), tone: 'warning', Icon: AlertTriangle },
    { value: entry.nextSteps, title: autoT('ui_76231e1d047c'), tone: 'info', Icon: ArrowRight },
  ].filter(note => note.value);
  return (
    <div className="logbook-reading-content">
      <section className="logbook-reading-summary">
        <h1>{entry.title}</h1>
        <div className="logbook-reading-badges">
          <LogbookTypeBadge type={entry.type} label={logbookTypeLabels[entry.type]} />
          <LogbookStatusBadge status={entry.status} />
          {entry.visibility === 'admins' && <span className="logbook-reading-private"><LockKeyhole aria-hidden="true" />{autoT('ui_db8e800f08e5')}</span>}
        </div>
        <div className="logbook-reading-meta">
          <span className="logbook-reading-author"><span className="logbook-reading-avatar">
            {avatarUrl ? <ProtectedImage src={avatarUrl} alt="" /> : initials || '?'}
          </span>{entry.createdByName}</span>
          <span><CalendarDays aria-hidden="true" /><time dateTime={entry.occurredAt}>{formatDate(entry.occurredAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}</time></span>
          <span><Clock3 aria-hidden="true" />{formatDate(entry.occurredAt, { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        {entry.documentationUpdatedAt && <p className="logbook-reading-update">
          {autoT('ui_dee2fa0b54d8')}{formatDate(entry.documentationUpdatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
          {entry.documentationUpdatedByName ? ` · ${entry.documentationUpdatedByName}` : ''}
        </p>}
        {entry.status === 'discussed' && <p className="logbook-reading-discussed"><CheckCircle2 aria-hidden="true" />
          <span>{autoT('ui_90f8eeda9786')} {entry.discussedByName || '—'} {autoT('ui_96e8155732e8')} {entry.discussedAt ? formatDate(entry.discussedAt, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}.</span>
        </p>}
      </section>
      <section className="logbook-reading-panel">
        <h2 className="logbook-reading-heading"><FileText aria-hidden="true" />{autoT('ui_0401e23e6030')}</h2>
        <p className="logbook-reading-body">{entry.body}</p>
      </section>
      {notes.length > 0 && <section className="logbook-reading-panel">
        <h2 className="logbook-reading-heading"><ListChecks aria-hidden="true" />{t('reflectionOutlook')}</h2>
        <div className="logbook-reflection-list">
          {notes.map(({ value, title, tone, Icon }) => <div key={tone} className={`logbook-reflection-item logbook-reflection-item--${tone}`}>
            <span className="logbook-reflection-icon"><Icon aria-hidden="true" /></span>
            <div><h3>{title}</h3><p>{value}</p></div>
          </div>)}
        </div>
      </section>}
      <LogbookConnections entry={entry} />
    </div>
  );
}
