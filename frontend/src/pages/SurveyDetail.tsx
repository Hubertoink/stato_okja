import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { autoT } from '@/i18n/auto';
import { getCurrentIntlLocale } from '@/i18n/formatters';
import { captureExportNode } from '@/lib/htmlCanvasExport';

const SURVEY_EXPORT_SCALE = 2;
const SURVEY_EXPORT_MARGIN_MM = 10;
const SURVEY_EXPORT_HEADER_HEIGHT_MM = 24;
const TREND_COLORS = ['#0f766e', '#2563eb', '#9333ea', '#ea580c', '#db2777', '#0891b2'];

let surveyExportDependenciesPromise: Promise<{
  JsPDF: typeof import('jspdf').default;
}> | null = null;

function loadSurveyExportDependencies() {
  if (!surveyExportDependenciesPromise) {
    surveyExportDependenciesPromise = import('jspdf').then(
      (jspdfModule) => ({
        JsPDF: jspdfModule.default,
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
    .toLocaleLowerCase(getCurrentIntlLocale())
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9äöüß_-]+/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return autoT('ui_f89a0fd4ac03', { value0: segment || autoT('ui_1d3ced9367ba'), value1: extension });
}

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleString(getCurrentIntlLocale(), { dateStyle: 'medium', timeStyle: 'short' })
    : '–';
}

function displayStart(survey: Survey) {
  return formatDate(survey.startsAt || survey.startedAt || null);
}

function displayEnd(survey: Survey) {
  return formatDate(survey.endsAt || survey.closedAt || null);
}

function formatRoundMonthYear(survey: Survey) {
  const date = survey.startedAt || survey.startsAt || survey.closedAt || survey.endsAt || null;
  return date
    ? new Date(date).toLocaleDateString(getCurrentIntlLocale(), { month: 'short', year: 'numeric' })
    : null;
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
      <p className="mt-1 text-viridian">{entry.value ?? 0}{' '}{autoT('ui_062c3d5e1537')}</p>
    </div>
  );
}

type SurveyTrendTooltipPayload = {
  value?: number | null;
  name?: string;
  color?: string;
  dataKey?: string;
  payload?: { name?: string };
};

function SurveyTrendTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: SurveyTrendTooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="survey-chart-tooltip" role="status">
      <p className="survey-chart-tooltip-label">{label ?? payload[0]?.payload?.name}</p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry) => {
          const value = entry.value === null || typeof entry.value === 'undefined' ? '–' : entry.value;
          const suffix = entry.dataKey === 'ruecklauf' || entry.name?.includes('(%)') ? ' %' : '';
          return (
            <p key={`${entry.dataKey || entry.name}-${entry.value}`} className="survey-chart-tooltip-value">
              <span style={{ color: entry.color || 'var(--text-primary)' }}>{entry.name || entry.dataKey}:</span>{' '}
              {value}{suffix}
            </p>
          );
        })}
      </div>
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
      alt={autoT('ui_0aabcaa4a531')}
      data-survey-qr
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
          <h3 className="font-semibold text-viridian">{autoT('ui_0eb5ac7cb670')}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {questions.length} {questions.length === 1 ? autoT('ui_2e4bccb00f59') : autoT('ui_0eb5ac7cb670')}{' '}{autoT('ui_a39c9658d2c8')}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{autoT('ui_4dd094221b03')}</Button>
      </section>
      <Modal open={open} onClose={() => setOpen(false)} title={autoT('ui_d0a6bde76cc5')} maxWidth="3xl">
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">{autoT('ui_eb351ae6146f')}</p>
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-viridian">{autoT('ui_2e4bccb00f59')}{' '}{index + 1}</p>
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
                {question.required ? autoT('ui_6460d6877930') : autoT('ui_1131d8e5e80b')}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>{autoT('ui_44424b18700e')}</Button>
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
        <h2 className="text-lg font-semibold text-viridian">{autoT('ui_adf758641fca')}</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--text-secondary)]">{autoT('ui_bae7d5be7082')}</dt>
            <dd className="mt-1">
              <SurveyStatusBadge status={survey.status} />
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-secondary)]">{autoT('ui_71c2851c9840')}</dt>
            <dd className="mt-1 font-medium">
              {survey.allowMultiplePerDevice
                ? autoT('ui_d1e0f2d60f99')
                : autoT('ui_845b3a841059')}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-secondary)]">{autoT('ui_952f375412e8')}</dt>
            <dd className="mt-1">{displayStart(survey)}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-secondary)]">{autoT('ui_920e9c468e40')}</dt>
            <dd className="mt-1">{displayEnd(survey)}</dd>
          </div>
          {survey.rawResponsesPurgeAt ? (
            <div className="sm:col-span-2">
              <dt className="text-[var(--text-secondary)]">{autoT('ui_ad3b9e06ace7')}</dt>
              <dd className="mt-1">{formatDate(survey.rawResponsesPurgeAt)}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-5 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
          {survey.introduction || autoT('ui_fcde2b7ead39')}
        </p>
        <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-viridian">{autoT('ui_a116cfcb0a17')}</h3>
            <span className="text-sm text-[var(--text-secondary)]">
              {rounds.length} {rounds.length === 1 ? autoT('ui_101d931d6b66') : autoT('ui_c042750d784a')}
            </span>
          </div>
          <div>
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <th className="w-[36%] px-2 py-2 sm:w-[28%]">{autoT('ui_101d931d6b66')}</th>
                  <th className="w-[32%] px-2 py-2 sm:w-[38%]">{autoT('ui_bae7d5be7082')}</th>
                  <th className="w-[22%] px-2 py-2 text-right sm:w-[26%]">{autoT('ui_062c3d5e1537')}</th>
                  <th className="w-[10%] px-2 py-2 sm:w-12"><span className="sr-only">{autoT('ui_445e0c4cac2f')}</span></th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => (
                  <tr
                    key={round.id}
                    className={`group cursor-pointer border-b border-[var(--border-subtle)] last:border-0 ${round.id === selectedRoundId ? "bg-[var(--interactive-soft)]" : "hover:bg-[var(--surface-2)]"}`}
                    onClick={() => onSelectRound(round.id)}
                  >
                    <td className="px-2 py-3 font-medium">{autoT('ui_101d931d6b66')} {round.roundNumber || 1}
                      {formatRoundMonthYear(round) ? (
                        <span className="ml-1 whitespace-nowrap text-xs font-normal text-[var(--text-secondary)]">
                          ({formatRoundMonthYear(round)})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-3">
                      <SurveyStatusBadge status={round.status} />
                    </td>
                    <td className="px-2 py-3 text-right">{round.responsesCount}</td>
                    <td className="px-2 py-2 text-right">{round.status === 'draft' && (round.roundNumber || 1) > 1 ? <span className="tooltip-wrapper inline-flex"><Button size="icon" variant="ghost" className="h-8 w-8 text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-text)]" aria-label={autoT('ui_55e51cea1246', { value0: round.roundNumber })} title={autoT('ui_f67f0f08e572')} onClick={(event) => { event.stopPropagation(); onDeleteDraftRound(round); }}><Trash2 className="h-4 w-4" /></Button><span className="tooltip-bubble">{autoT('ui_f67f0f08e572')}</span></span> : null}</td>
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
                <h2 className="font-semibold text-viridian">{autoT('ui_187917d94802')}</h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{autoT('ui_101d931d6b66')} {survey.roundNumber || 1}
                </p>
              </div>
              <StatisticsExportActions
                triggerLabel={autoT('ui_58fe20b5d493')}
                menuTitle={autoT('ui_58fe20b5d493')}
                isExporting={false}
                options={[{ label: autoT('ui_eac2deaf6270'), meta: 'Bild', onClick: onDownloadQr }]}
              />
            </div>
            <div className="mt-3">
              <SurveyQr url={link} onReady={onQrReady} />
            </div>
            <p className="mt-3 break-all text-xs text-[var(--text-secondary)]">{link}</p>
            <div className="mt-4 grid gap-2">
              <Button variant="secondary" onClick={onCopy}>
                <Copy className="h-4 w-4" />{autoT('ui_e8b631dd387f')}</Button>
              <Button variant="secondary" onClick={onPrint}>
                <Printer className="h-4 w-4" />{autoT('ui_004acce76d13')}</Button>
              <Button
                variant="secondary"
                onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4" />{autoT('ui_b9abb6d595a4')}</Button>
            </div>
          </>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center px-5">
            <QrCode className="mb-3 h-6 w-6 text-[var(--text-faint)]" />
            <h2 className="font-semibold text-viridian">{autoT('ui_43824020203e')}</h2>
            <p className="mt-2 max-w-xs text-sm text-[var(--text-secondary)]">
              {survey.status === 'closed'
                ? autoT('ui_9b9391ac8de0')
                : autoT('ui_0ee8148b648e')}
            </p>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

export default function SurveyDetail() {
  const { t } = useTranslation('surveys');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const roundsQuery = useSurveyRounds(id);
  const rounds = roundsQuery.data || [];
  const [selectedRoundId, setSelectedRoundId] = useState(id);
  const surveyQuery = useSurvey(selectedRoundId);
  // The rounds endpoint already contains the complete staff DTO. Use it while the
  // detail request for a newly selected round is in flight, so the layout never
  // collapses to the loading state on the first round switch after login.
  const survey = surveyQuery.data || rounds.find((round) => round.id === selectedRoundId);
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
    return <p className="text-sm text-[var(--text-secondary)]">{autoT('ui_b3580a144a65')}</p>;
  if (!survey)
    return (
      <EmptyState
        title={autoT('ui_2ce107281759')}
        description={autoT('ui_28f553cb85f4')}
        action={<Button onClick={() => navigate('/surveys')}>{autoT('ui_90d08e27d59c')}</Button>}
      />
    );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      showToast(autoT('ui_3d38ec837a48'));
    } catch {
      showToast(autoT('ui_51ddb4e34042'), { type: 'error' });
    }
  };
  const downloadQr = () => {
    if (!qrDataUrl) {
      showToast(autoT('ui_af190090cb83'), {
        type: 'error',
      });
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = exportFilename(`${survey.title}-qr-code`, 'png');
    anchor.click();
    showToast(autoT('ui_44b6a849b248'));
  };
  const print = () => {
    const sourceImage = window.document.querySelector<HTMLImageElement>(
      'img[data-survey-qr]',
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
        ? autoT('ui_f89215c5d261')
        : autoT('ui_41bc3dcad7cc'),
    );
    try {
      const { JsPDF } = await loadSurveyExportDependencies();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const canvas = await captureExportNode(card, {
        scale: SURVEY_EXPORT_SCALE,
        ignoreElements: (element) =>
          element instanceof HTMLElement && element.dataset.chartExportIgnore === 'true',
      });
      const fileTitle = `${survey.title}-${questionLabel}`;
      if (format === 'png') {
        setExportProgress(autoT('ui_8b3d272f0e55'));
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
      setExportProgress(autoT('ui_0acf469c6a6c'));
      pdf.save(exportFilename(fileTitle, 'pdf'));
    } catch (error) {
      console.error('Survey analytics export failed', error);
      showToast(autoT('ui_95224f10980a'), { type: 'error' });
    } finally {
      setActiveAnalyticsExport(null);
      setExportProgress(null);
    }
  };
  const exportCompleteAnalytics = async (format: 'pdf' | 'xlsx') => {
    if (!analytics) {
      showToast(autoT('ui_0d35286dbcf2'), { type: 'error' });
      return;
    }
    setActiveCompleteAnalyticsExport(format);
    setExportProgress(
      format === 'pdf'
        ? autoT('ui_35beb65aa9cb')
        : 'Excel-Datei wird vorbereitet …',
    );
    try {
      if (format === 'xlsx') {
        const xlsx = await import('xlsx-js-style');
        const { utils, writeFile } = xlsx as unknown as typeof import('xlsx-js-style');
        const overview = [
          [autoT('ui_adf758641fca'), survey.title],
          [autoT('ui_ccb381b8f440'), analytics.responsesCount],
          [autoT('ui_fc91708230d3'), analytics.expectedParticipants ?? '–'],
          [
            autoT('ui_54de2ae8fb71'),
            analytics.responseRate === null || typeof analytics.responseRate === 'undefined'
              ? '–'
              : `${analytics.responseRate} %`,
          ],
          ['Erstellt am', new Date(analytics.generatedAt).toLocaleString(getCurrentIntlLocale())],
        ];
        const results: Array<Array<string | number>> = [
          [autoT('ui_2e4bccb00f59'), autoT('ui_191796a6bbf2'), autoT('ui_7ff76bb5e133'), autoT('ui_a0015435c276'), autoT('ui_b887ba2a5f48')],
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
        utils.book_append_sheet(workbook, overviewSheet, autoT('ui_cb27327d0207'));
        utils.book_append_sheet(workbook, resultsSheet, autoT('ui_b794c8c5b654'));
        if (texts.length > 1) {
          const textSheet = utils.aoa_to_sheet(texts);
          textSheet['!cols'] = [{ wch: 44 }, { wch: 90 }];
          utils.book_append_sheet(workbook, textSheet, autoT('ui_e0e8dce3beb7'));
        }
        writeFile(workbook, exportFilename(autoT('ui_98f8c12a4c91', { value0: survey.title }), 'xlsx'));
        return;
      }
      const nodes = [
        { node: analyticsSummaryRef.current, label: autoT('ui_dc230696907d') },
        ...analytics.questions.map((result) => ({
          node: analyticsCardRefs.current[result.id],
          label: result.label,
        })),
      ].filter((entry): entry is { node: HTMLDivElement; label: string } => !!entry.node);
      if (!nodes.length) throw new Error('No survey analytics to export.');
      const { JsPDF } = await loadSurveyExportDependencies();
      let pdf: InstanceType<typeof JsPDF> | null = null;
      for (const [index, entry] of nodes.entries()) {
        setExportProgress(autoT('ui_00988b3b2777', { value0: index + 1, value1: nodes.length }));
        await new Promise(requestAnimationFrame);
        const canvas = await captureExportNode(entry.node, {
          scale: SURVEY_EXPORT_SCALE,
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
      setExportProgress(autoT('ui_0acf469c6a6c'));
      pdf?.save(exportFilename(autoT('ui_98f8c12a4c91', { value0: survey.title }), 'pdf'));
    } catch (error) {
      console.error('Complete survey analytics export failed', error);
      showToast(autoT('ui_95224f10980a'), { type: 'error' });
    } finally {
      setActiveCompleteAnalyticsExport(null);
      setExportProgress(null);
    }
  };
  const runDelete = async () => {
    if (!responseToDelete || !deleteReason.trim()) {
      showToast(autoT('ui_ac10a4165a98'), { type: 'error' });
      return;
    }
    try {
      await deleteResponse.mutateAsync({
        surveyId: survey.id,
        responseId: responseToDelete,
        reason: deleteReason,
      });
      showToast(autoT('ui_33a91b387240'));
      setResponseToDelete(null);
      setDeleteReason('');
    } catch {
      showToast(autoT('ui_0be9529a9010'), { type: 'error' });
    }
  };
  const createNextRound = () =>
    createRound.mutate(id, {
      onSuccess: (createdRound) => {
        const round = createdRound as Survey;
        setSelectedRoundId(round.id);
        setTab('overview');
        showToast(`Umfragerunde ${round.roundNumber || rounds.length + 1} als Entwurf angelegt.`);
      },
      onError: (error: unknown) =>
        showToast(
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message || t('newRoundError'),
          { type: 'error' },
        ),
    });
  const deleteDraftRound = (round: Survey) => {
    deleteRound.mutate(
      { surveyId: id, roundId: round.id },
      {
        onSuccess: () => {
          if (selectedRoundId === round.id) setSelectedRoundId(id);
          showToast(autoT('ui_4440c31d01dd', { value0: round.roundNumber }));
        },
        onError: (error: unknown) =>
          showToast(
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message || autoT('ui_577e8e9a0ff7'),
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
        description={autoT('ui_7a8c10d7f5fd', { value0: survey.questions.length, value1: survey.roundNumber || 1, value2: survey.responsesCount })}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/surveys')}>
              <ArrowLeft className="h-4 w-4" />{autoT('ui_cb27327d0207')}</Button>
            <Button
              onClick={createNextRound}
              disabled={createRound.isPending || survey.status === 'active'}
            >
              <Plus className="h-4 w-4" />{autoT('ui_21c33a3efef0')}</Button>
            {survey.status === 'draft' ? (
              <Button
                onClick={() =>
                  start.mutate(survey.id, {
                    onSuccess: () => showToast(autoT('ui_2f743b651728')),
                    onError: (error: unknown) =>
                      showToast(
                        (error as { response?: { data?: { message?: string } } })?.response?.data?.message || autoT('ui_4fea9281bb1b'),
                        { type: 'error' },
                      ),
                  })
                }
              >
                <Play className="h-4 w-4" />{autoT('ui_2beb73505ac3')}</Button>
            ) : null}
            {survey.status === 'active' ? (
              <Button variant="danger" onClick={() => setCloseConfirmOpen(true)}>
                <CheckCircle2 className="h-4 w-4" />{autoT('ui_ce9e650ed816')}</Button>
            ) : null}
            {canEdit ? (
              <Button variant="secondary" onClick={() => setEdit(true)}>
                <Pencil className="h-4 w-4" />{autoT('ui_104f3bfdc340')}</Button>
            ) : null}
          </div>
        }
      />
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1" role="tablist" aria-label="Umfrageansichten">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          className={`survey-tab min-w-0 rounded-lg px-1 py-2 text-xs font-medium sm:px-3 sm:text-sm ${tab === 'overview' ? "bg-[var(--surface-elevated)] text-viridian shadow-sm" : "text-[var(--text-secondary)]"}`}
          onClick={() => setTab('overview')}
        >{autoT('ui_8f963287afb8')}</button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'responses'}
          className={`survey-tab min-w-0 rounded-lg px-1 py-2 text-xs font-medium sm:px-3 sm:text-sm ${tab === 'responses' ? "bg-[var(--surface-elevated)] text-viridian shadow-sm" : "text-[var(--text-secondary)]"}`}
          onClick={() => setTab('responses')}
        >
          <span className="sm:hidden">{autoT('ui_062c3d5e1537')}</span>
          <span className="hidden sm:inline">{autoT('ui_56ca593e977d')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'analytics'}
          className={`survey-tab min-w-0 rounded-lg px-1 py-2 text-xs font-medium sm:px-3 sm:text-sm ${tab === 'analytics' ? "bg-[var(--surface-elevated)] text-viridian shadow-sm" : "text-[var(--text-secondary)]"}`}
          onClick={() => setTab('analytics')}
        >{autoT('ui_b794c8c5b654')}</button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'trend'}
          className={`survey-tab min-w-0 rounded-lg px-1 py-2 text-xs font-medium sm:px-3 sm:text-sm ${tab === 'trend' ? "bg-[var(--surface-elevated)] text-viridian shadow-sm" : "text-[var(--text-secondary)]"}`}
          onClick={() => setTab('trend')}
        >{autoT('ui_35bec7db746f')}</button>
      </div>
      {showRoundPicker ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
          <label
            className="text-sm font-medium text-[var(--text-secondary)]"
            htmlFor="survey-round"
          >{autoT('ui_c1b845f3cb2b')}</label>
          <Select
            id="survey-round"
            className="mt-0 min-w-[16rem] max-w-sm"
            value={selectedRoundId}
            onChange={(event) => setSelectedRoundId(event.target.value)}
          >
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>{autoT('ui_101d931d6b66')} {round.roundNumber || 1} ·{' '}
                {formatDate(round.closedAt || round.startsAt || null)} · {round.responsesCount}{' '}{autoT('ui_062c3d5e1537')}</option>
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
            <p className="text-sm text-[var(--text-secondary)]">{autoT('ui_a47836db8df6')}</p>
          ) : !responsesQuery.data?.rawResponsesAvailable ? (
            <EmptyState
              icon={<Archive className="h-5 w-5" />}
              title={autoT('ui_249cf0e46f58')}
              description={autoT('ui_4353bea7fd0d')}
            />
          ) : (responsesQuery.data?.responses.length || 0) === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={autoT('ui_5c03e9bf45ac')}
              description={autoT('ui_036b5ffc749e')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-2 py-3">#</th>
                    <th className="px-2 py-3">{autoT('ui_4dadb7f4ebb6')}</th>
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
                          className="h-8 w-8 text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-text)]"
                          aria-label={autoT('ui_4cb587fdb765')}
                          title={autoT('ui_4cb587fdb765')}
                          onClick={() => setResponseToDelete(response.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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
              title={autoT('ui_8dbb5c1c7f40')}
            >
              <FileDown className="h-4 w-4" />{autoT('ui_f3e4fadb9e37')}</button>
          </div>
          <div ref={analyticsSummaryRef} data-survey-export-root="true" className="grid gap-4 sm:grid-cols-3">
            <SurfaceCard padding="sm">
              <div className="text-xs text-[var(--text-secondary)]">{autoT('ui_ccb381b8f440')}</div>
              <div className="mt-1 text-2xl font-bold text-viridian">
                {analytics?.responsesCount ?? 0}
              </div>
            </SurfaceCard>
            <SurfaceCard padding="sm">
              <div className="text-xs text-[var(--text-secondary)]">{autoT('ui_fc91708230d3')}</div>
              <div className="mt-1 text-2xl font-bold text-viridian">
                {analytics?.expectedParticipants ?? '–'}
              </div>
            </SurfaceCard>
            <SurfaceCard padding="sm">
              <div className="text-xs text-[var(--text-secondary)]">{autoT('ui_54de2ae8fb71')}</div>
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
              title={autoT('ui_a9031418ca8b')}
              description={autoT('ui_1f4fc65b60a1')}
            />
          ) : !analytics || analytics.questions.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="h-5 w-5" />}
              title={autoT('ui_374c516cd86d')}
              description={autoT('ui_8b17c7d7eb11')}
            />
          ) : (
            analytics.questions.map((result) => {
              const question = byQuestion.get(result.id);
              const exportActions = (
                <StatisticsExportActions
                  triggerLabel={`${result.label} exportieren`}
                  menuTitle={autoT('ui_8dbb5c1c7f40')}
                  isExporting={activeAnalyticsExport?.startsWith(`${result.id}:`) ?? false}
                  options={[
                    {
                      label: autoT('ui_eac2deaf6270'),
                      meta: 'Bild',
                      onClick: () => void exportAnalyticsCard(result.id, result.label, 'png'),
                    },
                    {
                      label: autoT('ui_d2ca42015ecd'),
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
                    data-survey-export-root="true"
                    ref={(node) => {
                      analyticsCardRefs.current[result.id] = node;
                    }}
                  >
                    <SurfaceCard>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="font-semibold text-viridian">{result.label}</h2>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {result.answeredCount}{' '}{autoT('ui_6db5b569b339')}</p>
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
                          <p className="text-sm text-[var(--text-secondary)]">{autoT('ui_0ec97f4e3a8f')}</p>
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
                  data-survey-export-root="true"
                  ref={(node) => {
                    analyticsCardRefs.current[result.id] = node;
                  }}
                >
                  <SurfaceCard className="p-3 md:p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-semibold text-viridian">{result.label}</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--text-secondary)]">
                          {result.answeredCount}{' '}{autoT('ui_062c3d5e1537')}{result.median ? ` · Median ${result.median}` : ''}
                        </span>
                        {exportActions}
                      </div>
                    </div>
                    <div className="mt-4 h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fill: 'var(--text-primary)', fontSize: 12 }}
                            axisLine={{ stroke: 'var(--border-strong)' }}
                            tickLine={{ stroke: 'var(--border-strong)' }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={question?.type === 'scale' ? 112 : 96}
                            tick={{ fill: 'var(--text-primary)', fontSize: 12 }}
                            axisLine={{ stroke: 'var(--border-strong)' }}
                            tickLine={{ stroke: 'var(--border-strong)' }}
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
            <p className="text-sm text-[var(--text-secondary)]">{autoT('ui_05c879a14797')}</p>
          ) : !trendQuery.data?.rounds.length ? (
            <EmptyState
              icon={<BarChart3 className="h-5 w-5" />}
              title={autoT('ui_88edadaf8ed0')}
              description={autoT('ui_eebd0a308479')}
            />
          ) : (
            <>
              <SurfaceCard>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-viridian">{autoT('ui_e7b9a4f53c47')}</h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{autoT('ui_d4f4165a09bd')}</p>
                  </div>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {trendQuery.data.rounds.length}{' '}{autoT('ui_c042750d784a')}</span>
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
                      <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={{ stroke: 'var(--border-strong)' }} />
                      <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={{ stroke: 'var(--border-strong)' }} />
                      <Tooltip content={<SurveyTrendTooltip />} />
                      <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.75rem', paddingTop: '0.5rem' }} />
                      <Line
                        type="monotone"
                        dataKey="antworten"
                        name={autoT('ui_062c3d5e1537')}
                        stroke="var(--viridian)"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="ruecklauf"
                        name={autoT('ui_46440c082ca2')}
                        stroke="var(--cambridge-blue)"
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
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{autoT('ui_e598620ca100')}</p>
                      <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data}>
                            <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={{ stroke: 'var(--border-strong)' }} />
                            <YAxis domain={[0, 5]} allowDecimals tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={{ stroke: 'var(--border-strong)' }} />
                            <Tooltip content={<SurveyTrendTooltip />} />
                            <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.75rem', paddingTop: '0.5rem' }} />
                            <Line
                              type="monotone"
                              dataKey="mittelwert"
                              name="Mittelwert"
                              stroke="var(--viridian)"
                              strokeWidth={2}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey="median"
                              name="Median"
                              stroke="var(--cambridge-blue)"
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
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{autoT('ui_fec57a250155')}</p>
                      <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data}>
                            <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={{ stroke: 'var(--border-strong)' }} />
                            <YAxis domain={[0, 100]} unit=" %" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={{ stroke: 'var(--border-strong)' }} />
                            <Tooltip content={<SurveyTrendTooltip />} />
                            <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.75rem', paddingTop: '0.5rem' }} />
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
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{autoT('ui_ef7b6cec0340')}</p>
                    <div className="mt-4 h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={{ stroke: 'var(--border-strong)' }} />
                          <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={{ stroke: 'var(--border-strong)' }} />
                          <Tooltip content={<SurveyTrendTooltip />} />
                          <Line
                            type="monotone"
                            dataKey="antworten"
                            name={autoT('ui_062c3d5e1537')}
                            stroke="var(--viridian)"
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
        title={autoT('ui_26677a5c7c34')}
        message={
          <div className="space-y-3">
            <p>{autoT('ui_82dbe021c67e')}</p>
            <label className="block text-sm font-medium">{autoT('ui_40e1cfb6677f')}<Input
                className="mt-1"
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                placeholder={autoT('ui_528e0c7f9ce9')}
              />
            </label>
          </div>
        }
        confirmLabel={autoT('ui_9df6718de96c')}
        onConfirm={() => void runDelete()}
        onCancel={() => {
          setResponseToDelete(null);
          setDeleteReason('');
        }}
      />
      <ConfirmModal
        open={closeConfirmOpen}
        title={autoT('ui_15af943f95ba')}
        message={autoT('ui_bf364d05658c')}
        confirmLabel={autoT('ui_08b39170adbb')}
        onConfirm={() => {
          setCloseConfirmOpen(false);
          close.mutate(survey.id, {
            onSuccess: () => showToast(autoT('ui_b6599411b4b2')),
            onError: () => showToast(autoT('ui_7cca36c94c68'), { type: 'error' }),
          });
        }}
        onCancel={() => setCloseConfirmOpen(false)}
      />
      <Modal
        open={completeExportOpen}
        onClose={() => setCompleteExportOpen(false)}
        title={autoT('ui_8dbb5c1c7f40')}
        maxWidth="xl"
      >
        <div className="space-y-4 text-sm text-[var(--text-secondary)]">
          <p>{autoT('ui_351754dd5117')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 text-left transition-colors hover:border-[var(--interactive-soft-border)] hover:bg-[var(--surface-3)] disabled:cursor-wait disabled:opacity-60"
              disabled={activeCompleteAnalyticsExport !== null}
              onClick={() => {
                setCompleteExportOpen(false);
                void exportCompleteAnalytics('pdf');
              }}
            >
              <div className="font-semibold text-[var(--text-primary)]">{autoT('ui_104827f9e0c7')}</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">{autoT('ui_e05743742ed0')}</div>
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--interactive-soft-border)] bg-[var(--interactive-soft)] p-4 text-left transition-colors hover:border-[var(--interactive-soft-border)] hover:bg-[var(--interactive-soft-strong)] disabled:cursor-wait disabled:opacity-60"
              disabled={activeCompleteAnalyticsExport !== null}
              onClick={() => {
                setCompleteExportOpen(false);
                void exportCompleteAnalytics('xlsx');
              }}
            >
              <div className="font-semibold text-viridian">{autoT('ui_3f995f9a80f3')}</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">{autoT('ui_21fdb98658a3')}</div>
            </button>
          </div>
        </div>
      </Modal>
      <ExportProgressModal message={exportProgress} />
    </div>
  );
}
