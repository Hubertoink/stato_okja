import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Archive,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileDown,
  Pencil,
  Play,
  Plus,
  Printer,
  QrCode,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ConfirmModal';
import { Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/Toast';
import {
  type Survey,
  type SurveyQuestion,
  useCloseSurvey,
  useCreateSurveyRound,
  useDeleteSurveyRound,
  useDeleteSurveyResponse,
  useStartSurvey,
  useSurvey,
  useSurveyAnalytics,
  useSurveyResponses,
  useSurveyRounds,
  useSurveyTrend,
} from '@/lib/surveys';
import { SurveyEditor } from './Surveys';
import { SurveyStatusBadge } from '@/components/SurveyStatusBadge';
import { StatisticsExportActions } from './StatisticsExportActions';
import ExportProgressModal from '@/components/ExportProgressModal';
import Modal from '@/components/Modal';

const SURVEY_EXPORT_SCALE = 2;
const SURVEY_EXPORT_MARGIN_MM = 10;
const SURVEY_EXPORT_HEADER_HEIGHT_MM = 24;
const TREND_COLORS = ['#0f766e', '#2563eb', '#9333ea', '#ea580c', '#db2777', '#0891b2'];

let surveyExportDependenciesPromise: Promise<{
  JsPDF: typeof import('jspdf').default;
  html2canvas: typeof import('html2canvas').default;
}> | null = null;

function loadSurveyExportDependencies() {
  if (!surveyExportDependenciesPromise) {
    surveyExportDependenciesPromise = Promise.all([import('jspdf'), import('html2canvas')]).then(
      ([jspdfModule, html2canvasModule]) => ({
        JsPDF: jspdfModule.default,
        html2canvas: html2canvasModule.default,
      }),
    );
  }

  return surveyExportDependenciesPromise;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed.'))),
      'image/png',
    );
  });
}

function exportFilename(title: string, extension: 'png' | 'pdf' | 'xlsx') {
  const segment = title
    .toLocaleLowerCase('de-DE')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9äöüß_-]+/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `stato-umfrage-${segment || 'auswertung'}.${extension}`;
}

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
    : '–';
}

function displayStart(survey: Survey) {
  return formatDate(survey.startsAt || survey.startedAt || null);
}

function displayEnd(survey: Survey) {
  return formatDate(survey.endsAt || survey.closedAt || null);
}
function answerLabel(
  question: SurveyQuestion | undefined,
  value: string | string[] | number | null | undefined,
) {
  if (value === null || typeof value === 'undefined' || value === '') return '–';
  const label = (entry: string | number) =>
    question?.options?.find((option) => option.id === entry)?.label || String(entry);
  return Array.isArray(value) ? value.map(label).join(', ') : label(value);
}

function SurveyChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { name?: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-[var(--text-primary)]">{entry.payload?.name}</p>
      <p className="mt-1 text-viridian">{entry.value ?? 0} Antworten</p>
    </div>
  );
}

function SurveyQr({ url, onReady }: { url: string; onReady?: (src: string) => void }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(url, {
      width: 300,
      margin: 1,
      color: { dark: '#064e3b', light: '#ffffff' },
    }).then((next) => {
      if (alive) {
        setSrc(next);
        onReady?.(next);
      }
    });
    return () => {
      alive = false;
    };
  }, [url, onReady]);
  return src ? (
    <img
      className="mx-auto h-44 w-44 rounded-xl bg-white p-2"
      src={src}
      alt="QR-Code zur Umfrage"
    />
  ) : (
    <div className="mx-auto h-44 w-44 animate-pulse rounded-xl bg-[var(--surface-3)]" />
  );
}

function questionTypeLabel(type: SurveyQuestion['type']) {
  return {
    single_choice: 'Eine Auswahl',
    multiple_choice: 'Mehrere Auswahl',
    scale: 'Bewertungsskala',
    text: 'Freitext',
  }[type];
}

function SurveyQuestionsPreview({ questions }: { questions: SurveyQuestion[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5">
        <div>
          <h3 className="font-semibold text-viridian">Fragen</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {questions.length} {questions.length === 1 ? 'Frage' : 'Fragen'} in dieser Umfrage
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Fragen ansehen
        </Button>
      </section>
      <Modal open={open} onClose={() => setOpen(false)} title="Fragen der Umfrage" maxWidth="3xl">
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Die Fragen sind für alle Umfragerunden dieser Reihe gleich und können hier nur
            eingesehen werden.
          </p>
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-viridian">Frage {index + 1}</p>
                  <p className="mt-1 font-medium text-[var(--text-primary)]">{question.label}</p>
                </div>
                <span className="rounded-full bg-[var(--surface-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                  {questionTypeLabel(question.type)}
                </span>
              </div>
              {question.type === 'scale' ? (
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                  <span>
                    {question.scaleMin ?? 1} · {question.scaleMinLabel || 'trifft nicht zu'}
                  </span>
                  <span className="text-right">
                    {question.scaleMax ?? 5} · {question.scaleMaxLabel || 'trifft zu'}
                  </span>
                </div>
              ) : null}
              {(question.type === 'single_choice' || question.type === 'multiple_choice') &&
              question.options?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {question.options.map((option) => (
                    <span
                      key={option.id}
                      className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                    >
                      {option.label}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-xs text-[var(--text-secondary)]">
                {question.required ? 'Antwort erforderlich' : 'Antwort freiwillig'}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Schließen
          </Button>
        </div>
      </Modal>
    </>
  );
}

function SurveyOverview({
  survey,
  rounds,
  selectedRoundId,
  onSelectRound,
  link,
  onQrReady,
  onDownloadQr,
  onCopy,
  onPrint,
  onDeleteDraftRound,
}: {
  survey: Survey;
  rounds: Survey[];
  selectedRoundId: string;
  onSelectRound: (id: string) => void;
  link: string;
  onQrReady: (src: string) => void;
  onDownloadQr: () => void;
  onCopy: () => void;
  onPrint: () => void;
  onDeleteDraftRound: (round: Survey) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <SurfaceCard>
        <h2 className="text-lg font-semibold text-viridian">Umfrage</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--text-secondary)]">Status</dt>
            <dd className="mt-1">
              <SurveyStatusBadge status={survey.status} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-secondary)]">Teilnahmemodus</dt>
            <dd className="mt-1 font-medium">
              {survey.allowMultiplePerDevice
                ? 'Mehrere Antworten pro Gerät'
                : 'Eine Antwort pro Browser'}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-secondary)]">Start</dt>
            <dd className="mt-1">{displayStart(survey)}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-secondary)]">Ende</dt>
            <dd className="mt-1">{displayEnd(survey)}</dd>
          </div>
          {survey.rawResponsesPurgeAt ? (
            <div className="sm:col-span-2">
              <dt className="text-[var(--text-secondary)]">Einzelantworten werden gelöscht am</dt>
              <dd className="mt-1">{formatDate(survey.rawResponsesPurgeAt)}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-5 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
          {survey.introduction || 'Keine Einleitung hinterlegt.'}
        </p>
        <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-viridian">Umfragerunden</h3>
            <span className="text-sm text-[var(--text-secondary)]">
              {rounds.length} {rounds.length === 1 ? 'Runde' : 'Runden'}
            </span>
          </div>
          <div>
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <th className="w-[28%] px-2 py-2">Runde</th>
                  <th className="w-[38%] px-2 py-2">Status</th>
                  <th className="w-[26%] px-2 py-2 text-right">Antworten</th>
                  <th className="w-12 px-2 py-2"><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => (
                  <tr
                    key={round.id}
                    className={`group cursor-pointer border-b border-[var(--border-subtle)] last:border-0 ${round.id === selectedRoundId ? 'bg-[var(--interactive-soft)]' : 'hover:bg-[var(--surface-2)]'}`}
                    onClick={() => onSelectRound(round.id)}
                  >
                    <td className="px-2 py-3 font-medium">Runde {round.roundNumber || 1}</td>
                    <td className="px-2 py-3">
                      <SurveyStatusBadge status={round.status} />
                    </td>
                    <td className="px-2 py-3 text-right">{round.responsesCount}</td>
                    <td className="px-2 py-2 text-right">{round.status === 'draft' && (round.roundNumber || 1) > 1 ? <span className="tooltip-wrapper inline-flex"><Button size="icon" variant="ghost" className="h-8 w-8 text-red-700 hover:bg-red-50 hover:text-red-700" aria-label={`Umfragerunde ${round.roundNumber} löschen`} title="Umfragerunde löschen" onClick={(event) => { event.stopPropagation(); onDeleteDraftRound(round); }}><Trash2 className="h-4 w-4" /></Button><span className="tooltip-bubble">Umfragerunde löschen</span></span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <SurveyQuestionsPreview questions={survey.questions} />
      </SurfaceCard>
      <SurfaceCard className="group/chart-card text-center">
        {survey.status === 'active' ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="w-9" />
              <div>
                <QrCode className="mx-auto mb-2 h-5 w-5 text-viridian" />
                <h2 className="font-semibold text-viridian">QR-Code & Link</h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Runde {survey.roundNumber || 1}
                </p>
              </div>
              <StatisticsExportActions
                triggerLabel="QR-Code herunterladen"
                menuTitle="QR-Code herunterladen"
                isExporting={false}
                options={[{ label: 'Als PNG', meta: 'Bild', onClick: onDownloadQr }]}
              />
            </div>
            <div className="mt-3">
              <SurveyQr url={link} onReady={onQrReady} />
            </div>
            <p className="mt-3 break-all text-xs text-[var(--text-secondary)]">{link}</p>
            <div className="mt-4 grid gap-2">
              <Button variant="secondary" onClick={onCopy}>
                <Copy className="h-4 w-4" /> Link kopieren
              </Button>
              <Button variant="secondary" onClick={onPrint}>
                <Printer className="h-4 w-4" /> QR-Code drucken
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4" /> Teilnahme öffnen
              </Button>
            </div>
          </>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center px-5">
            <QrCode className="mb-3 h-6 w-6 text-[var(--text-faint)]" />
            <h2 className="font-semibold text-viridian">Teilnahme nicht aktiv</h2>
            <p className="mt-2 max-w-xs text-sm text-[var(--text-secondary)]">
              {survey.status === 'closed'
                ? 'Diese Umfragerunde ist beendet. QR-Code und Teilnahmelink werden nicht mehr angezeigt.'
                : 'Starte diese Umfragerunde, um QR-Code und Teilnahmelink bereitzustellen.'}
            </p>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

export default function SurveyDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const roundsQuery = useSurveyRounds(id);
  const rounds = roundsQuery.data || [];
  const [selectedRoundId, setSelectedRoundId] = useState(id);
  const surveyQuery = useSurvey(selectedRoundId);
  const survey = surveyQuery.data;
  const analytics = useSurveyAnalytics(selectedRoundId).data;
  const responsesQuery = useSurveyResponses(selectedRoundId);
  const trendQuery = useSurveyTrend(id);
  const start = useStartSurvey();
  const close = useCloseSurvey();
  const deleteResponse = useDeleteSurveyResponse();
  const createRound = useCreateSurveyRound();
  const deleteRound = useDeleteSurveyRound();
  const [tab, setTab] = useState<'overview' | 'responses' | 'analytics' | 'trend'>('overview');
  const [edit, setEdit] = useState(false);
  const [responseToDelete, setResponseToDelete] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [activeAnalyticsExport, setActiveAnalyticsExport] = useState<string | null>(null);
  const [activeCompleteAnalyticsExport, setActiveCompleteAnalyticsExport] = useState<
    'pdf' | 'xlsx' | null
  >(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [completeExportOpen, setCompleteExportOpen] = useState(false);
  const analyticsCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const analyticsSummaryRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!rounds.length) return;
    if (rounds.some((round) => round.id === selectedRoundId)) return;
    setSelectedRoundId(rounds[rounds.length - 1].id);
  }, [rounds, selectedRoundId]);
  const link = survey ? `${window.location.origin}/survey/${survey.publicToken}` : '';
  const byQuestion = useMemo(
    () => new Map((survey?.questions || []).map((question) => [question.id, question])),
    [survey?.questions],
  );
  if (surveyQuery.isLoading && !survey)
    return <p className="text-sm text-[var(--text-secondary)]">Umfrage wird geladen…</p>;
  if (!survey)
    return (
      <EmptyState
        title="Umfrage nicht gefunden"
        description="Sie wurde möglicherweise gelöscht oder gehört zu einer anderen Einrichtung."
        action={<Button onClick={() => navigate('/surveys')}>Zur Übersicht</Button>}
      />
    );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast('Öffentlicher Link kopiert.');
    } catch {
      showToast('Link konnte nicht kopiert werden.', { type: 'error' });
    }
  };
  const downloadQr = () => {
    if (!qrDataUrl) {
      showToast('Der QR-Code wird noch erstellt. Bitte versuche es gleich noch einmal.', {
        type: 'error',
      });
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = exportFilename(`${survey.title}-qr-code`, 'png');
    anchor.click();
    showToast('QR-Code als PNG heruntergeladen.');
  };
  const print = () => {
    const sourceImage = window.document.querySelector<HTMLImageElement>(
      'img[alt="QR-Code zur Umfrage"]',
    );
    const popup = window.open('', '_blank');
    if (!popup) return;
    popup.opener = null;
    const document = popup.document;
    document.title = survey.title;
    document.body.style.cssText =
      'font-family:Inter,Arial,sans-serif;padding:36px;text-align:center;color:#064e3b';
    const title = document.createElement('h1');
    title.textContent = survey.title;
    const p = document.createElement('p');
    p.textContent = 'Scanne den QR-Code und mach mit.';
    const qr = document.createElement('img');
    qr.src = sourceImage?.src || '';
    qr.style.width = '280px';
    qr.style.height = '280px';
    const url = document.createElement('p');
    url.textContent = link;
    url.style.fontSize = '12px';
    document.body.append(title, p, qr, url);
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
  };
  const exportAnalyticsCard = async (
    questionId: string,
    questionLabel: string,
    format: 'png' | 'pdf',
  ) => {
    const card = analyticsCardRefs.current[questionId];
    if (!card) return;
    const exportKey = `${questionId}:${format}`;
    setActiveAnalyticsExport(exportKey);
    setExportProgress(
      format === 'pdf'
        ? 'Auswertung wird für das PDF aufbereitet …'
        : 'Auswertung wird als Bild aufbereitet …',
    );
    try {
      const { JsPDF, html2canvas } = await loadSurveyExportDependencies();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const canvas = await html2canvas(card, {
        scale: SURVEY_EXPORT_SCALE,
        backgroundColor: '#ffffff',
        ignoreElements: (element) =>
          element instanceof HTMLElement && element.dataset.chartExportIgnore === 'true',
      });
      const fileTitle = `${survey.title}-${questionLabel}`;
      if (format === 'png') {
        setExportProgress('Bilddatei wird gespeichert …');
        downloadBlob(await canvasToBlob(canvas), exportFilename(fileTitle, 'png'));
        return;
      }
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new JsPDF({ orientation, unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const scale = Math.min(
        (pageWidth - SURVEY_EXPORT_MARGIN_MM * 2) / canvas.width,
        (pageHeight - SURVEY_EXPORT_HEADER_HEIGHT_MM - SURVEY_EXPORT_MARGIN_MM) / canvas.height,
      );
      const width = canvas.width * scale;
      const height = canvas.height * scale;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text(survey.title, SURVEY_EXPORT_MARGIN_MM, 15);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.text(questionLabel, SURVEY_EXPORT_MARGIN_MM, 21);
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        (pageWidth - width) / 2,
        SURVEY_EXPORT_HEADER_HEIGHT_MM,
        width,
        height,
        undefined,
        'FAST',
      );
      setExportProgress('PDF wird gespeichert …');
      pdf.save(exportFilename(fileTitle, 'pdf'));
    } catch (error) {
      console.error('Survey analytics export failed', error);
      showToast('Die Auswertung konnte nicht exportiert werden.', { type: 'error' });
    } finally {
      setActiveAnalyticsExport(null);
      setExportProgress(null);
    }
  };
  const exportCompleteAnalytics = async (format: 'pdf' | 'xlsx') => {
    if (!analytics) {
      showToast('Die Auswertung wird noch geladen.', { type: 'error' });
      return;
    }
    setActiveCompleteAnalyticsExport(format);
    setExportProgress(
      format === 'pdf'
        ? 'Gesamte Auswertung wird für das PDF aufbereitet …'
        : 'Excel-Datei wird vorbereitet …',
    );
    try {
      if (format === 'xlsx') {
        const xlsx = await import('xlsx-js-style');
        const { utils, writeFile } = xlsx as unknown as typeof import('xlsx-js-style');
        const overview = [
          ['Umfrage', survey.title],
          ['Gültige Antworten', analytics.responsesCount],
          ['Erwartete Teilnehmende', analytics.expectedParticipants ?? '–'],
          [
            'Rücklaufquote',
            analytics.responseRate === null || typeof analytics.responseRate === 'undefined'
              ? '–'
              : `${analytics.responseRate} %`,
          ],
          ['Erstellt am', new Date(analytics.generatedAt).toLocaleString('de-DE')],
        ];
        const results: Array<Array<string | number>> = [
          ['Frage', 'Antwortformat', 'Antwort / Ausprägung', 'Anzahl', 'Median'],
        ];
        const texts = [['Frage', 'Freitextantwort']];
        analytics.questions.forEach((result) => {
          const question = byQuestion.get(result.id);
          const formatLabel =
            result.type === 'scale'
              ? 'Bewertungsskala'
              : result.type === 'single_choice'
                ? 'Eine Auswahl'
                : result.type === 'multiple_choice'
                  ? 'Mehrere Auswahl'
                  : 'Freitext';
          if (result.type === 'text') {
            (result.texts || []).forEach((text) => texts.push([result.label, text]));
            results.push([
              result.label,
              formatLabel,
              `${result.answeredCount} Textantworten`,
              result.answeredCount,
              '',
            ]);
            return;
          }
          Object.entries(result.counts || {}).forEach(([value, count]) => {
            const min = String(question?.scaleMin ?? 1);
            const max = String(question?.scaleMax ?? 5);
            const label =
              question?.type === 'scale'
                ? value === min
                  ? `${value} – ${question.scaleMinLabel || 'trifft nicht zu'}`
                  : value === max
                    ? `${value} – ${question.scaleMaxLabel || 'trifft zu'}`
                    : value
                : question?.options?.find((entry) => entry.id === value)?.label || value;
            results.push([result.label, formatLabel, label, count, result.median ?? '']);
          });
        });
        const workbook = utils.book_new();
        const overviewSheet = utils.aoa_to_sheet(overview);
        const resultsSheet = utils.aoa_to_sheet(results);
        overviewSheet['!cols'] = [{ wch: 26 }, { wch: 48 }];
        resultsSheet['!cols'] = [{ wch: 44 }, { wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 12 }];
        utils.book_append_sheet(workbook, overviewSheet, 'Übersicht');
        utils.book_append_sheet(workbook, resultsSheet, 'Auswertung');
        if (texts.length > 1) {
          const textSheet = utils.aoa_to_sheet(texts);
          textSheet['!cols'] = [{ wch: 44 }, { wch: 90 }];
          utils.book_append_sheet(workbook, textSheet, 'Freitext');
        }
        writeFile(workbook, exportFilename(`${survey.title}-auswertung`, 'xlsx'));
        return;
      }
      const nodes = [
        { node: analyticsSummaryRef.current, label: 'Zusammenfassung' },
        ...analytics.questions.map((result) => ({
          node: analyticsCardRefs.current[result.id],
          label: result.label,
        })),
      ].filter((entry): entry is { node: HTMLDivElement; label: string } => !!entry.node);
      if (!nodes.length) throw new Error('No survey analytics to export.');
      const { JsPDF, html2canvas } = await loadSurveyExportDependencies();
      let pdf: InstanceType<typeof JsPDF> | null = null;
      for (const [index, entry] of nodes.entries()) {
        setExportProgress(`Auswertung ${index + 1} von ${nodes.length} wird aufbereitet …`);
        await new Promise(requestAnimationFrame);
        const canvas = await html2canvas(entry.node, {
          scale: SURVEY_EXPORT_SCALE,
          backgroundColor: '#ffffff',
          ignoreElements: (element) =>
            element instanceof HTMLElement && element.dataset.chartExportIgnore === 'true',
        });
        const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
        if (!pdf) pdf = new JsPDF({ orientation, unit: 'mm', format: 'a4' });
        else pdf.addPage('a4', orientation);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const scale = Math.min(
          (pageWidth - SURVEY_EXPORT_MARGIN_MM * 2) / canvas.width,
          (pageHeight - SURVEY_EXPORT_HEADER_HEIGHT_MM - SURVEY_EXPORT_MARGIN_MM) / canvas.height,
        );
        const width = canvas.width * scale;
        const height = canvas.height * scale;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(15);
        pdf.text(survey.title, SURVEY_EXPORT_MARGIN_MM, 15);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.text(entry.label, SURVEY_EXPORT_MARGIN_MM, 21);
        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          (pageWidth - width) / 2,
          SURVEY_EXPORT_HEADER_HEIGHT_MM,
          width,
          height,
          undefined,
          'FAST',
        );
      }
      setExportProgress('PDF wird gespeichert …');
      pdf?.save(exportFilename(`${survey.title}-auswertung`, 'pdf'));
    } catch (error) {
      console.error('Complete survey analytics export failed', error);
      showToast('Die Auswertung konnte nicht exportiert werden.', { type: 'error' });
    } finally {
      setActiveCompleteAnalyticsExport(null);
      setExportProgress(null);
    }
  };
  const runDelete = async () => {
    if (!responseToDelete || !deleteReason.trim()) {
      showToast('Bitte gib einen Löschgrund an.', { type: 'error' });
      return;
    }
    try {
      await deleteResponse.mutateAsync({
        surveyId: survey.id,
        responseId: responseToDelete,
        reason: deleteReason,
      });
      showToast('Einzelantwort gelöscht.');
      setResponseToDelete(null);
      setDeleteReason('');
    } catch {
      showToast('Antwort konnte nicht gelöscht werden.', { type: 'error' });
    }
  };
  const createNextRound = () =>
    createRound.mutate(id, {
      onSuccess: (round: any) => {
        setSelectedRoundId(round.id);
        setTab('overview');
        showToast(`Umfragerunde ${round.roundNumber || rounds.length + 1} als Entwurf angelegt.`);
      },
      onError: (error: any) =>
        showToast(
          error?.response?.data?.message || 'Neue Umfragerunde konnte nicht angelegt werden.',
          { type: 'error' },
        ),
    });
  const deleteDraftRound = (round: Survey) => {
    deleteRound.mutate(
      { surveyId: id, roundId: round.id },
      {
        onSuccess: () => {
          if (selectedRoundId === round.id) setSelectedRoundId(id);
          showToast(`Umfragerunde ${round.roundNumber} gelöscht.`);
        },
        onError: (error: any) =>
          showToast(
            error?.response?.data?.message || 'Umfragerunde konnte nicht gelöscht werden.',
            { type: 'error' },
          ),
      },
    );
  };
  const showRoundPicker = rounds.length > 1 && (tab === 'responses' || tab === 'analytics');
  const canEdit = survey.status === 'draft' && (survey.roundNumber || 1) === 1;
  return (
    <div className="space-y-5">
      <PageHeader
        title={rounds[0]?.title || survey.title}
        description={`${survey.questions.length} Fragen · Runde ${survey.roundNumber || 1} · ${survey.responsesCount} Antworten`}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/surveys')}>
              <ArrowLeft className="h-4 w-4" /> Übersicht
            </Button>
            <Button
              onClick={createNextRound}
              disabled={createRound.isPending || survey.status === 'active'}
            >
              <Plus className="h-4 w-4" /> Neue Umfragerunde
            </Button>
            {survey.status === 'draft' ? (
              <Button
                onClick={() =>
                  start.mutate(survey.id, {
                    onSuccess: () => showToast('Umfragerunde gestartet.'),
                    onError: (error: any) =>
                      showToast(
                        error?.response?.data?.message || 'Umfrage konnte nicht gestartet werden.',
                        { type: 'error' },
                      ),
                  })
                }
              >
                <Play className="h-4 w-4" /> Starten
              </Button>
            ) : null}
            {survey.status === 'active' ? (
              <Button variant="danger" onClick={() => setCloseConfirmOpen(true)}>
                <CheckCircle2 className="h-4 w-4" /> Beenden
              </Button>
            ) : null}
            {canEdit ? (
              <Button variant="secondary" onClick={() => setEdit(true)}>
                <Pencil className="h-4 w-4" /> Bearbeiten
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1">
        <button
          className={`min-w-0 rounded-lg px-1 py-2 text-xs font-medium sm:px-3 sm:text-sm ${tab === 'overview' ? 'bg-[var(--surface-elevated)] text-viridian shadow-sm' : 'text-[var(--text-secondary)]'}`}
          onClick={() => setTab('overview')}
        >
          Überblick
        </button>
        <button
          className={`min-w-0 rounded-lg px-1 py-2 text-xs font-medium sm:px-3 sm:text-sm ${tab === 'responses' ? 'bg-[var(--surface-elevated)] text-viridian shadow-sm' : 'text-[var(--text-secondary)]'}`}
          onClick={() => setTab('responses')}
        >
          <span className="sm:hidden">Antworten</span>
          <span className="hidden sm:inline">Einzelantworten</span>
        </button>
        <button
          className={`min-w-0 rounded-lg px-1 py-2 text-xs font-medium sm:px-3 sm:text-sm ${tab === 'analytics' ? 'bg-[var(--surface-elevated)] text-viridian shadow-sm' : 'text-[var(--text-secondary)]'}`}
          onClick={() => setTab('analytics')}
        >
          Auswertung
        </button>
        <button
          className={`min-w-0 rounded-lg px-1 py-2 text-xs font-medium sm:px-3 sm:text-sm ${tab === 'trend' ? 'bg-[var(--surface-elevated)] text-viridian shadow-sm' : 'text-[var(--text-secondary)]'}`}
          onClick={() => setTab('trend')}
        >
          Verlauf
        </button>
      </div>
      {showRoundPicker ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
          <label
            className="text-sm font-medium text-[var(--text-secondary)]"
            htmlFor="survey-round"
          >
            Umfragerunde
          </label>
          <Select
            id="survey-round"
            className="mt-0 min-w-[16rem] max-w-sm"
            value={selectedRoundId}
            onChange={(event) => setSelectedRoundId(event.target.value)}
          >
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                Runde {round.roundNumber || 1} ·{' '}
                {formatDate(round.closedAt || round.startsAt || null)} · {round.responsesCount}{' '}
                Antworten
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      {tab === 'overview' ? (
        <SurveyOverview
          survey={survey}
          rounds={rounds}
          selectedRoundId={selectedRoundId}
          onSelectRound={setSelectedRoundId}
          link={link}
          onQrReady={setQrDataUrl}
          onDownloadQr={downloadQr}
          onCopy={() => void copy()}
          onPrint={print}
          onDeleteDraftRound={deleteDraftRound}
        />
      ) : null}
      {tab === 'responses' ? (
        <SurfaceCard>
          {responsesQuery.isLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Einzelantworten werden geladen…</p>
          ) : !responsesQuery.data?.rawResponsesAvailable ? (
            <EmptyState
              icon={<Archive className="h-5 w-5" />}
              title="Einzelantworten wurden anonymisiert gelöscht"
              description="Nach Ablauf der 30-Tage-Prüffrist bleiben nur die aggregierten Ergebnisse erhalten."
            />
          ) : (responsesQuery.data?.responses.length || 0) === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Noch keine Antworten"
              description="Sobald jemand teilnimmt, erscheinen die anonymen Antworten hier."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-2 py-3">#</th>
                    <th className="px-2 py-3">Eingang</th>
                    {survey.questions.map((question) => (
                      <th key={question.id} className="px-2 py-3">
                        {question.label}
                      </th>
                    ))}
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {responsesQuery.data?.responses.map((response) => (
                    <tr
                      key={response.id}
                      className="border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <td className="px-2 py-3">{response.number}</td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {formatDate(response.submittedAt)}
                      </td>
                      {survey.questions.map((question) => (
                        <td key={question.id} className="max-w-56 px-2 py-3 align-top">
                          {answerLabel(question, response.answers[question.id])}
                        </td>
                      ))}
                      <td className="px-2 py-3">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Antwort löschen"
                          onClick={() => setResponseToDelete(response.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>
      ) : null}
      {tab === 'analytics' ? (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-cambridge-blue px-4 py-2 text-sm text-white transition-colors hover:bg-viridian"
              onClick={() => setCompleteExportOpen(true)}
              title="Auswertung exportieren"
            >
              <FileDown className="h-4 w-4" /> Export
            </button>
          </div>
          <div ref={analyticsSummaryRef} className="grid gap-4 sm:grid-cols-3">
            <SurfaceCard padding="sm">
              <div className="text-xs text-[var(--text-secondary)]">Gültige Antworten</div>
              <div className="mt-1 text-2xl font-bold text-viridian">
                {analytics?.responsesCount ?? 0}
              </div>
            </SurfaceCard>
            <SurfaceCard padding="sm">
              <div className="text-xs text-[var(--text-secondary)]">Erwartete Teilnehmende</div>
              <div className="mt-1 text-2xl font-bold text-viridian">
                {analytics?.expectedParticipants ?? '–'}
              </div>
            </SurfaceCard>
            <SurfaceCard padding="sm">
              <div className="text-xs text-[var(--text-secondary)]">Rücklaufquote</div>
              <div className="mt-1 text-2xl font-bold text-viridian">
                {analytics?.responseRate !== null && typeof analytics?.responseRate !== 'undefined'
                  ? `${analytics.responseRate} %`
                  : '–'}
              </div>
            </SurfaceCard>
          </div>
          {analytics?.suppressed ? (
            <EmptyState
              icon={<Archive className="h-5 w-5" />}
              title="Dauerhafte Auswertung nicht verfügbar"
              description="Nach der Prüffrist wurden die Einzelantworten gelöscht. Für eine dauerhafte Auswertung waren weniger als fünf Antworten eingegangen."
            />
          ) : !analytics || analytics.questions.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="h-5 w-5" />}
              title="Noch keine Auswertung"
              description="Die Diagramme erscheinen, sobald Antworten eingegangen sind."
            />
          ) : (
            analytics.questions.map((result) => {
              const question = byQuestion.get(result.id);
              const exportActions = (
                <StatisticsExportActions
                  triggerLabel={`${result.label} exportieren`}
                  menuTitle="Auswertung exportieren"
                  isExporting={activeAnalyticsExport?.startsWith(`${result.id}:`) ?? false}
                  options={[
                    {
                      label: 'Als PNG',
                      meta: 'Bild',
                      onClick: () => void exportAnalyticsCard(result.id, result.label, 'png'),
                    },
                    {
                      label: 'Als PDF',
                      meta: 'A4',
                      onClick: () => void exportAnalyticsCard(result.id, result.label, 'pdf'),
                    },
                  ]}
                />
              );
              if (result.type === 'text')
                return (
                  <div
                    key={result.id}
                    className="group/chart-card"
                    ref={(node) => {
                      analyticsCardRefs.current[result.id] = node;
                    }}
                  >
                    <SurfaceCard>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="font-semibold text-viridian">{result.label}</h2>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {result.answeredCount} Textantworten
                          </p>
                        </div>
                        {exportActions}
                      </div>
                      <div className="mt-4 space-y-2">
                        {result.texts?.length ? (
                          result.texts.map((text, index) => (
                            <div
                              key={`${index}-${text}`}
                              className="rounded-xl bg-[var(--surface-2)] p-3 text-sm whitespace-pre-wrap"
                            >
                              {text}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[var(--text-secondary)]">
                            Keine Freitextantworten.
                          </p>
                        )}
                      </div>
                    </SurfaceCard>
                  </div>
                );
              const min = String(question?.scaleMin ?? 1);
              const max = String(question?.scaleMax ?? 5);
              const chartData = Object.entries(result.counts || {}).map(([key, value]) => ({
                name:
                  question?.type === 'scale'
                    ? key === min
                      ? `${key} – ${question.scaleMinLabel || 'trifft nicht zu'}`
                      : key === max
                        ? `${key} – ${question.scaleMaxLabel || 'trifft zu'}`
                        : key
                    : question?.options?.find((entry) => entry.id === key)?.label || key,
                value,
              }));
              return (
                <div
                  key={result.id}
                  className="group/chart-card"
                  ref={(node) => {
                    analyticsCardRefs.current[result.id] = node;
                  }}
                >
                  <SurfaceCard className="p-3 md:p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-semibold text-viridian">{result.label}</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--text-secondary)]">
                          {result.answeredCount} Antworten
                          {result.median ? ` · Median ${result.median}` : ''}
                        </span>
                        {exportActions}
                      </div>
                    </div>
                    <div className="mt-4 h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={question?.type === 'scale' ? 112 : 96}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip content={<SurveyChartTooltip />} />
                          <Bar
                            dataKey="value"
                            fill="var(--chart-primary, #0f766e)"
                            radius={[0, 5, 5, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </SurfaceCard>
                </div>
              );
            })
          )}
        </div>
      ) : null}
      {tab === 'trend' ? (
        <div className="space-y-5">
          {trendQuery.isLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Verlauf wird geladen…</p>
          ) : !trendQuery.data?.rounds.length ? (
            <EmptyState
              icon={<BarChart3 className="h-5 w-5" />}
              title="Noch kein Verlauf"
              description="Sobald mehrere Umfragerunden angelegt wurden, erscheinen hier die Entwicklungen."
            />
          ) : (
            <>
              <SurfaceCard>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-viridian">Verlauf der Umfragerunden</h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Verglichen werden nur identische Fragen derselben Umfragereihe.
                    </p>
                  </div>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {trendQuery.data.rounds.length} Runden
                  </span>
                </div>
                <div className="mt-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendQuery.data.rounds.map((round) => ({
                        name: `Runde ${round.roundNumber}`,
                        antworten: round.responsesCount,
                        ruecklauf: round.responseRate,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="antworten"
                        name="Antworten"
                        stroke="#0f766e"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="ruecklauf"
                        name="Rücklaufquote (%)"
                        stroke="#2563eb"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SurfaceCard>
              {trendQuery.data.questions.map((question) => {
                if (question.type === 'scale') {
                  const data = (question.points || []).map((point) => ({
                    name: `Runde ${point.roundNumber}`,
                    mittelwert: point.suppressed ? null : point.mean,
                    median: point.suppressed ? null : point.median,
                    n: point.answeredCount,
                  }));
                  return (
                    <SurfaceCard key={question.id}>
                      <h2 className="font-semibold text-viridian">{question.label}</h2>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Mittelwert und Median je Umfragerunde.
                      </p>
                      <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 5]} allowDecimals />
                            <Tooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="mittelwert"
                              name="Mittelwert"
                              stroke="#0f766e"
                              strokeWidth={2}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey="median"
                              name="Median"
                              stroke="#2563eb"
                              strokeWidth={2}
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </SurfaceCard>
                  );
                }
                if (question.type === 'single_choice' || question.type === 'multiple_choice') {
                  const data = trendQuery.data.rounds.map((round) => ({
                    name: `Runde ${round.roundNumber}`,
                    ...Object.fromEntries(
                      (question.options || []).map((option) => [
                        option.id,
                        option.points.find((point) => point.roundId === round.id)?.percentage ??
                          null,
                      ]),
                    ),
                  }));
                  return (
                    <SurfaceCard key={question.id}>
                      <h2 className="font-semibold text-viridian">{question.label}</h2>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Anteil der Antworten je Auswahl in Prozent.
                      </p>
                      <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 100]} unit=" %" />
                            <Tooltip />
                            <Legend />
                            {(question.options || []).map((option, index) => (
                              <Line
                                key={option.id}
                                type="monotone"
                                dataKey={option.id}
                                name={option.label}
                                stroke={TREND_COLORS[index % TREND_COLORS.length]}
                                strokeWidth={2}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </SurfaceCard>
                  );
                }
                const data = (question.points || []).map((point) => ({
                  name: `Runde ${point.roundNumber}`,
                  antworten: point.suppressed ? null : point.answeredCount,
                }));
                return (
                  <SurfaceCard key={question.id}>
                    <h2 className="font-semibold text-viridian">{question.label}</h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Anzahl der Freitextantworten je Umfragerunde.
                    </p>
                    <div className="mt-4 h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="antworten"
                            name="Antworten"
                            stroke="#0f766e"
                            strokeWidth={2}
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </SurfaceCard>
                );
              })}
            </>
          )}
        </div>
      ) : null}
      <SurveyEditor open={edit} survey={survey} onClose={() => setEdit(false)} />
      <ConfirmModal
        open={!!responseToDelete}
        title="Einzelantwort löschen"
        message={
          <div className="space-y-3">
            <p>
              Die Antwort wird endgültig entfernt. Die Auswertung wird anschließend neu berechnet.
            </p>
            <label className="block text-sm font-medium">
              Löschgrund
              <Input
                className="mt-1"
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                placeholder="z. B. Testantwort oder Spam"
              />
            </label>
          </div>
        }
        confirmLabel="Endgültig löschen"
        onConfirm={() => void runDelete()}
        onCancel={() => {
          setResponseToDelete(null);
          setDeleteReason('');
        }}
      />
      <ConfirmModal
        open={closeConfirmOpen}
        title="Umfrage beenden?"
        message="Die Teilnahme über den öffentlichen Link und den QR-Code wird sofort geschlossen. Bereits eingegangene Antworten bleiben für die Auswertung erhalten."
        confirmLabel="Umfrage beenden"
        onConfirm={() => {
          setCloseConfirmOpen(false);
          close.mutate(survey.id, {
            onSuccess: () => showToast('Umfrage beendet.'),
            onError: () => showToast('Umfrage konnte nicht beendet werden.', { type: 'error' }),
          });
        }}
        onCancel={() => setCloseConfirmOpen(false)}
      />
      <Modal
        open={completeExportOpen}
        onClose={() => setCompleteExportOpen(false)}
        title="Auswertung exportieren"
        maxWidth="xl"
      >
        <div className="space-y-4 text-sm text-gray-700">
          <p>Die gesamte Auswertung wird mit allen aktuellen Antworten exportiert.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-viridian/40 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
              disabled={activeCompleteAnalyticsExport !== null}
              onClick={() => {
                setCompleteExportOpen(false);
                void exportCompleteAnalytics('pdf');
              }}
            >
              <div className="font-semibold text-gray-900">PDF-Bericht</div>
              <div className="mt-1 text-xs text-gray-600">
                Zusammenfassung und jede Frage auf einer eigenen, gut lesbaren Seite.
              </div>
            </button>
            <button
              type="button"
              className="rounded-xl border border-viridian/20 bg-azure-web p-4 text-left hover:border-viridian/40 hover:bg-mint-green disabled:cursor-wait disabled:opacity-60"
              disabled={activeCompleteAnalyticsExport !== null}
              onClick={() => {
                setCompleteExportOpen(false);
                void exportCompleteAnalytics('xlsx');
              }}
            >
              <div className="font-semibold text-viridian">StatO-Excel</div>
              <div className="mt-1 text-xs text-gray-600">
                Arbeitsmappe mit Übersicht, aggregierten Werten und vorhandenen Freitexten.
              </div>
            </button>
          </div>
        </div>
      </Modal>
      <ExportProgressModal message={exportProgress} />
    </div>
  );
}
