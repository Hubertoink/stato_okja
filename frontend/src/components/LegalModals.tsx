import Modal from '@/components/Modal';

function getAppVersionDisplay() {
  const appVersion = String(import.meta.env.VITE_APP_VERSION || '1.0.0');
  return appVersion.replace(/\.0$/, '');
}

function getCommitDisplay() {
  return import.meta.env.VITE_COMMIT_SHA
    ? String(import.meta.env.VITE_COMMIT_SHA).substring(0, 7)
    : null;
}

export function ImprintModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const appVersionDisplay = getAppVersionDisplay();
  const commitDisplay = getCommitDisplay();

  return (
    <Modal open={open} onClose={onClose} title="Impressum" maxWidth="md">
      <div className="space-y-4 text-sm text-gray-700">
        <section className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900">Angaben gemäß § 5 TMG</h3>
          <p>StatO</p>
          <p>Entwickler: Nikolas Häfner</p>
          <p>Paul-Gerhardt-Str. 5</p>
          <p>68169 Mannheim</p>
        </section>
        <section className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900">Kontakt</h3>
          <p>
            E-Mail:{' '}
            <a href="mailto:hubertoink@outlook.com" className="underline hover:text-viridian">
              hubertoink@outlook.com
            </a>
          </p>
        </section>
        <section className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900">Verantwortlich für den Inhalt</h3>
          <p>Nikolas Häfner</p>
          <p>Paul-Gerhardt-Str. 5</p>
          <p>68169 Mannheim</p>
        </section>
        <section className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900">Projektangaben</h3>
          <p>Software: StatO</p>
          <p>
            Version: {appVersionDisplay}
            {commitDisplay ? ` (${commitDisplay})` : ''}
          </p>
        </section>
      </div>
    </Modal>
  );
}

export function CookieNoticeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Cookies & lokale Speicherung" maxWidth="lg">
      <div className="space-y-5 text-sm text-gray-700">
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Kurzfassung</h3>
          <p>
            StatO setzt in dieser On-Prem-Variante aktuell keine Analyse-, Marketing- oder Social-Media-Cookies ein.
            Für Anmeldung, Sicherheit und Bedienkomfort nutzt die Anwendung technisch notwendige Browser-Speicher.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Session Storage</h3>
          <p>Diese Daten werden tabbezogen gespeichert und in der Regel beim Schließen des Browser-Tabs entfernt.</p>
          <ul className="list-disc pl-5 space-y-1 text-gray-600">
            <li>auth_token: hält die aktuelle Anmeldung während der Sitzung aufrecht</li>
            <li>stato:lastActivityMs: erkennt Inaktivität und unterstützt das automatische Logout</li>
            <li>stato_rq_cache_session_v1: zwischenspeichert geladene Anwendungsdaten für schnellere Seitenwechsel</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Local Storage</h3>
          <p>Zusätzlich speichert StatO lokale Einstellungen im Browser, damit die Oberfläche beim nächsten Besuch konsistent bleibt.</p>
          <ul className="list-disc pl-5 space-y-1 text-gray-600">
            <li>Ausgewählte Organisationsansicht und zuletzt genutzte Oberflächen-Einstellungen</li>
            <li>Filter, Sortierungen und kompakte Darstellungen in einzelnen Ansichten</li>
            <li>Optionale Komfortfunktionen wie Hintergrundauswahl oder ausgeblendete Hinweise</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Cookies</h3>
          <p>
            Die Anwendung selbst setzt nach aktuellem Stand keine eigenen Tracking-Cookies. Falls in Ihrer Infrastruktur zusätzliche
            Cookies durch Reverse-Proxy, SSO oder andere vorgeschaltete Systeme gesetzt werden, werden diese außerhalb von StatO verwaltet.
          </p>
        </section>
      </div>
    </Modal>
  );
}