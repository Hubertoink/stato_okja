import Modal from '@/components/Modal';

export const TERMS_OF_USE_VERSION = '2026-07-15';

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
    <Modal open={open} onClose={onClose} title="Impressum" maxWidth="md" variant="information">
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
          <p>
            Repository:{' '}
            <a
              href="https://github.com/Hubertoink/stato_okja"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-viridian"
            >
              github.com/Hubertoink/stato_okja
            </a>
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
    <Modal open={open} onClose={onClose} title="Cookies & lokale Speicherung" maxWidth="lg" variant="information">
      <div className="space-y-5 text-sm text-gray-700">
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Kurzfassung</h3>
          <p>
            StatO setzt aktuell keine Analyse-, Marketing- oder Social-Media-Cookies ein.
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

export function PrivacyNoticeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Datenschutz & Datenverwendung" maxWidth="lg" variant="information">
      <div className="space-y-5 text-sm text-gray-700">
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Verantwortliche Stelle</h3>
          <p>
            Verantwortlich für die Verarbeitung ist die Organisation, die diese StatO-Instanz betreibt.
            Die vollständigen Kontaktdaten und eine Ansprechperson finden Sie im Impressum oder erhalten
            Sie bei Ihrer Organisationsleitung bzw. Administration.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Wofür verwenden wir Daten?</h3>
          <p>
            StatO verarbeitet Daten zur Anmeldung und Rechteverwaltung, zur Dokumentation der OKJA-Arbeit,
            für Auswertungen und Berichte sowie zur Gewährleistung von Betrieb, Sicherheit und Fehleranalyse.
            Die Daten werden nicht für Werbung, Profiling oder Tracking verwendet.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Welche Daten können betroffen sein?</h3>
          <ul className="list-disc space-y-1 pl-5 text-gray-600">
            <li>Kontodaten wie Name, E-Mail-Adresse, Rolle und optionales Profilbild</li>
            <li>Fachliche Eingaben wie Aktivitäten, Projekte, Logbuch- und Statistikdaten</li>
            <li>Technische Sicherheits- und Protokolldaten, etwa Anmelde- und Änderungsereignisse</li>
          </ul>
          <p className="text-gray-600">
            Bitte tragen Sie keine besonderen Kategorien personenbezogener Daten oder andere unnötig sensible
            Angaben ein, sofern dies nicht ausdrücklich erforderlich und organisatorisch freigegeben ist.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Zugriff, Weitergabe und Speicherdauer</h3>
          <p>
            Zugriff erhalten nur berechtigte Personen entsprechend ihrer Rolle und Organisationszuordnung.
            Eine Weitergabe erfolgt nur, soweit sie für Betrieb, Hosting oder gesetzliche Aufgaben erforderlich
            ist. Inhalte werden nach den Vorgaben der verantwortlichen Organisation und gesetzlichen
            Aufbewahrungsfristen gespeichert bzw. gelöscht.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Ihre Rechte</h3>
          <p>
            Sie können sich an die verantwortliche Stelle wenden, um Auskunft, Berichtigung, Löschung,
            Einschränkung der Verarbeitung, Datenübertragbarkeit oder – soweit anwendbar – Widerspruch zu
            verlangen. Außerdem besteht ein Beschwerderecht bei der zuständigen Datenschutzaufsichtsbehörde.
          </p>
        </section>

        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Dieser Hinweis beschreibt die Standardfunktionen von StatO. Die betreibende Organisation muss ihn
          vor dem Produktiveinsatz um ihre konkrete Rechtsgrundlage, Empfänger, Fristen und Kontaktdaten
          ergänzen.
        </p>
      </div>
    </Modal>
  );
}

export function TermsOfUseModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Nutzungsbedingungen" maxWidth="lg" variant="information">
      <div className="space-y-5 text-sm text-gray-700">
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">1. Geltungsbereich und Zweck</h3>
          <p>
            Diese Nutzungsbedingungen gelten für die Verwendung dieser StatO-Instanz. StatO unterstützt
            Einrichtungen der Offenen Kinder- und Jugendarbeit bei Dokumentation, Auswertung und
            Weiterentwicklung ihrer Arbeit.
          </p>
          <p className="text-xs text-gray-500">Stand: {TERMS_OF_USE_VERSION}</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">2. Benutzerkonten und Zugriffsrechte</h3>
          <p>
            Konten sind personengebunden. Zugangsdaten dürfen nicht weitergegeben werden und sind vor dem
            Zugriff Unbefugter zu schützen. Organisations-Administrationen vergeben Zugriffsrechte nach dem
            Erforderlichkeitsprinzip und deaktivieren Konten ausgeschiedener Mitarbeitender zeitnah.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">3. Datenminimierung bei Teilnehmenden</h3>
          <p>
            StatO erfordert für die Statistik grundsätzlich keine personenbezogenen Teilnehmendendaten;
            vorgesehen sind vor allem aggregierte Angaben und Zählwerte. Namen dürfen nur eingetragen werden,
            wenn sie für einen klaren fachlichen Zweck erforderlich sind und die verantwortliche Organisation
            hierfür eine geeignete Rechtsgrundlage sowie die erforderlichen Informationen sichergestellt hat.
          </p>
          <p className="text-gray-600">
            Besondere Kategorien personenbezogener Daten – etwa Angaben zu Gesundheit, Herkunft, Religion,
            politischen Ansichten, Sexualleben oder strafrechtlichen Vorwürfen – dürfen nicht in StatO erfasst
            werden.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">4. Inhalte, Vertraulichkeit und Rechte Dritter</h3>
          <p>
            Nutzende sind für die Rechtmäßigkeit, Richtigkeit und Angemessenheit ihrer Eingaben verantwortlich.
            Informationen aus StatO dürfen nur im Rahmen der eigenen Berechtigung und des jeweiligen
            Organisationszwecks verwendet werden. Vertrauliche Inhalte und Daten Dritter sind zu schützen.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">5. Datenschutz und Datenhoheit</h3>
          <p>
            Für die in der Instanz erfassten Fach- und Kontodaten ist die betreibende Organisation
            datenschutzrechtlich verantwortlich. Die Daten verbleiben bei dieser Organisation und dienen der
            Dokumentation, internen Auswertung und Berichterstattung. Details sind den Datenschutzhinweisen
            und den organisationsspezifischen Regelungen zu entnehmen.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">6. Sichere und zulässige Nutzung</h3>
          <p>
            Es ist untersagt, Sicherheitsmechanismen zu umgehen, Schadsoftware einzubringen, fremde Konten zu
            verwenden oder die Anwendung zu beeinträchtigen. Verdächtige Zugriffe und Datenschutzvorfälle sind
            unverzüglich der zuständigen Organisationsadministration zu melden.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">7. Betrieb und Änderungen</h3>
          <p>
            Wartungsarbeiten, Sicherheitsmaßnahmen und Weiterentwicklungen können die Verfügbarkeit zeitweise
            einschränken. Die betreibende Organisation kann Zugänge bei Missbrauch oder Sicherheitsrisiken
            beschränken und diese Nutzungsbedingungen bei sachlichem Anlass aktualisieren.
          </p>
        </section>

        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Diese Fassung ist eine organisationsneutrale Nutzungsregelung. Für verbindliche Vertragsbedingungen
          oder einen Auftragsverarbeitungsvertrag müssen Betreiber, Hosting, Support, Löschfristen und
          Rechtsgrundlagen konkret ergänzt und rechtlich geprüft werden.
        </p>
      </div>
    </Modal>
  );
}
