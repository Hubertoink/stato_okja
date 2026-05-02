import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, Lightbulb, X } from 'lucide-react';
import { useIsMobile } from '@/lib/useIsMobile';
import { demoModeEnabled } from './config';

type DemoMobilePageGuide = {
  key: string;
  title: string;
  scenario: string;
  options: string[];
  tryThis: string;
};

const PAGE_GUIDES: Record<string, DemoMobilePageGuide> = {
  dashboard: {
    key: 'dashboard',
    title: 'Home: Tagesstart in der Demo',
    scenario: 'Stell dir vor, du startest den Dienst und willst schnell sehen, was heute ansteht und wo noch Dokumentation fehlt.',
    options: [
      'heutige Aktivitäten und offene Aufgaben überblicken',
      'schnell eine Aktivität aus dem Alltag erfassen',
      'von hier direkt in Kalender, Projekte oder Auswertung springen',
    ],
    tryThis: 'Prüfe zuerst die heutigen Einträge und wechsle danach in den Kalender.',
  },
  activities: {
    key: 'activities',
    title: 'Aktivitäten: Dokumentation prüfen',
    scenario: 'Nutze diese Seite, wenn du Angebote nacherfasst, bestehende Einträge kontrollierst oder gezielt nach Typ, Projekt und Status suchst.',
    options: [
      'Aktivitäten filtern und Details öffnen',
      'Teilnahmen, Zeiten und Status nachvollziehen',
      'neue Dokumentationen aus der Liste heraus starten',
    ],
    tryThis: 'Filtere nach einem Projekt und öffne anschließend einen Beispiel-Eintrag.',
  },
  calendar: {
    key: 'calendar',
    title: 'Kalender: Planung im Wochenfluss',
    scenario: 'Der mobile Kalender hilft dir, Angebote im Tages- oder 3-Tage-Kontext zu planen und schnell zu erkennen, wo noch Einträge fehlen.',
    options: [
      'zwischen Monats- und 3-Tage-Ansicht wechseln',
      'Plus-Buttons für neue Aktivitäten pro Tag nutzen',
      'Schließzeiten und geplante Angebote im Zusammenhang sehen',
    ],
    tryThis: 'Wechsle in die 3-Tage-Ansicht und tippe auf einen Plus-Button.',
  },
  projects: {
    key: 'projects',
    title: 'Projekte: Angebotsstruktur vorbereiten',
    scenario: 'Hier legst du die fachliche Struktur an, damit wiederkehrende Angebote später schneller dokumentiert und ausgewertet werden können.',
    options: [
      'aktive Projekte und Angebotsreihen vergleichen',
      'Kategorien, Tags und Zeiten am Projekt nachvollziehen',
      'Projektvorlagen als Ausgangspunkt für neue Angebote nutzen',
    ],
    tryThis: 'Öffne ein Projekt und achte darauf, welche Daten später in Aktivitäten wieder auftauchen.',
  },
  statistics: {
    key: 'statistics',
    title: 'Statistiken: Berichtssituation simulieren',
    scenario: 'Diese Ansicht ist für Auswertungen gedacht, etwa wenn du Zahlen für Träger, Jahresbericht oder Teamreflexion vorbereitest.',
    options: [
      'Zeitraum, Typ, Projekt und Status kombinieren',
      'Kennzahlen zwischen absoluten und durchschnittlichen Werten wechseln',
      'Diagramme und Tabellen als PDF oder Excel exportieren',
    ],
    tryThis: 'Setze einen Jahresfilter und schalte bei den Kennzahlen auf Durchschnittswerte.',
  },
  settings: {
    key: 'settings',
    title: 'Einstellungen: Stammdaten verstehen',
    scenario: 'In den Einstellungen pflegst du die Begriffe, Orte, Gruppen und Regeln, die später in Dokumentation, Kalender und Statistik zusammenwirken.',
    options: [
      'Kategorien, Tags und Kohorten als Auswertungsbasis prüfen',
      'Team und Einrichtungen für spätere Zuordnung ansehen',
      'Öffnungszeiten und Feiertage als Kalenderkontext nutzen',
    ],
    tryThis: 'Wechsle zwischen Kategorien und Einrichtungen und vergleiche, wie die Stammdaten aufgebaut sind.',
  },
};

function guideForPath(pathname: string) {
  const section = pathname.split('/').filter(Boolean)[0] || 'dashboard';
  return PAGE_GUIDES[section] ?? null;
}

export default function DemoMobilePageGuide() {
  const location = useLocation();
  const isMobile = useIsMobile(768);
  const guide = useMemo(() => guideForPath(location.pathname), [location.pathname]);
  const [open, setOpen] = useState(false);
  const guideKey = guide?.key ?? '';

  useEffect(() => {
    if (!demoModeEnabled || !isMobile || !guide) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [guideKey, guide, isMobile]);

  if (!demoModeEnabled || !isMobile || !guide || !open) return null;

  return (
    <div className="demo-mobile-page-guide-shell" aria-live="polite">
      <section
        className="demo-mobile-page-guide"
        role="dialog"
        aria-modal="false"
        aria-labelledby="demo-mobile-page-guide-title"
      >
        <button
          type="button"
          className="demo-mobile-page-guide-close"
          aria-label="Demo-Szenario schließen"
          onClick={() => setOpen(false)}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        <div className="demo-mobile-page-guide-kicker">Demo-Szenario</div>
        <h3 id="demo-mobile-page-guide-title" className="demo-mobile-page-guide-title">
          {guide.title}
        </h3>
        <p className="demo-mobile-page-guide-scenario">{guide.scenario}</p>

        <div className="demo-mobile-page-guide-section-label">Möglichkeiten auf dieser Seite</div>
        <ul className="demo-mobile-page-guide-options">
          {guide.options.map((option) => (
            <li key={option}>
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              <span>{option}</span>
            </li>
          ))}
        </ul>

        <div className="demo-mobile-page-guide-try">
          <Lightbulb aria-hidden="true" className="h-4 w-4" />
          <span>{guide.tryThis}</span>
        </div>
        <button
          type="button"
          className="demo-mobile-page-guide-action"
          onClick={() => setOpen(false)}
        >
          Verstanden
        </button>
      </section>
    </div>
  );
}