import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Target,
  Download,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Archive,
  RotateCcw,
  Copy,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePublicConfig } from '@/lib/publicConfig';
import { useOrgScopeKey } from '@/lib/orgScope';
import { useActiveOrganizationName } from '@/lib/useActiveOrganizationName';
import { useActivitiesPaged, useActivity } from '@/lib/activities';
import { useProjects } from '@/lib/projects';
import { colorFromStringHash } from '@/lib/colors';
import ProjectPickerModal from './ProjectPickerModal';
import ProtectedImage from '@/components/ProtectedImage';
import {
  AnnualTarget,
  TargetPayload,
  TargetScope,
  TargetMutation,
  targetMetrics,
  targetTypes,
  targetStatuses,
  targetYear,
  targetScopeLabel,
  targetRequirement,
  formatTargetValue,
  targetDifference,
  targetError,
  targetPeriod,
  targetPeriodLabel,
  targetMonths,
  targetCanClose,
  useAnnualTargets,
  useAnnualTarget,
  useTargetMutation,
} from '@/lib/annualTargets';
import Modal from '@/components/Modal';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, Textarea, FieldLabel } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatisticsTabs, TargetProgress, AnnualTargetCard } from '@/components/AnnualTargetCards';
import AnnualTargetActivities from '@/components/AnnualTargetActivities';

const dateLabel = (date: string) => date.split('-').reverse().join('.');

export default function AnnualTargets() {
  const scopeKey = useOrgScopeKey();
  const config = usePublicConfig();
  if (config.isPending) return <p role="status">Konfiguration wird geladen …</p>;
  if (config.isError)
    return (
      <div role="alert">
        Konfiguration konnte nicht geladen werden.{' '}
        <Button onClick={() => void config.refetch()}>Erneut laden</Button>
      </div>
    );
  if (!config.data.annualTargetsEnabled)
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Jahresziele deaktiviert</h1>
        <p className="mt-2">
          Dieses Modul ist in dieser Installation nicht aktiviert. Vorhandene Daten bleiben
          erhalten.
        </p>
        <Link className="mt-4 inline-block underline" to="/statistics">
          Zur Statistik
        </Link>
      </div>
    );
  return <AnnualTargetsContent key={scopeKey} />;
}

function AnnualTargetsContent() {
  const { user } = useAuth();
  const organization = useActiveOrganizationName();
  const [params, setParams] = useSearchParams();
  const parsedYear = Number(params.get('year'));
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2200
      ? parsedYear
      : targetYear();
  const scope: TargetScope = params.get('activityId')
    ? { activityId: params.get('activityId')! }
    : params.get('projectId')
      ? { projectId: params.get('projectId')! }
      : {};
  const isAdmin = user?.role === 'org_admin' || user?.role === 'superadmin';
  const query = useAnnualTargets(year);
  const [editor, setEditor] = useState<AnnualTarget | 'new' | null>(null);
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const targets = (query.data ?? []).filter((target) =>
    scope.activityId
      ? target.scope.activityId === scope.activityId
      : scope.projectId
        ? target.scope.projectId === scope.projectId
        : true,
  );
  const targetId = params.get('target');
  const setParam = (name: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };
  const exportReport = async (format: 'xlsx' | 'pdf') => {
    setExportError('');
    setExporting(true);
    try {
      const { exportAnnualTargets } = await import('./statistics/export/annualTargetsExport');
      await exportAnnualTargets(targets, year, organization ?? 'Ohne Einrichtung', format);
    } catch {
      setExportError('Der Export ist fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="space-y-5 text-[var(--text-primary)]">
      <PageHeader title="Statistik" />
      <StatisticsTabs />
      <section className="modern-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Target />
              Jahresziele
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {organization || 'Ohne Einrichtung'} · Gemeinsam vereinbaren, Fortschritt verfolgen
              und das Jahr auswerten.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setEditor('new')}>
              <Plus />
              Ziel hinzufügen
            </Button>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-2">
            <IconButton
              variant="secondary"
              aria-label="Vorjahr"
              title="Vorjahr"
              disabled={year <= 2000}
              onClick={() => setParam('year', String(year - 1))}
            >
              <ChevronLeft aria-hidden="true" />
            </IconButton>
            <FieldLabel className="w-32">
              Zieljahr
              <Input
                aria-label="Zieljahr"
                type="number"
                min={2000}
                max={2200}
                key={year}
                defaultValue={year}
                onBlur={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isInteger(value) && value >= 2000 && value <= 2200) {
                    const next = new URLSearchParams(params);
                    next.set('year', String(value));
                    next.delete('target');
                    setParams(next);
                  } else {
                    event.target.value = String(year);
                  }
                }}
              />
            </FieldLabel>
            <IconButton
              variant="secondary"
              aria-label="Folgejahr"
              title="Folgejahr"
              disabled={year >= 2200}
              onClick={() => setParam('year', String(year + 1))}
            >
              <ChevronRight aria-hidden="true" />
            </IconButton>
          </div>
          <Button
            variant="secondary"
            disabled={exporting || !targets.length}
            onClick={() => void exportReport('xlsx')}
          >
            <Download />
            Excel
          </Button>
          <Button
            variant="secondary"
            disabled={exporting || !targets.length}
            onClick={() => void exportReport('pdf')}
          >
            <Download />
            PDF
          </Button>
          {(scope.projectId || scope.activityId) && (
            <Button
              variant="ghost"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete('projectId');
                next.delete('activityId');
                setParams(next);
              }}
            >
              Bezug aufheben
            </Button>
          )}
        </div>
        {(scope.projectId || scope.activityId) && (
          <p className="mt-3 text-sm">
            Ansicht eingeschränkt auf{' '}
            {scope.activityId ? 'die ausgewählte Aktivität' : 'das ausgewählte Projekt'}. Neue Ziele
            übernehmen diesen Bezug.
          </p>
        )}
        {!isAdmin && (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Jahresziele werden von den Admins deiner Einrichtung festgelegt und geändert.
          </p>
        )}
        {exportError && (
          <p role="alert" className="mt-3">
            {exportError}
          </p>
        )}
      </section>
      {query.isPending ? (
        <p role="status">Jahresziele werden geladen …</p>
      ) : query.isError ? (
        <div role="alert">
          {targetError(query.error)}{' '}
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Erneut laden
          </Button>
        </div>
      ) : targets.length === 0 ? (
        <section className="modern-card p-8 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-viridian" />
          <h2 className="text-lg font-semibold">Noch keine Jahresziele für {year}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Lege Vorgaben für Stunden, Besuche, Aktivitäten oder Genderanteile fest. Die Istwerte
            berechnet Stato aus der Dokumentation.
          </p>
        </section>
      ) : (
        <section aria-label="Jahresziele im Überblick" className="space-y-4">
          <div className="annual-target-overview">
            <span>
              <strong>{targets.length}</strong>{' '}
              {targets.length === 1 ? 'Jahresziel' : 'Jahresziele'}
            </span>
            <span>
              <strong>{targets.filter((target) => target.status === 'draft').length}</strong>{' '}
              Entwürfe
            </span>
            <span>
              <strong>{targets.filter((target) => target.status === 'active').length}</strong>{' '}
              festgelegt
            </span>
            <span>
              <strong>{targets.filter((target) => target.status === 'closed').length}</strong>{' '}
              abgeschlossen
            </span>
          </div>
          <div className="annual-target-grid">
            {targets.map((target) => (
              <AnnualTargetCard
                key={target.id}
                target={target}
                onOpen={() => setParam('target', target.id)}
              />
            ))}
          </div>
        </section>
      )}
      <details className="annual-target-notes">
        <summary>Wie werden die Jahresziele berechnet?</summary>
        <p>
          Istwerte zählen durchgeführte Aktivitäten im Zielzeitraum bis zum Stichtag. Ohne eigenen
          Zeitraum gilt das ganze Zieljahr. Jahresübergreifende Ziele erscheinen in jedem
          betroffenen Jahr; ihre Werte beziehen sich immer auf den gesamten Zielzeitraum. Besuche
          sind Teilnahmen, keine unterschiedlichen Personen. Prozentanteile beziehen sich auf
          Besuche mit Geschlechtszuordnung. Sich überschneidende Ziele werden einzeln ausgewertet.
        </p>
      </details>
      {editor && isAdmin && (
        <TargetEditor
          initial={editor === 'new' ? undefined : editor}
          year={year}
          scope={scope}
          onClose={() => setEditor(null)}
          onSaved={(savedYear) => {
            setEditor(null);
            if (savedYear !== year) setParam('year', String(savedYear));
          }}
        />
      )}
      {targetId && !editor && (
        <TargetDetail
          key={targetId}
          id={targetId}
          isAdmin={isAdmin}
          onClose={() => setParam('target')}
          onEdit={setEditor}
        />
      )}
    </div>
  );
}

function TargetEditor({
  initial,
  year,
  scope,
  onClose,
  onSaved,
}: {
  initial?: AnnualTarget;
  year: number;
  scope: TargetScope;
  onClose: () => void;
  onSaved: (year: number) => void;
}) {
  const [form, setForm] = useState<TargetPayload>(() =>
    initial
      ? {
          title: initial.title,
          year: initial.year,
          dateFrom: initial.dateFrom ?? null,
          dateTo: initial.dateTo ?? null,
          metric: initial.metric,
          scope: initial.scope,
          rule: initial.rule,
          target: initial.target,
          upperTarget: initial.upperTarget,
          description: initial.description,
          showOnDashboard: initial.showOnDashboard,
          version: initial.version,
          reason: '',
        }
      : {
          title: '',
          year,
          dateFrom: null,
          dateTo: null,
          metric: 'duration_hours',
          scope,
          rule: 'min',
          target: 0,
          upperTarget: null,
          description: '',
          showOnDashboard: true,
        },
  );
  const [scopeMode, setScopeMode] = useState(() =>
    form.scope.activityId
      ? 'activity'
      : form.scope.projectId
        ? 'project'
        : form.scope.types?.length
          ? 'types'
          : 'all',
  );
  const [activitySearch, setActivitySearch] = useState('');
  const [customPeriod, setCustomPeriod] = useState(!!initial?.dateFrom);
  const [activityPage, setActivityPage] = useState(1);
  const [pickActivity, setPickActivity] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const projects = useProjects();
  const selectedProject = projects.data?.find((project) => project.id === form.scope.projectId);
  const projectTitle =
    selectedProject?.title ||
    (form.scope.projectId && form.scope.projectId === initial?.scope.projectId
      ? initial.scopeLabel
      : '');
  const selectedActivity = useActivity(form.scope.activityId);
  const mutation = useTargetMutation();
  const change = <K extends keyof TargetPayload>(key: K, value: TargetPayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (projectPickerOpen || (scopeMode === 'project' && !form.scope.projectId)) return;
    mutation.mutate(
      { action: 'save', id: initial?.id, payload: form },
      { onSuccess: () => onSaved(form.year) },
    );
  };
  return (
    <>
      <Modal
        open
        title={initial ? 'Jahresziel bearbeiten' : 'Jahresziel anlegen'}
        onClose={() => {
          if (!mutation.isPending) onClose();
        }}
        maxWidth="2xl"
        variant="form"
      >
        <form onSubmit={save} className="space-y-4 overflow-y-auto p-4 sm:p-6">
          <FieldLabel>
            Titel
            <Input
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => change('title', e.target.value)}
              placeholder="z. B. Aktivitätsstunden Offene Tür"
            />
          </FieldLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel>
              Zieljahr
              <Input
                type="number"
                required
                min={2000}
                max={2200}
                disabled={initial?.status === 'active' || customPeriod}
                value={form.year}
                onChange={(e) => change('year', Number(e.target.value))}
              />
            </FieldLabel>
            <FieldLabel>
              Kennzahl
              <Select
                value={form.metric}
                onChange={(e) => change('metric', e.target.value as TargetPayload['metric'])}
              >
                {Object.entries(targetMetrics).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FieldLabel>
          </div>
          <FieldLabel>
            Zielzeitraum
            <Select
              value={customPeriod ? 'custom' : 'year'}
              onChange={(e) => {
                const custom = e.target.value === 'custom';
                setCustomPeriod(custom);
                setForm((prev) => ({
                  ...prev,
                  dateFrom: custom ? `${prev.year}-01-01` : null,
                  dateTo: custom ? `${prev.year}-12-31` : null,
                }));
              }}
            >
              <option value="year">Ganzes Zieljahr</option>
              <option value="custom">Eigener Zeitraum</option>
            </Select>
          </FieldLabel>
          {customPeriod && (
            <div className="space-y-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel>
                  Von
                  <Input
                    type="date"
                    required
                    min={initial?.status === 'active' ? `${form.year}-01-01` : '2000-01-01'}
                    max={initial?.status === 'active' ? `${form.year}-12-31` : '2200-12-31'}
                    value={form.dateFrom || ''}
                    onChange={(e) => {
                      const from = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        dateFrom: from,
                        year:
                          from && initial?.status !== 'active'
                            ? Number(from.slice(0, 4))
                            : prev.year,
                      }));
                    }}
                  />
                </FieldLabel>
                <FieldLabel>
                  Bis
                  <Input
                    type="date"
                    required
                    min={form.dateFrom || '2000-01-01'}
                    max="2200-12-31"
                    value={form.dateTo || ''}
                    onChange={(e) => change('dateTo', e.target.value)}
                  />
                </FieldLabel>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Start- und Endtag zählen mit. Das Zieljahr entspricht dem Beginn;
                jahresübergreifende Ziele erscheinen auch in den Folgejahren.
              </p>
            </div>
          )}
          <FieldLabel>
            Geltungsbereich
            <Select
              value={scopeMode}
              onChange={(e) => {
                setScopeMode(e.target.value);
                change('scope', {});
              }}
            >
              {[
                ['all', 'Gesamte Einrichtung'],
                ['types', 'Aktivitätstypen / Bereiche'],
                ['project', 'Bestimmtes Projekt / wiederkehrendes Angebot'],
                ['activity', 'Einzelne Aktivität / Termin'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldLabel>
          {scopeMode === 'types' && (
            <fieldset className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
              <legend className="px-1 text-sm">Aktivitätstypen auswählen</legend>
              {Object.entries(targetTypes).map(([value, label]) => (
                <label className="flex items-center gap-2 text-sm" key={value}>
                  <Input
                    type="checkbox"
                    className="!min-h-0 !w-4"
                    checked={form.scope.types?.includes(value) ?? false}
                    onChange={(event) =>
                      change('scope', {
                        types: event.target.checked
                          ? [...(form.scope.types ?? []), value]
                          : form.scope.types?.filter((type) => type !== value),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
          {scopeMode === 'project' && (
            <div>
              <FieldLabel htmlFor="annual-target-project" className="mb-1">
                Projekt
              </FieldLabel>
              <Button
                id="annual-target-project"
                variant="secondary"
                className="w-full justify-start gap-3 text-left"
                aria-haspopup="dialog"
                aria-expanded={projectPickerOpen}
                aria-label={
                  projectTitle ? `Projekt auswählen: ${projectTitle}` : 'Projekt auswählen'
                }
                onClick={() => setProjectPickerOpen(true)}
              >
                {selectedProject && (
                  <span
                    className="h-10 w-12 shrink-0 overflow-hidden rounded-md"
                    style={{
                      backgroundColor:
                        selectedProject.color || colorFromStringHash(selectedProject.title),
                    }}
                  >
                    {selectedProject.imageUrl && (
                      <ProtectedImage
                        src={selectedProject.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                )}
                <span className="min-w-0 truncate">
                  {projectTitle || 'Projekt auswählen'}
                  {selectedProject?.archived ? ' (archiviert)' : ''}
                </span>
              </Button>
              {projects.isError && <span role="alert">Projekte konnten nicht geladen werden.</span>}
            </div>
          )}
          {scopeMode === 'activity' && (
            <div className="space-y-2">
              <p className="text-sm">
                {selectedActivity.data
                  ? `${selectedActivity.data.title || 'Aktivität'} · ${dateLabel(selectedActivity.data.date)}`
                  : initial?.scopeLabel || 'Noch keine Aktivität ausgewählt'}
              </p>
              <Button variant="secondary" onClick={() => setPickActivity((value) => !value)}>
                Aktivität auswählen
              </Button>
              {pickActivity && (
                <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-3">
                  <Input
                    aria-label="Aktivität suchen"
                    placeholder="Aktivität suchen …"
                    value={activitySearch}
                    onChange={(e) => {
                      setActivitySearch(e.target.value);
                      setActivityPage(1);
                    }}
                  />
                  <TargetActivityPicker
                    from={targetPeriod(form).from}
                    to={targetPeriod(form).to}
                    search={activitySearch}
                    page={activityPage}
                    onPage={setActivityPage}
                    onPick={(id) => {
                      change('scope', { activityId: id });
                      setPickActivity(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldLabel>
              Vorgabe
              <Select
                value={form.rule}
                onChange={(e) => change('rule', e.target.value as TargetPayload['rule'])}
              >
                <option value="min">Mindestens</option>
                <option value="max">Höchstens</option>
                <option value="range">Zielkorridor</option>
              </Select>
            </FieldLabel>
            <FieldLabel>
              {form.rule === 'range' ? 'Untere Grenze' : 'Zielwert'}
              {form.metric.endsWith('_percent')
                ? ' (%)'
                : form.metric === 'duration_hours'
                  ? ' (h)'
                  : ''}
              <Input
                type="number"
                required
                min={0}
                max={form.metric.endsWith('_percent') ? 100 : 1e9}
                step={
                  form.metric === 'activity_count' || form.metric === 'participant_total'
                    ? 1
                    : 'any'
                }
                value={Number.isNaN(form.target) ? '' : form.target}
                onChange={(e) =>
                  change('target', e.target.value === '' ? NaN : Number(e.target.value))
                }
              />
            </FieldLabel>
            {form.rule === 'range' && (
              <FieldLabel>
                Obere Grenze
                {form.metric.endsWith('_percent')
                  ? ' (%)'
                  : form.metric === 'duration_hours'
                    ? ' (h)'
                    : ''}
                <Input
                  required
                  type="number"
                  min={form.target}
                  max={form.metric.endsWith('_percent') ? 100 : 1e9}
                  step={
                    form.metric === 'activity_count' || form.metric === 'participant_total'
                      ? 1
                      : 'any'
                  }
                  value={form.upperTarget ?? ''}
                  onChange={(e) =>
                    change('upperTarget', e.target.value === '' ? null : Number(e.target.value))
                  }
                />
              </FieldLabel>
            )}
          </div>
          {form.metric.endsWith('_percent') && (
            <p className="text-xs text-[var(--text-muted)]">
              Zielwert zwischen 0 und 100 %. Beispiel: 30 entspricht 30 % der Besuche mit
              Geschlechtszuordnung.
            </p>
          )}
          <FieldLabel>
            Begründung / Verantwortung (optional)
            <Textarea
              rows={3}
              maxLength={4000}
              value={form.description}
              onChange={(e) => change('description', e.target.value)}
            />
          </FieldLabel>
          <label className="flex items-center gap-2 text-sm">
            <Input
              type="checkbox"
              className="!min-h-0 !w-4"
              checked={form.showOnDashboard}
              onChange={(e) => change('showOnDashboard', e.target.checked)}
            />
            Nach dem Festlegen auf dem Dashboard anzeigen
          </label>
          {initial && (
            <FieldLabel>
              Änderungsgrund{initial.status === 'active' ? ' (erforderlich)' : ' (optional)'}
              <Textarea
                required={initial.status === 'active'}
                rows={2}
                maxLength={2000}
                value={form.reason}
                onChange={(e) => change('reason', e.target.value)}
              />
            </FieldLabel>
          )}
          {mutation.isError && (
            <p role="alert" className="text-sm text-[var(--status-danger-text)]">
              {targetError(mutation.error)}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                projectPickerOpen ||
                (scopeMode === 'project' && !form.scope.projectId) ||
                (scopeMode === 'types' && !form.scope.types?.length) ||
                (scopeMode === 'activity' && !form.scope.activityId)
              }
            >
              {mutation.isPending
                ? 'Speichert …'
                : initial
                  ? 'Änderungen speichern'
                  : 'Entwurf speichern'}
            </Button>
          </div>
        </form>
      </Modal>
      {projectPickerOpen && (
        <ProjectPickerModal
          onClose={() => setProjectPickerOpen(false)}
          onPick={(project) => {
            change('scope', { projectId: project.id });
            setProjectPickerOpen(false);
          }}
        />
      )}
    </>
  );
}

function TargetActivityPicker({
  from,
  to,
  search,
  page,
  onPage,
  onPick,
}: {
  from: string;
  to: string;
  search: string;
  page: number;
  onPage: (page: number) => void;
  onPick: (id: string) => void;
}) {
  const query = useActivitiesPaged({ from, to, search, order: 'desc' }, page, 10);
  return (
    <div className="space-y-2">
      {query.isPending ? (
        <p>Lädt …</p>
      ) : query.isError ? (
        <p role="alert">Aktivitäten konnten nicht geladen werden.</p>
      ) : (
        <>
          {query.data.data.map((activity) => (
            <Button
              key={activity.id}
              variant="ghost"
              className="w-full justify-start text-left"
              onClick={() => onPick(activity.id)}
            >
              {dateLabel(activity.date)} ·{' '}
              {activity.title || activity.project?.title || targetTypes[activity.type]}
            </Button>
          ))}
          {!query.data.total && (
            <p className="text-sm">Keine Aktivitäten im Zielzeitraum gefunden.</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page === 1} onClick={() => onPage(page - 1)}>
              Zurück
            </Button>
            <Button
              variant="secondary"
              disabled={page * 10 >= query.data.total}
              onClick={() => onPage(page + 1)}
            >
              Weiter
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function TargetDetail({
  id,
  isAdmin,
  onClose,
  onEdit,
}: {
  id: string;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (target: AnnualTarget) => void;
}) {
  const query = useAnnualTarget(id);
  const mutation = useTargetMutation();
  const [action, setAction] = useState<'activate' | 'close' | 'reopen' | 'copy' | null>(null);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState<number | null>(null);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const target = query.data;
  const execute = (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || !action) return;
    const command: TargetMutation =
      action === 'copy'
        ? { action, id, year: target.year + 1 }
        : { action, id, version: target.version, reason };
    mutation.mutate(command, {
      onSuccess: () => {
        if (action === 'copy') setCopied(target.year + 1);
        setAction(null);
        setReason('');
      },
    });
  };
  const actionLabel = {
    activate: 'Ziel festlegen',
    close: 'Abschluss speichern',
    reopen: 'Wieder öffnen',
    copy: 'Als Entwurf übernehmen',
  };
  return (
    <Modal
      open
      title={target?.title || 'Jahresziel'}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      maxWidth="4xl"
      variant="information"
      contentClassName="pt-4"
      headerActions={
        isAdmin && target ? (
          <div className="annual-target-header-actions">
            {target.status !== 'closed' && (
              <IconButton
                variant="ghost"
                size="icon-compact"
                aria-label="Bearbeiten"
                title="Bearbeiten"
                disabled={mutation.isPending}
                onClick={() => onEdit(target)}
              >
                <Pencil aria-hidden="true" />
              </IconButton>
            )}
            {target.status === 'draft' && (
              <IconButton
                size="icon-compact"
                aria-label="Ziel festlegen"
                title="Ziel festlegen"
                disabled={mutation.isPending}
                onClick={() => setAction('activate')}
              >
                <Check aria-hidden="true" />
              </IconButton>
            )}
            {target.status === 'active' && (
              <IconButton
                size="icon-compact"
                aria-label={target.dateFrom ? 'Ziel abschließen' : 'Jahr abschließen'}
                title={
                  targetCanClose(target)
                    ? 'Ziel abschließen'
                    : `Abschluss nach dem ${dateLabel(targetPeriod(target).to)} möglich`
                }
                disabled={mutation.isPending || !targetCanClose(target)}
                onClick={() => setAction('close')}
              >
                <Archive aria-hidden="true" />
              </IconButton>
            )}
            {target.status === 'closed' && (
              <IconButton
                variant="ghost"
                size="icon-compact"
                aria-label="Wieder öffnen"
                title="Wieder öffnen"
                disabled={mutation.isPending}
                onClick={() => setAction('reopen')}
              >
                <RotateCcw aria-hidden="true" />
              </IconButton>
            )}
            {!target.scope.activityId && Number(targetPeriod(target).to.slice(0, 4)) < 2200 && (
              <IconButton
                variant="ghost"
                size="icon-compact"
                aria-label={`Für ${target.year + 1} übernehmen`}
                title={`Für ${target.year + 1} übernehmen`}
                disabled={mutation.isPending}
                onClick={() => setAction('copy')}
              >
                <Copy aria-hidden="true" />
              </IconButton>
            )}
          </div>
        ) : undefined
      }
    >
      {query.isPending ? (
        <p>Lädt …</p>
      ) : query.isError ? (
        <p role="alert">{targetError(query.error)}</p>
      ) : (
        target && (
          <div className="space-y-6">
            <div className="annual-target-detail-summary">
              <p className="mb-4 text-sm text-[var(--text-secondary)]">
                {targetPeriodLabel(target)} · {targetStatuses[target.status]} ·{' '}
                {targetScopeLabel(target)}
              </p>
              <TargetProgress target={target} goalFirst />
              <p className="mt-4 text-sm font-medium">{targetDifference(target)}</p>
            </div>
            {copied && (
              <p role="status">
                Entwurf für {copied} angelegt.{' '}
                <Link
                  to={`/statistics/targets?year=${copied}`}
                  onClick={onClose}
                  className="underline"
                >
                  Zum Folgejahr
                </Link>
              </p>
            )}
            {action && isAdmin && (
              <form
                onSubmit={execute}
                className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4"
              >
                <h3 className="font-medium">{actionLabel[action]}</h3>
                <p className="text-sm">
                  {action === 'close'
                    ? 'Die Werte des Zielzeitraums werden mit deiner Einordnung als Abschlussstand gespeichert.'
                    : action === 'reopen'
                      ? 'Der bisherige Abschluss bleibt im Änderungsverlauf erhalten. Nach Korrekturen kannst du das Ziel erneut abschließen.'
                      : action === 'copy'
                        ? `Das Ziel wird als neuer Entwurf für ${target.year + 1} angelegt.`
                        : 'Das Ziel wird für die Einrichtung verbindlich festgelegt. Spätere Änderungen benötigen eine Begründung.'}
                </p>
                {action !== 'copy' && (
                  <FieldLabel>
                    {action === 'close' ? 'Fachliche Einordnung' : 'Begründung'}
                    <Textarea
                      rows={3}
                      required={action !== 'activate'}
                      value={reason}
                      maxLength={4000}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </FieldLabel>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={mutation.isPending}
                    onClick={() => setAction(null)}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {actionLabel[action]}
                  </Button>
                </div>
              </form>
            )}
            {mutation.isError && <p role="alert">{targetError(mutation.error)}</p>}
            {target.description && (
              <div>
                <h3 className="font-semibold">Begründung / Verantwortung</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{target.description}</p>
              </div>
            )}
            {target.review && (
              <div>
                <h3 className="font-semibold">Fachliche Einordnung des Jahresabschlusses</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{target.review}</p>
              </div>
            )}
            {target.dataChanged && (
              <div className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-sm">
                <strong>Daten seit dem Abschluss geändert.</strong>
                <p>
                  Gespeicherter Abschluss: {formatTargetValue(target.result.value, target.metric)} ·
                  Aktuell berechnet: {formatTargetValue(target.current.value, target.metric)}. Für
                  einen korrigierten Abschluss kann ein Admin das Ziel begründet wieder öffnen.
                </p>
              </div>
            )}
            <div className="rounded-xl bg-[var(--surface-2)] p-4 text-sm">
              <h3 className="font-semibold">Berechnungsgrundlage</h3>
              <p className="mt-2">
                {targetMetrics[target.metric]} · {targetScopeLabel(target)} ·{' '}
                {targetPeriod(target).from > target.result.asOf
                  ? `Auswertung ab ${dateLabel(targetPeriod(target).from)}`
                  : `${dateLabel(targetPeriod(target).from)} bis ${dateLabel(target.result.asOf)}`}{' '}
                · {target.result.activityCount} durchgeführte Aktivitäten.
              </p>
              <p className="mt-2">
                {target.metric === 'duration_hours'
                  ? 'Summe der Angebotsdauer in Stunden; keine Personalstunden.'
                  : target.metric === 'participant_total'
                    ? 'Summe der Besuche. Wiederkehrende Personen zählen bei jedem Besuch erneut.'
                    : target.metric === 'activity_count'
                      ? 'Anzahl der durchgeführten Aktivitäten. Ausgefallene Termine werden ausgeschlossen.'
                      : 'Summe der Besuche des gewählten Geschlechts ÷ Summe aller Besuche mit Geschlechtszuordnung × 100. Es wird kein Durchschnitt einzelner Prozentwerte gebildet.'}
              </p>
              <p className="mt-2">
                Ein Zwischenstand ist keine Prognose. Der Abschluss ist nach dem{' '}
                {dateLabel(targetPeriod(target).to)} möglich.
              </p>
            </div>
            <div>
              <h3 className="mb-3 font-semibold">
                Monatswerte{target.status === 'closed' ? ' zum Abschluss' : ''}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {targetMonths(target).map((month) => {
                  const row = target.result.series.find((entry) => entry.month === month);
                  const future =
                    month > target.result.asOf.slice(0, 7) ||
                    targetPeriod(target).from > target.result.asOf;
                  return (
                    <div
                      className="rounded-xl border border-[var(--border-subtle)] p-3"
                      key={month}
                    >
                      <p className="text-xs text-[var(--text-secondary)]">
                        {new Date(`${month}-01T12:00:00`).toLocaleDateString('de-DE', {
                          month: 'long',
                          ...(targetPeriod(target).from.slice(0, 4) !==
                          targetPeriod(target).to.slice(0, 4)
                            ? { year: 'numeric' as const }
                            : {}),
                        })}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {future
                          ? 'Ausstehend'
                          : formatTargetValue(
                              row?.value ?? (target.metric.endsWith('_percent') ? null : 0),
                              target.metric,
                            )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <details
              className="annual-target-disclosure"
              onToggle={(event) => setActivitiesExpanded(event.currentTarget.open)}
            >
              <summary>
                <span>
                  Zugehörige Aktivitäten{' '}
                  <span className="annual-target-disclosure-count">
                    {target.current.activityCount}
                  </span>
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              {activitiesExpanded && (
                <div className="annual-target-disclosure-content">
                  <AnnualTargetActivities key={id} id={id} />
                </div>
              )}
            </details>
            <details className="annual-target-disclosure">
              <summary>
                <span>
                  Änderungsverlauf{' '}
                  <span className="annual-target-disclosure-count">
                    {target.history?.length ?? 0}
                  </span>
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <ol className="annual-target-disclosure-content space-y-3">
                {target.history
                  ?.slice()
                  .reverse()
                  .map((entry, index) => (
                    <li
                      key={`${entry.at}-${index}`}
                      className="rounded-xl border border-[var(--border-subtle)] p-3 text-sm"
                    >
                      <p className="font-medium">{entry.reason}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {new Date(entry.at).toLocaleString('de-DE')} · {entry.actorName || 'Admin'}
                      </p>
                      <p className="mt-2">
                        {entry.definition.title} · {entry.definition.year} ·{' '}
                        {targetMetrics[entry.definition.metric]} ·{' '}
                        {targetRequirement(entry.definition)} ·{' '}
                        {targetStatuses[entry.definition.status]}
                      </p>
                      <p className="mt-1 text-xs">
                        Zeitraum: {targetPeriodLabel(entry.definition)}
                      </p>
                      <p className="mt-1 text-xs">
                        Bezug:{' '}
                        {entry.definition.scope.types
                          ?.map((type) => targetTypes[type])
                          .join(', ') ||
                          (entry.definition.scope.projectId
                            ? `Projekt ${entry.definition.scope.projectId}`
                            : entry.definition.scope.activityId
                              ? `Aktivität ${entry.definition.scope.activityId}`
                              : 'Gesamte Einrichtung')}
                      </p>
                      {entry.definition.description && (
                        <p className="mt-1 whitespace-pre-wrap">{entry.definition.description}</p>
                      )}
                      {entry.definition.snapshot && (
                        <p className="mt-1">
                          Abschlusswert:{' '}
                          {formatTargetValue(
                            entry.definition.snapshot.value,
                            entry.definition.metric,
                          )}{' '}
                          · {entry.definition.review}
                        </p>
                      )}
                    </li>
                  ))}
              </ol>
            </details>
          </div>
        )
      )}
    </Modal>
  );
}
