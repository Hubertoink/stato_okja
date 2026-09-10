import { Calendar, CalendarRange, CheckCircle2, ChevronRight, FileText, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LogbookEntry } from '@/lib/logbook';
import { formatDate } from '@/i18n/formatters';
import ProtectedImage from './ProtectedImage';
import LogbookStatusBadge from './LogbookStatusBadge';
import LogbookTypeBadge from './LogbookTypeBadge';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

export default function MobileLogbookCard({ entry, onOpen, onMarkDiscussed, avatarUrl }: {
  entry: LogbookEntry;
  onOpen: (id: string) => void;
  onMarkDiscussed?: () => void;
  avatarUrl?: string | null;
}) {
  const { t } = useTranslation(['logbook', 'common']);
  return (
    <article className="mobile-logbook-card" role="button" tabIndex={0} aria-label={entry.title}
      onClick={() => onOpen(entry.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(entry.id); }
      }}>
      <div className="mobile-logbook-status">
        <div className="mobile-logbook-status-badges"><LogbookStatusBadge status={entry.status} />{entry.isUnread && <Badge variant="accent">{t('newBadge')}</Badge>}</div>
        {entry.activity?.title && <span className="mobile-logbook-activity" title={t('card.activity', { name: entry.activity.title })} aria-label={t('card.activity', { name: entry.activity.title })}><CalendarRange aria-hidden="true" /><span>{entry.activity.title}</span></span>}
      </div>
      <h3 className="mobile-logbook-title">{entry.title}</h3>
      <div className="mobile-logbook-date"><Calendar aria-hidden="true" /><span>{formatDate(entry.occurredAt, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
      <div className="mobile-logbook-excerpt"><span className="mobile-logbook-document"><FileText aria-hidden="true" /></span><p>{entry.body}</p></div>
      <div className="mobile-logbook-author">
        <span className="mobile-logbook-avatar">{(entry.createdByUser?.avatarUrl || avatarUrl) ? <ProtectedImage src={entry.createdByUser?.avatarUrl || avatarUrl} alt="" className="h-full w-full object-cover" /> : <span aria-hidden="true">{entry.createdByName.trim().split(/\s+/).filter(Boolean).map((part, index, parts) => index === 0 || index === parts.length - 1 ? part[0] : '').join('').toUpperCase()}</span>}</span>
        <div><span className="mobile-logbook-author-name">{entry.createdByName}</span>{entry.documentationUpdatedAt && <span className="mobile-logbook-updated">{t('card.changed', { date: formatDate(entry.documentationUpdatedAt, { dateStyle: 'short', timeStyle: 'short' }) })}</span>}</div>
        <LogbookTypeBadge type={entry.type} label={t(`types.${entry.type}`)} />
      </div>
      <div className="mobile-logbook-footer">
        {onMarkDiscussed && <Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); onMarkDiscussed(); }}><CheckCircle2 className="h-4 w-4" />{t('card.markDiscussed')}</Button>}
        <Button variant="ghost" size="sm" className="mobile-logbook-open" onClick={(event) => { event.stopPropagation(); onOpen(entry.id); }}><MessageCircle className="h-4 w-4" /><span>{entry.commentCount || 0} Kommentare</span><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </article>
  );
}
