import { useProjects, Project } from '@/lib/projects';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function ActivityForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const initialProjectId = params.get('projectId') || '';
  const initialDate = params.get('date') || '';
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const selectedProject: Project | undefined = useMemo(
    () => projects?.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  );
  const [type, setType] = useState<string>('');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [targetGroup, setTargetGroup] = useState<string>('');
  const [date, setDate] = useState<string>(initialDate);

  useEffect(() => {
    if (selectedProject) {
      if (selectedProject.type) setType(selectedProject.type);
      if (selectedProject.defaultStartTime) setStart(selectedProject.defaultStartTime);
      if (selectedProject.defaultEndTime) setEnd(selectedProject.defaultEndTime);
      if (selectedProject.targetGroup) setTargetGroup(selectedProject.targetGroup);
    }
  }, [selectedProject]);
  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Aktivität erfassen</h2>

      <form className="bg-white rounded-lg shadow p-4 md:p-6 space-y-6">
        {/* Projektbezug */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-viridian">Projekt (optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="project-select" className="block text-sm font-medium mb-1">
                Projekt auswählen
              </label>
              <select
                id="project-select"
                title="Projekt auswählen"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Kein Projekt</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {/* Grunddaten */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-viridian">Grunddaten</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date-input" className="block text-sm font-medium mb-1">
                Datum *
              </label>
              <input
                id="date-input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-3"
                title="Datum"
              />
            </div>
            <div>
              <label htmlFor="type-select" className="block text-sm font-medium mb-1">
                Tätigkeitstyp *
              </label>
              <select
                id="type-select"
                title="Tätigkeitstyp"
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-3"
              >
                <option value="">Bitte wählen...</option>
                <option value="open_door">Offene Tür / Bereich</option>
                <option value="project_open">Projekt (offen)</option>
                <option value="project_closed">Projekt (geschlossen)</option>
                <option value="event">Veranstaltung</option>
                <option value="outreach">Aufsuchende Arbeit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Zielgruppe</label>
              <input
                type="text"
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                placeholder="z. B. 12–16 Jahre"
                className="w-full border border-gray-300 rounded px-3 py-3"
              />
            </div>
            <div>
              <label htmlFor="start-time" className="block text-sm font-medium mb-1">
                Startzeit
              </label>
              <input
                id="start-time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                type="time"
                className="w-full border border-gray-300 rounded px-3 py-3"
                placeholder="HH:MM"
                title="Startzeit"
              />
            </div>
            <div>
              <label htmlFor="end-time" className="block text-sm font-medium mb-1">
                Endzeit
              </label>
              <input
                id="end-time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                type="time"
                className="w-full border border-gray-300 rounded px-3 py-3"
                placeholder="HH:MM"
                title="Endzeit"
              />
            </div>
            <div>
              <label htmlFor="location-select" className="block text-sm font-medium mb-1">
                Standort / Raum *
              </label>
              <select
                id="location-select"
                title="Standort / Raum"
                required
                className="w-full border border-gray-300 rounded px-3 py-3"
              >
                <option value="">Bitte wählen...</option>
                <option value="main">Haupthaus</option>
                <option value="media">Medienraum</option>
                <option value="workshop">Werkraum</option>
              </select>
            </div>
          </div>
        </div>

        {/* Teilnehmende */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-viridian">Teilnehmende</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Männlich</label>
              <input
                type="number"
                min="0"
                defaultValue="0"
                className="w-full border border-gray-300 rounded px-3 py-3"
                placeholder="0"
                title="Männlich"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Weiblich</label>
              <input
                type="number"
                min="0"
                defaultValue="0"
                className="w-full border border-gray-300 rounded px-3 py-3"
                placeholder="0"
                title="Weiblich"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Divers</label>
              <input
                type="number"
                min="0"
                defaultValue="0"
                className="w-full border border-gray-300 rounded px-3 py-3"
                placeholder="0"
                title="Divers"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gesamt *</label>
              <input
                type="number"
                min="0"
                required
                className="w-full border border-gray-300 rounded px-3 py-3"
                placeholder="0"
                title="Gesamt"
              />
            </div>
          </div>
        </div>

        {/* Alterskohorten */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-viridian">Alterskohorten</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">6-9 Jahre</label>
              <input
                type="number"
                min="0"
                defaultValue="0"
                className="w-full border border-gray-300 rounded px-3 py-3"
                placeholder="0"
                title="6-9 Jahre"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">10-13 Jahre</label>
              <input
                type="number"
                min="0"
                defaultValue="0"
                className="w-full border border-gray-300 rounded px-3 py-3"
                placeholder="0"
                title="10-13 Jahre"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">14-17 Jahre</label>
              <input
                type="number"
                min="0"
                defaultValue="0"
                className="w-full border border-gray-300 rounded px-3 py-3"
                placeholder="0"
                title="14-17 Jahre"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">18-21 Jahre</label>
              <input
                type="number"
                min="0"
                defaultValue="0"
                className="w-full border border-gray-300 rounded px-3 py-3"
                placeholder="0"
                title="18-21 Jahre"
              />
            </div>
          </div>
        </div>

        {/* Kategorien & Tags */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-viridian">Kategorien & Tags</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kategorien</label>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-cambridge-blue text-white rounded-full text-sm cursor-pointer hover:bg-viridian">
                  Kreativität
                </span>
                <span className="px-3 py-1 bg-mint-green text-viridian rounded-full text-sm cursor-pointer hover:bg-cambridge-blue hover:text-white">
                  Sport
                </span>
                <span className="px-3 py-1 bg-mint-green text-viridian rounded-full text-sm cursor-pointer hover:bg-cambridge-blue hover:text-white">
                  Medien
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tags</label>
              <input
                type="text"
                placeholder="Tag eingeben und Enter drücken..."
                className="w-full border border-gray-300 rounded px-3 py-3"
              />
            </div>
          </div>
        </div>

        {/* Notizen */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-viridian">Notizen</h3>
          <textarea
            rows={5}
            placeholder="Notizen, Ziele, besondere Vorkommnisse..."
            className="w-full border border-gray-300 rounded px-3 py-3"
          ></textarea>
        </div>

        {/* Submit (sticky on mobile) */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-3 pb-safe -mx-4 md:-mx-6 px-4 md:px-6 border-t flex flex-col sm:flex-row gap-4">
          <button
            type="submit"
            className="bg-viridian text-white px-8 py-3 rounded-lg hover:bg-cambridge-blue transition-colors"
          >
            Aktivität speichern
          </button>
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-400 transition-colors"
            onClick={() => navigate(-1)}
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
