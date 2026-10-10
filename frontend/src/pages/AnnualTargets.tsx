import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Target, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePublicConfig } from '@/lib/publicConfig';
import { useOrgScopeKey } from '@/lib/orgScope';
import { useActiveOrganizationName } from '@/lib/useActiveOrganizationName';
import { type AnnualTarget, type TargetScope, targetYear, targetError, useAnnualTargets } from '@/lib/annualTargets';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, FieldLabel } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatisticsTabs, AnnualTargetCard } from '@/components/AnnualTargetCards';
import { TargetEditor, TargetDetail } from '@/components/AnnualTargetDialogs';

const statusFilters = [
  { status: 'all', label: 'Alle Jahresziele' },
  { status: 'draft', label: 'Entwürfe' },
  { status: 'active', label: 'Festgelegt' },
  { status: 'closed', label: 'Abgeschlossen' },
] as const;

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
  const statusFilter =
    statusFilters.find((filter) => filter.status === params.get('status'))?.status ?? 'all';
  const visibleTargets = targets.filter(
    (target) => statusFilter === 'all' || target.status === statusFilter,
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
      await exportAnnualTargets(visibleTargets, year, organization ?? 'Ohne Einrichtung', format);
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
            disabled={exporting || !visibleTargets.length}
            onClick={() => void exportReport('xlsx')}
          >
            <Download />
            Excel
          </Button>
          <Button
            variant="secondary"
            disabled={exporting || !visibleTargets.length}
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
      ) : (
        <section aria-label="Jahresziele im Überblick" className="space-y-4">
          <div
            role="group"
            aria-label="Jahresziele nach Status filtern"
            className="annual-target-overview"
          >
            {statusFilters.map(({ status, label }) => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? 'primary' : 'secondary'}
                className="annual-target-status-filter"
                aria-pressed={statusFilter === status}
                onClick={() =>
                  setParam(
                    'status',
                    status === 'all' || statusFilter === status ? undefined : status,
                  )
                }
              >
                {label}{' '}
                <span className="tabular-nums">
                  {status === 'all'
                    ? targets.length
                    : targets.filter((target) => target.status === status).length}
                </span>
              </Button>
            ))}
          </div>
          {visibleTargets.length === 0 ? (
            <div className="modern-card p-8 text-center">
              <Target className="mx-auto mb-3 h-8 w-8 text-viridian" />
              <h2 className="text-lg font-semibold">
                {targets.length === 0
                  ? `Noch keine Jahresziele für ${year}`
                  : 'Keine Jahresziele mit diesem Status'}
              </h2>
              {targets.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Lege Vorgaben für Stunden, Besuche, Aktivitäten oder Genderanteile fest. Die
                  Istwerte berechnet Stato aus der Dokumentation.
                </p>
              ) : (
                <Button variant="secondary" className="mt-3" onClick={() => setParam('status')}>
                  Alle Jahresziele anzeigen
                </Button>
              )}
            </div>
          ) : (
            <div className="annual-target-grid">
              {visibleTargets.map((target) => (
                <AnnualTargetCard
                  key={target.id}
                  target={target}
                  onOpen={() => setParam('target', target.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}
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
