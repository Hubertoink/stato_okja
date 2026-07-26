import Modal from '@/components/Modal';
import LegalDocumentContent from '@/components/LegalDocumentContent';
import { type LegalDocumentKey, useLegalContent } from '@/lib/legalContent';

function LegalDocumentModal({
  documentKey,
  open,
  onClose,
}: {
  documentKey: LegalDocumentKey;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isError, isLoading } = useLegalContent();
  const document = data?.documents[documentKey];
  const fallbackTitles: Record<LegalDocumentKey, string> = {
    imprint: 'Impressum',
    privacy: 'Datenschutz & Datenverwendung',
    terms: 'Nutzungsbedingungen',
  };

  return (
    <Modal open={open} onClose={onClose} title={document?.title || fallbackTitles[documentKey]} maxWidth="lg" variant="information">
      {isLoading ? <p className="py-4 text-sm text-gray-600">Rechtstext wird geladen…</p> : null}
      {isError ? <p className="py-4 text-sm text-red-700">Der Rechtstext konnte nicht geladen werden. Bitte wenden Sie sich an die Administration.</p> : null}
      {document ? <LegalDocumentContent content={document.content} /> : null}
      {documentKey === 'terms' && data?.termsVersion ? (
        <p className="mt-5 text-xs text-gray-500">Stand: {data.termsVersion}</p>
      ) : null}
    </Modal>
  );
}

export function ImprintModal(props: { open: boolean; onClose: () => void }) {
  return <LegalDocumentModal {...props} documentKey="imprint" />;
}

export function PrivacyNoticeModal(props: { open: boolean; onClose: () => void }) {
  return <LegalDocumentModal {...props} documentKey="privacy" />;
}

export function TermsOfUseModal(props: { open: boolean; onClose: () => void }) {
  return <LegalDocumentModal {...props} documentKey="terms" />;
}

export function CookieNoticeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Cookies & lokale Speicherung" maxWidth="lg" variant="information">
      <div className="space-y-5 text-sm text-gray-700">
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Kurzfassung</h3>
          <p>StatO setzt aktuell keine Analyse-, Marketing- oder Social-Media-Cookies ein. Für Anmeldung, Sicherheit und Bedienkomfort nutzt die Anwendung technisch notwendige Browser-Speicher.</p>
        </section>
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Session Storage</h3>
          <p>Diese Daten werden tabbezogen gespeichert und in der Regel beim Schließen des Browser-Tabs entfernt.</p>
          <ul className="list-disc space-y-1 pl-5 text-gray-600">
            <li>auth_token: hält die aktuelle Anmeldung während der Sitzung aufrecht</li>
            <li>stato:lastActivityMs: erkennt Inaktivität und unterstützt das automatische Logout</li>
            <li>stato_rq_cache_session_v1: zwischenspeichert geladene Anwendungsdaten für schnellere Seitenwechsel</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Local Storage</h3>
          <p>Zusätzlich speichert StatO lokale Einstellungen im Browser, damit die Oberfläche beim nächsten Besuch konsistent bleibt.</p>
          <ul className="list-disc space-y-1 pl-5 text-gray-600">
            <li>Ausgewählte Organisationsansicht und zuletzt genutzte Oberflächen-Einstellungen</li>
            <li>Filter, Sortierungen und kompakte Darstellungen in einzelnen Ansichten</li>
            <li>Optionale Komfortfunktionen wie Hintergrundauswahl oder ausgeblendete Hinweise</li>
            <li>Bei einer öffentlichen Umfrage: ein zufälliger Browser-Schlüssel, damit bei aktivierter Einmal-Teilnahme nicht mehrfach abgestimmt wird</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">Cookies</h3>
          <p>Die Anwendung selbst setzt nach aktuellem Stand keine eigenen Tracking-Cookies. Falls in Ihrer Infrastruktur zusätzliche Cookies durch Reverse-Proxy, SSO oder andere vorgeschaltete Systeme gesetzt werden, werden diese außerhalb von StatO verwaltet.</p>
        </section>
      </div>
    </Modal>
  );
}
