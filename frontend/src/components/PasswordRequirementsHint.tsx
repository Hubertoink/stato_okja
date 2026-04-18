import { getPasswordRequirementStates, PASSWORD_REQUIREMENTS_TEXT } from '@/lib/passwordPolicy';

export default function PasswordRequirementsHint({
  password,
  className = '',
}: {
  password: string;
  className?: string;
}) {
  const hasInput = password.trim().length > 0;
  const requirements = getPasswordRequirementStates(password);

  return (
    <div className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 ${className}`.trim()}>
      <div className="text-xs font-medium text-gray-700">{PASSWORD_REQUIREMENTS_TEXT}</div>
      <div className="mt-2 space-y-1.5">
        {requirements.map((requirement) => {
          const toneClass = requirement.met
            ? 'text-emerald-700'
            : hasInput
              ? 'text-amber-800'
              : 'text-gray-500';
          const markerClass = requirement.met
            ? 'border-emerald-600 bg-emerald-600'
            : hasInput
              ? 'border-amber-500 bg-amber-100'
              : 'border-gray-300 bg-white';

          return (
            <div key={requirement.id} className={`flex items-center gap-2 text-xs ${toneClass}`}>
              <span className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${markerClass}`}>
                {requirement.met ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
              </span>
              <span>{requirement.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}