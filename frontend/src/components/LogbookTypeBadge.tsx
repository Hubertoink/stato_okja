import type { LogbookEntryType } from '@/lib/logbook';

const typeClasses: Record<LogbookEntryType, string> = {
  observation: 'border-sky-500 text-sky-700',
  incident: 'border-red-500 text-red-700',
  success: 'border-emerald-500 text-emerald-700',
  handover: 'border-violet-500 text-violet-700',
  debrief: 'border-amber-500 text-amber-700',
  other: 'border-slate-400 text-slate-700',
};

export default function LogbookTypeBadge({
  type,
  label,
  className = '',
}: {
  type: LogbookEntryType;
  label: string;
  className?: string;
}) {
  return (
    <span
      aria-label={label}
      className={`inline-flex items-center whitespace-nowrap rounded-full border bg-transparent px-2.5 py-1 text-xs font-medium ${typeClasses[type]} ${className}`}
      title={label}
    >
      {label}
    </span>
  );
}
