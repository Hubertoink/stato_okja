import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { useProjects } from '@/lib/projects';
import {
  CustomKpiDefinition,
  CustomKpiMetric,
  CustomKpiPayload,
  CustomKpiSurface,
  useCreateCustomKpi,
  useCustomKpiResults,
  useCustomKpis,
  useDeleteCustomKpi,
  useUpdateCustomKpi,
} from '@/lib/customKpis';

type CustomKpiCardsProps = {
  surface: Exclude<CustomKpiSurface, 'both'>;
  from?: string;
  to?: string;
  title?: string;
  className?: string;
  showManager?: boolean;
  refreshOptions?: {
    refetchOnWindowFocus?: boolean | 'always';
    refetchIntervalMs?: number;
  };
};

type KpiFormState = {
  id?: string;
  title: string;
  surface: CustomKpiSurface;
  metric: CustomKpiMetric;
  dateMode: 'inherit' | 'current_month' | 'current_year' | 'rolling_weeks';
  rollingWeeks: number;
  enabled: boolean;
  backgroundColor: string;
  projectId: string;
  type: string;
  executionStatusMode: 'completed' | 'all' | 'cancelled';
  weekdays: number[];
  position?: number;
};

const TYPE_OPTIONS = [
  { value: '', label: 'Alle Typen' },
  { value: 'open_door', label: 'Offene Tür' },
  { value: 'project_open', label: 'Projekt (offen)' },
  { value: 'project_closed', label: 'Projekt (geschlossen)' },
  { value: 'event', label: 'Veranstaltung' },
  { value: 'outreach', label: 'Aufsuchend' },
];

const METRIC_OPTIONS: Array<{ value: CustomKpiMetric; label: string; hint: string }> = [
  { value: 'activity_count', label: 'Aktivitäten', hint: 'Anzahl stattgefundener Aktivitäten' },
  { value: 'participant_total', label: 'Teilnehmende', hint: 'Summe aller Teilnehmenden' },
  { value: 'duration_hours', label: 'Gesamtstunden', hint: 'Summe der Dauer in Stunden' },
  {
    value: 'duration_hours_per_week',
    label: 'Stunden pro Woche',
    hint: 'Gesamtstunden geteilt durch Wochen im Zeitraum',
  },
  {
    value: 'avg_participants_per_activity',
    label: 'Ø Teilnehmende / Aktivität',
    hint: 'Durchschnitt pro Aktivität',
  },
  {
    value: 'participants_per_hour',
    label: 'Teilnehmende / Stunde',
    hint: 'Teilnehmende im Verhältnis zur Dauer',
  },
  { value: 'female_total', label: 'Mädchen absolut', hint: 'Summe weiblicher Teilnehmender' },
  {
    value: 'female_share_percent',
    label: 'Mädchenanteil',
    hint: 'Weibliche Teilnehmende in Prozent',
  },
  { value: 'male_total', label: 'Jungen absolut', hint: 'Summe männlicher Teilnehmender' },
  { value: 'diverse_total', label: 'Divers absolut', hint: 'Summe diverser Teilnehmender' },
];

const DATE_MODE_OPTIONS = [
  { value: 'inherit', label: 'Zeitraum der Seite' },
  { value: 'current_month', label: 'Aktueller Monat' },
  { value: 'current_year', label: 'Aktuelles Jahr' },
  { value: 'rolling_weeks', label: 'Letzte X Wochen' },
] as const;

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 0, label: 'So' },
];

const LIGHT_KPI_COLOR_OPTIONS = ['#ffffff', '#eff6ff', '#ecfdf5', '#fff7ed', '#fdf2f8', '#eef2ff', '#1f2937', '#0f766e'];
const DARK_KPI_COLOR_OPTIONS = ['#0d1422', '#111a2b', '#1c2740', '#17303a', '#2b2d42', '#3a2747', '#4a2f24', '#0f766e'];
const DARK_KPI_THEMES = new Set(['Midnight', 'Coastal Vibes']);

const emptyForm: KpiFormState = {
  title: '',
  surface: 'both',
  metric: 'duration_hours',
  dateMode: 'inherit',
  rollingWeeks: 4,
  enabled: true,
  backgroundColor: '#ffffff',
  projectId: '',
  type: '',
  executionStatusMode: 'completed',
  weekdays: [],
};

function getExecutionStatusMode(
  definition: CustomKpiDefinition,
): KpiFormState['executionStatusMode'] {
  const statuses = definition.filters?.executionStatuses || ['completed'];
  if (statuses.includes('completed') && statuses.includes('cancelled')) return 'all';
  if (statuses.includes('cancelled')) return 'cancelled';
  return 'completed';
}

function toFormState(
  definition?: CustomKpiDefinition,
  fallbackBackgroundColor = '#ffffff',
): KpiFormState {
  if (!definition) return { ...emptyForm, backgroundColor: fallbackBackgroundColor };
  return {
    id: definition.id,
    title: definition.title,
    surface: definition.surface,
    metric: definition.metric,
    dateMode: definition.dateMode,
    rollingWeeks: definition.rollingWeeks || 4,
    enabled: definition.enabled,
    backgroundColor: definition.backgroundColor || fallbackBackgroundColor,
    projectId: definition.filters?.projectId || '',
    type: definition.filters?.type || '',
    executionStatusMode: getExecutionStatusMode(definition),
    weekdays: definition.filters?.weekdays || [],
    position: definition.position,
  };
}

function executionStatusesFromMode(mode: KpiFormState['executionStatusMode']) {
  if (mode === 'all') return ['completed', 'cancelled'];
  if (mode === 'cancelled') return ['cancelled'];
  return ['completed'];
}

function toPayload(form: KpiFormState, fallbackPosition: number): CustomKpiPayload {
  return {
    title: form.title.trim(),
    surface: form.surface,
    metric: form.metric,
    dateMode: form.dateMode,
    rollingWeeks: form.dateMode === 'rolling_weeks' ? form.rollingWeeks : null,
    enabled: form.enabled,
    backgroundColor: normalizeHexColor(form.backgroundColor),
    position: form.position ?? fallbackPosition,
    filters: {
      projectId: form.projectId || undefined,
      type: form.type || undefined,
      executionStatuses: executionStatusesFromMode(form.executionStatusMode),
      weekdays: form.weekdays.length > 0 ? form.weekdays : undefined,
    },
  };
}

function normalizeHexColor(value?: string) {
  const color = String(value || '#ffffff').trim();
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color.toLowerCase() : '#ffffff';
}

function getKpiColorForTheme(value: string | undefined, isDarkTheme: boolean) {
  const color = normalizeHexColor(value);
  const sourcePalette = isDarkTheme ? LIGHT_KPI_COLOR_OPTIONS : DARK_KPI_COLOR_OPTIONS;
  const targetPalette = isDarkTheme ? DARK_KPI_COLOR_OPTIONS : LIGHT_KPI_COLOR_OPTIONS;
  const pairedIndex = sourcePalette.indexOf(color);

  return pairedIndex >= 0 ? targetPalette[pairedIndex] : color;
}

function getTextColorForBackground(backgroundColor?: string) {
  const color = normalizeHexColor(backgroundColor).slice(1);
  const red = parseInt(color.slice(0, 2), 16) / 255;
  const green = parseInt(color.slice(2, 4), 16) / 255;
  const blue = parseInt(color.slice(4, 6), 16) / 255;
  const luminance = [red, green, blue]
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.46 ? '#111827' : '#ffffff';
}

function getMutedTextColor(textColor: string) {
  return textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.78)' : '#6b7280';
}

function formatKpiValue(value: number | null, unit: string, precision: number) {
  if (value === null || typeof value === 'undefined') return '-';
  const formatted = value.toLocaleString('de-DE', {
    minimumFractionDigits: precision > 0 ? 0 : undefined,
    maximumFractionDigits: precision,
  });
  if (unit === 'percent') return `${formatted} %`;
  return formatted;
}

const KPI_DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function formatKpiDate(value?: string) {
  if (!value) return undefined;
  const date = parseIsoDate(value);
  return date ? KPI_DATE_FORMATTER.format(date) : value;
}

function isDarkKpiTheme() {
  if (typeof document === 'undefined') return false;
  return DARK_KPI_THEMES.has(document.documentElement.getAttribute('data-theme') || '');
}

function rangeLabel(range: { from?: string; to?: string }) {
  const from = formatKpiDate(range.from);
  const to = formatKpiDate(range.to);

  if (!from && !to) return 'Gesamter Zeitraum';
  if (from && to) return `${from} bis ${to}`;
  return from ? `ab ${from}` : `bis ${to}`;
}

export default function CustomKpiCards({
  surface,
  from,
  to,
  title = 'Eigene KPIs',
  className = '',
  showManager = true,
  refreshOptions,
}: CustomKpiCardsProps) {
  const [isDarkTheme, setIsDarkTheme] = useState(() => isDarkKpiTheme());
  const colorOptions = isDarkTheme ? DARK_KPI_COLOR_OPTIONS : LIGHT_KPI_COLOR_OPTIONS;
  const defaultBackgroundColor = colorOptions[0];
  const previousIsDarkThemeRef = useRef(isDarkTheme);
  const [managerOpen, setManagerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<KpiFormState>({
    ...emptyForm,
    backgroundColor: defaultBackgroundColor,
  });
  const [error, setError] = useState<string | null>(null);
  const definitionsQ = useCustomKpis(refreshOptions);
  const resultsQ = useCustomKpiResults({ surface, from, to }, refreshOptions);
  const createKpi = useCreateCustomKpi();
  const updateKpi = useUpdateCustomKpi();
  const deleteKpi = useDeleteCustomKpi();
  const { data: projects = [] } = useProjects({ archived: false });

  const definitions = definitionsQ.data ?? [];
  const results = resultsQ.data ?? [];
  const filteredProjects = useMemo(
    () => (form.type ? projects.filter((project) => project.type === form.type) : projects),
    [form.type, projects],
  );

  useEffect(() => {
    if (!form.projectId) return;
    if (!filteredProjects.some((project) => project.id === form.projectId)) {
      setForm((current) => ({ ...current, projectId: '' }));
    }
  }, [filteredProjects, form.projectId]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(isDarkKpiTheme());
    const observer = new MutationObserver(syncTheme);

    syncTheme();
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (previousIsDarkThemeRef.current === isDarkTheme) return;

    previousIsDarkThemeRef.current = isDarkTheme;
    setForm((current) => ({
      ...current,
      backgroundColor: getKpiColorForTheme(current.backgroundColor, isDarkTheme),
    }));
  }, [isDarkTheme]);

  const beginCreate = () => {
    setError(null);
    setForm({ ...emptyForm, surface, backgroundColor: defaultBackgroundColor });
    setEditorOpen(true);
  };

  const beginEdit = (definition: CustomKpiDefinition) => {
    setError(null);
    const nextForm = toFormState(definition, defaultBackgroundColor);
    setForm({
      ...nextForm,
      backgroundColor: getKpiColorForTheme(nextForm.backgroundColor, isDarkTheme),
    });
    setEditorOpen(true);
  };

  const save = async () => {
    const payload = toPayload(form, definitions.length);
    if (!payload.title) {
      setError('Bitte einen Namen vergeben.');
      return;
    }
    setError(null);
    if (form.id) {
      await updateKpi.mutateAsync({ id: form.id, payload });
    } else {
      await createKpi.mutateAsync(payload);
    }
    setForm({ ...emptyForm, surface, backgroundColor: defaultBackgroundColor });
    setEditorOpen(false);
  };

  const toggleWeekday = (weekday: number) => {
    setForm((current) => ({
      ...current,
      weekdays: current.weekdays.includes(weekday)
        ? current.weekdays.filter((entry) => entry !== weekday)
        : [...current.weekdays, weekday].sort((left, right) => left - right),
    }));
  };

  const isSaving = createKpi.isPending || updateKpi.isPending;

  return (
    <section className={className} data-pdf-section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        {showManager && (
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Settings2 className="h-4 w-4" />
            KPIs anpassen
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {results.map((item) => {
            const backgroundColor = getKpiColorForTheme(item.definition.backgroundColor, isDarkTheme);
            const textColor = getTextColorForBackground(backgroundColor);
            const mutedColor = getMutedTextColor(textColor);
            return (
              <div
                key={item.definition.id}
                className="kpi-card text-center"
                style={{ backgroundColor, color: textColor }}
              >
                <p className="text-3xl font-bold" style={{ color: textColor }}>
                  {formatKpiValue(item.value, item.unit, item.precision)}
                </p>
                <p className="mt-2 text-sm font-medium" style={{ color: textColor }}>
                  {item.definition.title}
                </p>
                <p className="mt-1 text-xs" style={{ color: mutedColor }}>
                  {rangeLabel(item.range)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showManager && managerOpen}
        title="Eigene KPIs"
        onClose={() => {
          setManagerOpen(false);
          setEditorOpen(false);
        }}
        maxWidth="xl"
        blur={false}
      >
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-gray-800">Gespeicherte KPIs</h4>
              <button
                type="button"
                onClick={beginCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-viridian px-3 py-2 text-sm font-medium text-white hover:bg-cambridge-blue"
              >
                <Plus className="h-4 w-4" />
                Neu
              </button>
            </div>

            {definitions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                Noch keine eigenen KPIs angelegt.
              </div>
            ) : (
              <div className="space-y-2">
                {definitions.map((definition) => {
                  const backgroundColor = getKpiColorForTheme(definition.backgroundColor, isDarkTheme);
                  const textColor = getTextColorForBackground(backgroundColor);
                  const mutedColor = getMutedTextColor(textColor);
                  const borderColor =
                    textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(17, 24, 39, 0.12)';
                  return (
                    <div
                      key={definition.id}
                      className="rounded-lg border p-3 shadow-sm"
                      style={{ backgroundColor, borderColor, color: textColor }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium" style={{ color: textColor }}>
                            {definition.title}
                          </div>
                          <div className="mt-1 text-xs" style={{ color: mutedColor }}>
                            {METRIC_OPTIONS.find((metric) => metric.value === definition.metric)
                              ?.label || definition.metric}{' '}
                            · {definition.enabled ? 'aktiv' : 'inaktiv'}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => beginEdit(definition)}
                            className="rounded-lg p-2 transition-colors hover:bg-black/10"
                            style={{ color: textColor }}
                            aria-label="KPI bearbeiten"
                            title="KPI bearbeiten"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteKpi.mutate(definition.id)}
                            className="rounded-lg p-2 transition-colors hover:bg-black/10"
                            style={{ color: textColor }}
                            aria-label="KPI löschen"
                            title="KPI löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </Modal>

      <Modal
        open={showManager && editorOpen}
        title={form.id ? 'KPI bearbeiten' : 'KPI anlegen'}
        onClose={() => setEditorOpen(false)}
        maxWidth="lg"
        blur={false}
      >
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="mb-4 font-semibold text-gray-800">
              {form.id ? 'KPI bearbeiten' : 'KPI anlegen'}
            </h4>
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Name</span>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/20"
                  placeholder="z.B. Offener Bereich Stunden"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Kennzahl</span>
                <select
                  value={form.metric}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      metric: event.target.value as CustomKpiMetric,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/20"
                >
                  {METRIC_OPTIONS.map((metric) => (
                    <option key={metric.value} value={metric.value}>
                      {metric.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-gray-500">
                  {METRIC_OPTIONS.find((metric) => metric.value === form.metric)?.hint}
                </span>
              </label>

              <div className="rounded-lg border border-gray-200 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Hintergrundfarbe</div>
                  </div>
                  <input
                    type="color"
                    value={normalizeHexColor(form.backgroundColor)}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, backgroundColor: event.target.value }))
                    }
                    className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
                    aria-label="KPI-Hintergrundfarbe wählen"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => {
                    const active = normalizeHexColor(form.backgroundColor) === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, backgroundColor: color }))}
                        className={`h-8 w-8 rounded-full border transition-transform ${active ? 'scale-110 border-gray-900 ring-2 ring-gray-900/15' : 'border-gray-300 hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Farbe ${color} auswählen`}
                        title={color}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Anzeigen auf</span>
                  <select
                    value={form.surface}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        surface: event.target.value as CustomKpiSurface,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/20"
                  >
                    <option value="both">Dashboard & Statistik</option>
                    <option value="dashboard">Dashboard</option>
                    <option value="statistics">Statistik</option>
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Zeitraum</span>
                  <select
                    value={form.dateMode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dateMode: event.target.value as KpiFormState['dateMode'],
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/20"
                  >
                    {DATE_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {form.dateMode === 'rolling_weeks' && (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Anzahl Wochen</span>
                  <input
                    type="number"
                    min={1}
                    max={104}
                    value={form.rollingWeeks}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        rollingWeeks: Number(event.target.value) || 4,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/20"
                  />
                </label>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Typ</span>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, type: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/20"
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Projekt</span>
                  <select
                    value={form.projectId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, projectId: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/20"
                  >
                    <option value="">Alle Projekte</option>
                    {filteredProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Status</span>
                <select
                  value={form.executionStatusMode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      executionStatusMode: event.target
                        .value as KpiFormState['executionStatusMode'],
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/20"
                >
                  <option value="completed">Nur stattgefunden</option>
                  <option value="all">Stattgefunden und ausgefallen</option>
                  <option value="cancelled">Nur ausgefallen</option>
                </select>
              </label>

              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">Wochentage</div>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((weekday) => {
                    const active = form.weekdays.includes(weekday.value);
                    return (
                      <button
                        key={weekday.value}
                        type="button"
                        onClick={() => toggleWeekday(weekday.value)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${active ? 'border-viridian bg-viridian text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                      >
                        {weekday.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, enabled: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
                />
                Aktiv anzeigen
              </label>

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={beginCreate}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Zurücksetzen
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={save}
                  className="rounded-lg bg-viridian px-4 py-2 text-sm font-semibold text-white hover:bg-cambridge-blue disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
      </Modal>
    </section>
  );
}
