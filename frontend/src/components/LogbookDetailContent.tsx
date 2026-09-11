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
import { FieldLabel, Input, Select, Textarea } from './ui/Field';
import LogbookEditableConnections from './LogbookEditableConnections';
import type { LogbookDraft } from '@/lib/logbookEdit';

/** Shared reading layout for the detail dialog and the standalone entry page. */
export default function LogbookDetailContent({ entry, editor }: { entry: LogbookEntry; editor?: {
  draft: LogbookDraft; onChange: (next: LogbookDraft) => void;
} }) {
  const { user } = useAuth();
  const { t } = useTranslation('logbook');
  const change = (key: keyof LogbookDraft, value: string) => editor?.onChange({ ...editor.draft, [key]: value });
  const avatarUrl = entry.createdByUser?.avatarUrl ?? (entry.createdByUserId === user?.id ? user?.avatarUrl : null);
  const initials = entry.createdByName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const notes = [
    { key: 'highlights' as const, value: entry.highlights, title: autoT('ui_ed124d299865'), tone: 'success', Icon: Check },
    { key: 'challenges' as const, value: entry.challenges, title: autoT('ui_24cb5c6fa8e6'), tone: 'warning', Icon: AlertTriangle },
    { key: 'nextSteps' as const, value: entry.nextSteps, title: autoT('ui_76231e1d047c'), tone: 'info', Icon: ArrowRight },
  ].filter(note => editor || note.value);
  return (
    <div className="logbook-reading-content">
      <section className="logbook-reading-summary">
        {editor ? <FieldLabel className="mb-3">{autoT('ui_950701e758d1')}<Input autoFocus required maxLength={180} value={editor.draft.title} onChange={event => change('title', event.target.value)} className="mt-1 text-lg font-bold" /></FieldLabel> : <h1>{entry.title}</h1>}
        <div className="logbook-reading-badges">
          {editor ? <FieldLabel>{autoT('ui_f4b0e988965d')}<Select value={editor.draft.type} onChange={event => change('type', event.target.value)}>
            {Object.entries(logbookTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select></FieldLabel> : <LogbookTypeBadge type={entry.type} label={logbookTypeLabels[entry.type]} />}
          {!editor && <LogbookStatusBadge status={entry.status} />}
          {entry.visibility === 'admins' && <span className="logbook-reading-private"><LockKeyhole aria-hidden="true" />{autoT('ui_db8e800f08e5')}</span>}
        </div>
        <div className="logbook-reading-meta">
          <span className="logbook-reading-author"><span className="logbook-reading-avatar">
            {avatarUrl ? <ProtectedImage src={avatarUrl} alt="" /> : initials || '?'}
          </span>{entry.createdByName}</span>
          {editor ? <FieldLabel>{autoT('ui_e2f9e932be0a')}<Input required type="datetime-local" min="1000-01-01T00:00" max="9999-12-31T23:59" value={editor.draft.occurredAt} onChange={event => change('occurredAt', event.target.value)} /></FieldLabel> : <>
            <span><CalendarDays aria-hidden="true" /><time dateTime={entry.occurredAt}>{formatDate(entry.occurredAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}</time></span>
            <span><Clock3 aria-hidden="true" />{formatDate(entry.occurredAt, { hour: '2-digit', minute: '2-digit' })}</span>
          </>}
        </div>
        {editor && (user?.role === 'org_admin' || user?.role === 'superadmin') && <FieldLabel className="mt-3">{t('visibilityLabel')}<Select value={editor.draft.visibility} onChange={event => change('visibility', event.target.value)}>
          <option value="team">{autoT('ui_adc88eec60e4')}</option><option value="admins">{autoT('ui_db8e800f08e5')}</option>
        </Select></FieldLabel>}
        {entry.documentationUpdatedAt && <p className="logbook-reading-update">
          {autoT('ui_dee2fa0b54d8')}{' '}{formatDate(entry.documentationUpdatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
          {entry.documentationUpdatedByName ? ` · ${entry.documentationUpdatedByName}` : ''}
        </p>}
        {entry.status === 'discussed' && <p className="logbook-reading-discussed"><CheckCircle2 aria-hidden="true" />
          <span>{autoT('ui_90f8eeda9786')} {entry.discussedByName || '—'} {autoT('ui_96e8155732e8')} {entry.discussedAt ? formatDate(entry.discussedAt, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}.</span>
        </p>}
      </section>
      <section className="logbook-reading-panel">
        <h2 className="logbook-reading-heading"><FileText aria-hidden="true" />{autoT('ui_0401e23e6030')}</h2>
        {editor ? <Textarea aria-label={autoT('ui_0401e23e6030')} required maxLength={12000} rows={5} value={editor.draft.body} onChange={event => change('body', event.target.value)} /> : <p className="logbook-reading-body">{entry.body}</p>}
      </section>
      {notes.length > 0 && <section className="logbook-reading-panel">
        <h2 className="logbook-reading-heading"><ListChecks aria-hidden="true" />{t('reflectionOutlook')}</h2>
        <div className="logbook-reflection-list">
          {notes.map(({ key, value, title, tone, Icon }) => <div key={tone} className={`logbook-reflection-item logbook-reflection-item--${tone}`}>
            <span className="logbook-reflection-icon"><Icon aria-hidden="true" /></span>
            <div><h3>{title}</h3>{editor ? <Textarea aria-label={title} rows={3} maxLength={6000} value={editor.draft[key]} onChange={event => change(key, event.target.value)} /> : <p>{value}</p>}</div>
          </div>)}
        </div>
      </section>}
      {editor ? <LogbookEditableConnections entry={entry} draft={editor.draft} onChange={editor.onChange} /> : <LogbookConnections entry={entry} />}
    </div>
  );
}
