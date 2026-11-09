import { Crown, Handshake } from 'lucide-react';
import type { Activity } from '@/lib/activities';
import type { Contributor } from '@/lib/contributors';
import { getBadgeBackgroundColor } from '@/lib/colorPalette';

export default function ActivityPeopleBadges({ activity, contributors }: {
  activity: Activity;
  contributors: Map<string, Contributor>;
}) {
  const staff = activity.staff || [];
  const contributions = activity.contributions || [];
  if (!staff.length && !contributions.length) return null;

  const badgeClass = 'activity-mobile-chip inline-flex items-center gap-1 rounded-full border bg-transparent px-2 py-0.5 text-xs text-[var(--text-primary)]';
  return (
    <div className="mt-2 flex flex-wrap gap-2" aria-label="Team-Mitglieder und Mitwirkende">
      {staff.map(member => (
        <span key={`staff-${member.id}`} className={`${badgeClass} border-viridian`} title={`Team: ${member.name}`}>
          <Crown aria-hidden="true" className="h-3 w-3 shrink-0 text-viridian" />
          {member.name}
        </span>
      ))}
      {contributions.map(entry => {
        const person = contributors.get(entry.contributorId);
        const name = person?.name || 'Mitwirkende Person';
        const color = getBadgeBackgroundColor(person?.color, '#7aa39a');
        return (
          <span key={`contributor-${entry.contributorId}`} className={badgeClass} style={{ borderColor: color }} title={`Mitwirkung: ${name}`}>
            <Handshake aria-hidden="true" className="h-3 w-3 shrink-0" style={{ color }} />
            {name}
          </span>
        );
      })}
    </div>
  );
}
