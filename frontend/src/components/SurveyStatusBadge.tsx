import type { SurveyStatus } from '@/lib/surveys';

const labels: Record<SurveyStatus, string> = {
  draft: 'Entwurf',
  active: 'Aktiv',
  closed: 'Beendet',
  archived: 'Archiviert',
};

const colors: Record<SurveyStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  closed: 'bg-amber-100 text-amber-800 ring-amber-200',
  archived: 'bg-violet-100 text-violet-800 ring-violet-200',
};

export function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${colors[status]}`}>{labels[status]}</span>;
}
