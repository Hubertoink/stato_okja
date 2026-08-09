import { Lock, Unlock } from 'lucide-react';
import type { Activity } from '@/lib/activities';

const typeClasses: Record<Activity['type'], string> = {
  open_door: 'bg-emerald-700 text-white',
  project_open: 'bg-viridian text-white',
  project_closed: 'bg-slate-700 text-white',
  event: 'bg-amber-700 text-white',
  outreach: 'bg-red-700 text-white',
};

type ActivityTypeBadgeProps = {
  type: Activity['type'];
  label: string;
  className?: string;
};

export default function ActivityTypeBadge({ type, label, className = '' }: ActivityTypeBadgeProps) {
  if (type === 'project_open' || type === 'project_closed') {
    const Icon = type === 'project_open' ? Unlock : Lock;
    return (
      <span
        className={`activity-type-badge activity-type-badge--project inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-black/10 px-2 py-1 text-xs font-medium tracking-tight ${typeClasses[type]} ${className}`}
        title={label}
        aria-label={label}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" strokeWidth={2} />
        <span>Projekt</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border border-black/10 px-2 py-1 text-xs font-medium tracking-tight ${typeClasses[type]} ${className}`}
      title={label}
      aria-label={label}
    >
      {label}
    </span>
  );
}
