import { CheckCircle2, ChevronRight, MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { type LogbookEntry, useSetLogbookStatus } from '@/lib/logbook';
import { logbookTypeLabels } from '@/lib/logbookLabels';
import ProtectedImage from '@/components/ProtectedImage';
import LogbookStatusBadge from '@/components/LogbookStatusBadge';
import { Badge } from '@/components/ui/Badge';

function formatDate(value: string) {
  return new Date(value).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AuthorBadge({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-viridian/10 font-semibold text-viridian">
        {avatarUrl ? <ProtectedImage src={avatarUrl} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

export default function LogbookCard({ entry, onOpen }: { entry: LogbookEntry; onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const status = useSetLogbookStatus();
  const canManage = user?.role === 'superadmin' || user?.role === 'org_admin' || user?.id === entry.createdByUserId;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(entry.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(entry.id);
        }
      }}
      className="modern-card cursor-pointer p-4 transition-transform hover:-translate-y-0.5 sm:p-5"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>{formatDate(entry.occurredAt)}</span>
            <Badge variant="neutral">{logbookTypeLabels[entry.type]}</Badge>
            {entry.visibility === 'admins' ? <Badge className="bg-violet-100 text-violet-700">Intern</Badge> : null}
          </div>
          <h3 className="truncate text-base font-semibold text-[var(--text-primary)] sm:text-lg">{entry.title}</h3>
        </div>
        <LogbookStatusBadge className="shrink-0" status={entry.status} />
      </div>
      <p className="mb-4 line-clamp-3 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{entry.body}</p>
      {(entry.project?.title || entry.activity?.title) ? (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {entry.project?.title ? <span className="rounded bg-[var(--surface-2)] px-2 py-1 text-[var(--text-secondary)]">Projekt: {entry.project.title}</span> : null}
          {entry.activity?.title ? <span className="rounded bg-[var(--surface-2)] px-2 py-1 text-[var(--text-secondary)]">Aktivität: {entry.activity.title}</span> : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-secondary)]">
        <div className="min-w-0">
          <AuthorBadge name={entry.createdByName} avatarUrl={entry.createdByUser?.avatarUrl ?? (entry.createdByUserId === user?.id ? user?.avatarUrl : null)} />
          {entry.documentationUpdatedAt ? <span className="mt-1 block text-[11px] text-[var(--text-faint)]">Geändert am {formatDate(entry.documentationUpdatedAt)}</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{entry.commentCount || 0}</span>
          {canManage && entry.status !== 'discussed' && entry.status !== 'archived' ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); status.mutate({ id: entry.id, status: 'discussed' }); }}
              className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-green-700 transition-colors hover:bg-green-50"
              title="Als besprochen markieren"
            >
              <CheckCircle2 className="h-4 w-4" />Besprochen
            </button>
          ) : null}
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </article>
  );
}
