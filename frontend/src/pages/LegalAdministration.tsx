import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  downloadLegalDocument,
  getLegalImportErrorMessage,
  type LegalDocumentFiles,
  useImportLegalContent,
  useLegalContentForImport,
} from '@/lib/legalAdministration';
import type { LegalDocumentKey } from '@/lib/legalContent';

const documents: Array<{ key: LegalDocumentKey; label: string; hint: string }> = [
  { key: 'imprint', label: 'Impressum', hint: 'z. B. imprint.de.md' },
  { key: 'privacy', label: 'Datenschutz', hint: 'z. B. privacy.de.md' },
  { key: 'terms', label: 'Nutzungsbedingungen', hint: 'z. B. terms.de.md' },
];

export default function LegalAdministration() {
  const { showToast } = useToast();
  const importMutation = useImportLegalContent();
  const current = useLegalContentForImport();
  const [files, setFiles] = useState<LegalDocumentFiles>({});
  const inputRefs = useRef<Partial<Record<LegalDocumentKey, HTMLInputElement>>>({});
  const hasSelection = documents.some(({ key }) => files[key]);

  function selectFile(key: LegalDocumentKey, file?: File) {
    setFiles((previous) => ({ ...previous, [key]: file }));
  }

  async function importFiles() {
    if (!hasSelection) return;
    const termsChanged = !!files.terms;
    try {
      await importMutation.mutateAsync(files);
      setFiles({});
      for (const input of Object.values(inputRefs.current)) if (input) input.value = '';
      showToast(termsChanged
        ? 'Die Rechtstexte wurden übernommen. Nutzer:innen müssen den neuen Nutzungsbedingungen zustimmen.'
        : 'Die ausgewählten Rechtstexte wurden übernommen.');
    } catch (error) {
      showToast(getLegalImportErrorMessage(error), { type: 'error', durationMs: 6000 });
    }
  }

  async function download(key: LegalDocumentKey) {
    try {
      await downloadLegalDocument(key);
    } catch (error) {
      showToast(getLegalImportErrorMessage(error), { type: 'error', durationMs: 5000 });
    }
  }

  function formatUpdatedAt(value?: string) {
    if (!value) return 'Unbekannt';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-viridian">Rechtstexte</h2>
        <p className="mt-1 text-gray-600">Organisationsspezifische Texte importieren oder die aktuell verwendete Fassung herunterladen.</p>
      </div>

      <section className="system-data-panel overflow-hidden rounded-xl border shadow-sm">
        <div className="system-data-panel-header border-b px-5 py-4">
          <h3 className="system-data-panel-title font-semibold">Markdown importieren</h3>
          <p className="system-data-panel-copy mt-1 text-sm">Wähle einen oder mehrere Texte aus. Nur die ausgewählten Dateien werden ersetzt und bleiben bei App-Updates erhalten.</p>
        </div>
        <div className="space-y-4 p-5">
          {documents.map(({ key, label, hint }) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">{label}</span>
                <span className="block text-xs text-gray-500">{files[key]?.name || hint}</span>
                <span className="mt-1 block text-xs font-medium text-viridian">Zuletzt aktualisiert: {formatUpdatedAt(current.data?.documents[key].updatedAt)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  aria-label={`${label} herunterladen`}
                  title={`${label} herunterladen`}
                  onClick={() => void download(key)}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                </button>
                <label htmlFor={`legal-file-${key}`} className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Datei wählen</label>
              </span>
              <input
                id={`legal-file-${key}`}
                ref={(element) => { inputRefs.current[key] = element || undefined; }}
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                className="sr-only"
                onChange={(event) => selectFile(key, event.target.files?.[0])}
              />
            </div>
          ))}
          {files.terms ? (
            <p className="system-data-banner system-data-banner-warning rounded-xl px-4 py-3 text-sm">
              Durch den Import der Nutzungsbedingungen müssen bestehende Nutzer:innen der neuen Version erneut zustimmen.
            </p>
          ) : null}
          <button
            type="button"
            className="dashboard-accent-solid-button min-h-11 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasSelection || importMutation.isPending}
            onClick={importFiles}
          >
            {importMutation.isPending ? 'Texte werden importiert …' : 'Ausgewählte Texte importieren'}
          </button>
        </div>
      </section>

    </div>
  );
}
