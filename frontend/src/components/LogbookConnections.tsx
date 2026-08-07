import { Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProtectedImage from '@/components/ProtectedImage';
import { autoT } from '@/i18n/auto';
import { colorFromStringHash } from '@/lib/colors';
import type { LogbookEntry } from '@/lib/logbook';

export default function LogbookConnections({ entry }: { entry: LogbookEntry }) {
  const navigate = useNavigate();
  const project = entry.project;
  if (!entry.activity && !project) return null;

  const projectColor = project?.color || (project ? colorFromStringHash(project.title) : undefined);
  const hasProjectSurface = Boolean(project);
  const linkClassName = hasProjectSurface
    ? 'rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/30'
    : 'rounded-lg bg-white px-3 py-2 text-viridian shadow-sm';

  return (
    <section
      className={`relative overflow-hidden rounded-xl border p-4 ${
        hasProjectSurface ? 'border-white/20' : 'border-gray-100 bg-gray-50'
      }`}
      style={project ? { backgroundColor: projectColor } : undefined}
    >
      {project?.imageUrl && (
        <ProtectedImage
          src={project.imageUrl}
          alt=""
          aria-hidden="true"
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {hasProjectSurface && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20"
          aria-hidden="true"
        />
      )}
      <div className="relative">
        <h2
          className={`mb-2 flex items-center gap-2 text-sm font-semibold ${
            hasProjectSurface ? 'text-white' : 'text-gray-700'
          }`}
        >
          <Link2 className="h-4 w-4" />{autoT('ui_0493d567bdb7')}
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {project && (
            <button
              type="button"
              onClick={() => navigate(`/activities?projectId=${encodeURIComponent(project.id)}`)}
              className={linkClassName}
            >
              {autoT('ui_30c095c845e0')}{' '}{project.title}
            </button>
          )}
          {entry.activity && (
            <button
              type="button"
              onClick={() => navigate(`/activities/${entry.activity!.id}`)}
              className={linkClassName}
            >
              {autoT('ui_c71c993f48b0')}{' '}{entry.activity.title || entry.activity.date}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
