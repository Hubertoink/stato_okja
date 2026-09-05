import { getPasswordRequirementStates } from '@/lib/passwordPolicy';

export default function PasswordRequirementsHint({
  password,
  className = '',
  listClassName = '',
}: {
  password: string;
  className?: string;
  listClassName?: string;
}) {
  const hasInput = password.trim().length > 0;
  const requirements = getPasswordRequirementStates(password);

  return (
    <div
      className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-3 ${className}`.trim()}
    >
      <div className={`grid gap-1.5 ${listClassName}`.trim()}>
        {requirements.map((requirement) => {
          const toneClass = requirement.met
            ? 'text-[var(--status-success-text)]'
            : hasInput
              ? 'text-[var(--status-warning-text)]'
              : 'text-[var(--text-muted)]';
          const markerClass = requirement.met
            ? 'border-[var(--status-success-text)] bg-[var(--status-success-text)]'
            : hasInput
              ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]'
              : 'border-[var(--border-strong)] bg-[var(--surface-1)]';

          return (
            <div key={requirement.id} className={`flex items-center gap-2 text-xs ${toneClass}`}>
              <span
                className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${markerClass}`}
              >
                {requirement.met ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--surface-elevated)]" />
                ) : null}
              </span>
              <span>{requirement.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
