import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './SecurityArchitectureEmbed.css';
import { Button } from '@/components/ui/Button';
import {
  ArchiveRestore,
  Clock3,
  Database,
  Globe2,
  HardDrive,
  LockKeyhole,
  Mail,
  PanelsTopLeft,
  ServerCog,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

type DeploymentMode = 'onprem' | 'mittwald';
type NodeTone = 'public' | 'edge' | 'app' | 'data' | 'backup' | 'external';
type IconName = 'client' | 'edge' | 'frontend' | 'backend' | 'database' | 'storage' | 'mail' | 'backup' | 'cron';

type ComponentNodeData = {
  kind: 'component';
  label: string;
  eyebrow: string;
  summary: string;
  controls: string[];
  responsibility: string;
  tone: NodeTone;
  icon: IconName;
};

type ZoneNodeData = {
  kind: 'zone';
  label: string;
  caption: string;
  tone: NodeTone;
};

type ArchitectureNodeData = ComponentNodeData | ZoneNodeData;
type ArchitectureNode = Node<ArchitectureNodeData, 'security-architecture'>;
type ArchitectureEdgeData = { tone: 'encrypted' | 'internal' | 'external' | 'backup' };
type ArchitectureEdge = Edge<ArchitectureEdgeData, 'security-flow'>;

const iconByName: Record<IconName, LucideIcon> = {
  client: Globe2,
  edge: ShieldCheck,
  frontend: PanelsTopLeft,
  backend: ServerCog,
  database: Database,
  storage: HardDrive,
  mail: Mail,
  backup: ArchiveRestore,
  cron: Clock3,
};

const edgeColors: Record<ArchitectureEdgeData['tone'], string> = {
  encrypted: '#5b6cff',
  internal: '#8494ff',
  external: '#df7eb5',
  backup: '#4faea4',
};

const zone = (
  id: string,
  label: string,
  caption: string,
  tone: NodeTone,
  x: number,
  width: number,
): ArchitectureNode => ({
  id,
  type: 'security-architecture',
  position: { x, y: 32 },
  data: { kind: 'zone', label, caption, tone },
  style: { width, height: 500 },
  selectable: false,
  focusable: false,
  draggable: false,
  zIndex: -1,
});

const component = (
  id: string,
  position: { x: number; y: number },
  data: Omit<ComponentNodeData, 'kind'>,
): ArchitectureNode => ({
  id,
  type: 'security-architecture',
  position,
  data: { kind: 'component', ...data },
  zIndex: 2,
});

const flow = (
  id: string,
  source: string,
  target: string,
  label: string,
  tone: ArchitectureEdgeData['tone'],
  dashed = false,
): ArchitectureEdge => ({
  id,
  source,
  target,
  type: 'security-flow',
  label,
  data: { tone },
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: edgeColors[tone] },
  style: {
    stroke: edgeColors[tone],
    strokeWidth: 2,
    strokeDasharray: dashed ? '7 6' : undefined,
  },
});

const commonComponents = {
  client: component('client', { x: 22, y: 150 }, {
    label: 'Browser der Fachkraft',
    eyebrow: 'Öffentlicher Einstieg',
    summary: 'Nutzende greifen ausschließlich über die veröffentlichte Webadresse auf StatO zu.',
    controls: ['TLS-gesicherte Verbindung', 'Keine direkte Datenbankverbindung', 'Sitzungsgebundene Anmeldung'],
    responsibility: 'Endgerät und Browser liegen in der Verantwortung der nutzenden Organisation.',
    tone: 'public',
    icon: 'client',
  }),
  frontend: component('frontend', { x: 575, y: 120 }, {
    label: 'Frontend',
    eyebrow: 'React · Nginx',
    summary: 'Liefert die Weboberfläche aus und leitet API-Aufrufe im privaten Netz an das Backend weiter.',
    controls: ['Unprivilegierter Container', 'Read-only-Dateisystem', 'CSP und weitere Browser-Header', 'Keine fachlichen Secrets im Browser'],
    responsibility: 'StatO-Anwendung und betreibende Organisation.',
    tone: 'app',
    icon: 'frontend',
  }),
  backend: component('backend', { x: 815, y: 220 }, {
    label: 'Backend',
    eyebrow: 'NestJS · REST API',
    summary: 'Zentrale Sicherheits- und Fachlogik für Authentifizierung, Berechtigungen und Datenzugriffe.',
    controls: ['JWT-Zugriff und sichere Refresh-Cookies', 'Rollen- und Organisationsprüfung', 'Validierung aller Eingaben', 'Rate-Limits und Login-Sperren', 'Audit-Protokollierung'],
    responsibility: 'StatO-Anwendung; Betriebssecrets werden durch den jeweiligen Betreiber verwaltet.',
    tone: 'app',
    icon: 'backend',
  }),
  database: component('database', { x: 1095, y: 100 }, {
    label: 'PostgreSQL',
    eyebrow: 'Strukturierte Fachdaten',
    summary: 'Speichert Benutzer-, Organisations-, Statistik- und Konfigurationsdaten.',
    controls: ['Nur aus dem Backend-Netz erreichbar', 'Eigenes Datenbankkonto', 'Persistentes Volume', 'Migrationen statt Schema-Synchronisierung'],
    responsibility: 'Betrieb, Sicherung und Aufbewahrung liegen beim jeweiligen Betreiber.',
    tone: 'data',
    icon: 'database',
  }),
  uploads: component('uploads', { x: 1095, y: 258 }, {
    label: 'Dateispeicher',
    eyebrow: 'Geschütztes Volume',
    summary: 'Persistiert hochgeladene Dokumente und Bilder außerhalb des unveränderlichen Anwendungscontainers.',
    controls: ['Kein direkter öffentlicher Volume-Zugriff', 'Auslieferung über kontrollierte Anwendungspfade', 'Read-only-Zugriff für Backups'],
    responsibility: 'Speicherort und Aufbewahrung werden durch den Betreiber festgelegt.',
    tone: 'data',
    icon: 'storage',
  }),
  mail: component('mail', { x: 22, y: 340 }, {
    label: 'SMTP-Dienst',
    eyebrow: 'Externer Dienst · optional',
    summary: 'Versendet Einladungen, Passwort-Reset- und optional Zwei-Faktor-Nachrichten.',
    controls: ['Zugangsdaten nur im Backend', 'TLS je nach Mailanbieter', 'Keine direkte Verbindung zum Frontend'],
    responsibility: 'Auswahl und Datenschutzprüfung des Mailanbieters liegen beim Betreiber.',
    tone: 'external',
    icon: 'mail',
  }),
};

const deployments: Record<DeploymentMode, { title: string; subtitle: string; nodes: ArchitectureNode[]; edges: ArchitectureEdge[]; note: string }> = {
  onprem: {
    title: 'StatO On-Premises',
    subtitle: 'Betrieb in der Infrastruktur der eigenen Organisation',
    note: 'Datenbank, Uploads und Backups verbleiben in der vom Betreiber kontrollierten Infrastruktur.',
    nodes: [
      zone('zone-public', 'Nutzende & externe Dienste', 'Außerhalb der StatO-Infrastruktur', 'public', 0, 255),
      zone('zone-edge', 'Zugangszone', 'Kontrollierter Netzübergang', 'edge', 275, 260),
      zone('zone-app', 'Anwendungszone', 'Isolierte Container-Netze', 'app', 555, 500),
      zone('zone-data', 'Daten & Sicherung', 'Persistente Betreiber-Infrastruktur', 'data', 1075, 430),
      commonComponents.client,
      commonComponents.mail,
      component('edge', { x: 293, y: 205 }, {
        label: 'Caddy / Reverse Proxy',
        eyebrow: 'Optionaler HTTPS-Einstieg',
        summary: 'Terminiert TLS und veröffentlicht ausschließlich den vorgesehenen StatO-Zugang.',
        controls: ['HTTPS-Zertifikat', 'Definierter öffentlicher Port', 'Weiterleitung nur zum Frontend', 'Interner Backend-Port bleibt geschlossen'],
        responsibility: 'Konfiguration, Zertifikate und Netzwerkfreigaben liegen beim On-Prem-Betreiber.',
        tone: 'edge',
        icon: 'edge',
      }),
      commonComponents.frontend,
      commonComponents.backend,
      commonComponents.database,
      commonComponents.uploads,
      component('backup', { x: 1260, y: 378 }, {
        label: 'Betriebsbackup',
        eyebrow: 'Getrennte Aufbewahrung',
        summary: 'Erstellt konsistente Sicherungen von Datenbank und Uploads für die Wiederherstellung.',
        controls: ['Uploads nur read-only eingebunden', 'Keine Docker-Socket-Berechtigung', 'Aufbewahrungsfrist konfigurierbar', 'Externe verschlüsselte Kopie empfohlen'],
        responsibility: 'Zeitplan, Verschlüsselung, externe Ablage und Restore-Tests liegen beim Betreiber.',
        tone: 'backup',
        icon: 'backup',
      }),
    ],
    edges: [
      flow('client-edge', 'client', 'edge', 'HTTPS', 'encrypted'),
      flow('edge-frontend', 'edge', 'frontend', 'interner Webzugang', 'internal'),
      flow('frontend-backend', 'frontend', 'backend', 'REST API · privates Netz', 'internal'),
      flow('backend-db', 'backend', 'database', 'SQL · privates Netz', 'internal'),
      flow('backend-files', 'backend', 'uploads', 'Dateizugriff', 'internal'),
      flow('backend-mail', 'backend', 'mail', 'SMTP / TLS', 'external'),
      flow('db-backup', 'database', 'backup', 'Sicherung', 'backup', true),
      flow('files-backup', 'uploads', 'backup', 'read-only', 'backup', true),
    ],
  },
  mittwald: {
    title: 'StatO bei Mittwald',
    subtitle: 'Aktueller Off-Premises-Betrieb als isolierter Container-Stack',
    note: 'Mittwald stellt die Plattform bereit; StatO trennt Webzugang, Anwendung, Datenhaltung und Backup logisch im Stack.',
    nodes: [
      zone('zone-public', 'Internet & externe Dienste', 'Öffentliches Netz', 'public', 0, 255),
      zone('zone-edge', 'Mittwald Edge', 'Domain- und TLS-Zugang', 'edge', 275, 260),
      zone('zone-app', 'Privater StatO-Stack', 'Frontend- und Backend-Netz', 'app', 555, 500),
      zone('zone-data', 'Persistente Volumes', 'Daten- und Backup-Ebene', 'data', 1075, 430),
      commonComponents.client,
      commonComponents.mail,
      component('edge', { x: 293, y: 205 }, {
        label: 'Mittwald Domain & TLS',
        eyebrow: 'Öffentlicher Plattformzugang',
        summary: 'Ordnet die öffentliche Domain dem Frontend zu und stellt den verschlüsselten Webzugang bereit.',
        controls: ['TLS am öffentlichen Einstieg', 'Nur Frontend-Port veröffentlicht', 'Backend und Datenbank ohne öffentliche Route'],
        responsibility: 'Plattformbetrieb bei Mittwald; Domainzuordnung und StatO-Konfiguration durch den Betreiber.',
        tone: 'edge',
        icon: 'edge',
      }),
      commonComponents.frontend,
      commonComponents.backend,
      commonComponents.database,
      commonComponents.uploads,
      component('cron', { x: 810, y: 392 }, {
        label: 'Mittwald Cronjob',
        eyebrow: 'Zeitgesteuerter Auftrag',
        summary: 'Startet den vorgesehenen Backup-Befehl im dedizierten Backup-Container.',
        controls: ['Kein öffentlicher Port', 'Fest definierter Befehl', 'Separater Ausführungszeitplan'],
        responsibility: 'Einrichtung und Überwachung des Zeitplans durch den Betreiber im mStudio.',
        tone: 'backup',
        icon: 'cron',
      }),
      component('backup', { x: 1260, y: 378 }, {
        label: 'Backup-Volume',
        eyebrow: 'Persistente Sicherungen',
        summary: 'Nimmt konsistente Datenbank- und Upload-Sicherungen aus dem Backup-Container auf.',
        controls: ['Uploads nur read-only eingebunden', 'Kein Docker-Socket', 'Konfigurierbare Aufbewahrungsfrist', 'Zusätzliche externe Sicherung empfohlen'],
        responsibility: 'Volume-Sicherung, externe Aufbewahrung und Restore-Tests liegen beim Betreiber.',
        tone: 'backup',
        icon: 'backup',
      }),
    ],
    edges: [
      flow('client-edge', 'client', 'edge', 'HTTPS', 'encrypted'),
      flow('edge-frontend', 'edge', 'frontend', 'HTTPS-Routing', 'encrypted'),
      flow('frontend-backend', 'frontend', 'backend', 'REST API · privates Netz', 'internal'),
      flow('backend-db', 'backend', 'database', 'SQL · internes Netz', 'internal'),
      flow('backend-files', 'backend', 'uploads', 'Dateizugriff', 'internal'),
      flow('backend-mail', 'backend', 'mail', 'SMTP / TLS', 'external'),
      flow('cron-backup', 'cron', 'backup', 'geplanter Lauf', 'backup', true),
      flow('db-backup', 'database', 'backup', 'Sicherung', 'backup', true),
      flow('files-backup', 'uploads', 'backup', 'read-only', 'backup', true),
    ],
  },
};

function SecurityArchitectureNode({ data, selected }: NodeProps<ArchitectureNode>) {
  if (data.kind === 'zone') {
    return (
      <div className="security-arch-zone" data-tone={data.tone}>
        <div className="security-arch-zone__label">{data.label}</div>
        <div className="security-arch-zone__caption">{data.caption}</div>
      </div>
    );
  }

  const Icon = iconByName[data.icon];
  return (
    <div className={`security-arch-node${selected ? ' security-arch-node--selected' : ''}`} data-tone={data.tone}>
      <Handle type="target" position={Position.Left} className="security-arch-handle" />
      <div className="security-arch-node__icon"><Icon aria-hidden="true" /></div>
      <div className="security-arch-node__copy">
        <div className="security-arch-node__eyebrow">{data.eyebrow}</div>
        <div className="security-arch-node__label">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Right} className="security-arch-handle" />
    </div>
  );
}

function SecurityFlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, label, data }: EdgeProps<ArchitectureEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 18,
    offset: 28,
  });

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="security-arch-edge-label nodrag nopan"
            data-tone={data?.tone}
            style={{ position: 'absolute', zIndex: 12, transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 14}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { 'security-architecture': SecurityArchitectureNode };
const edgeTypes = { 'security-flow': SecurityFlowEdge };

function initialMode(): DeploymentMode {
  return new URLSearchParams(window.location.search).get('deployment') === 'onprem' ? 'onprem' : 'mittwald';
}

export default function SecurityArchitectureEmbed() {
  const [mode, setMode] = useState<DeploymentMode>(initialMode);
  const [selectedId, setSelectedId] = useState('frontend');
  const deployment = deployments[mode];
  const selected = useMemo(
    () => deployment.nodes.find((node) => node.id === selectedId && node.data.kind === 'component')?.data as ComponentNodeData | undefined,
    [deployment.nodes, selectedId],
  );
  const renderedNodes = useMemo(
    () => deployment.nodes.map((node) => ({ ...node, selected: node.data.kind === 'component' && node.id === selectedId })),
    [deployment.nodes, selectedId],
  );
  const renderedEdges = useMemo(
    () => deployment.edges.map((edge) => {
      const isRelatedToSelection = edge.source === selectedId || edge.target === selectedId;
      return {
        ...edge,
        label: isRelatedToSelection ? edge.label : undefined,
        style: { ...edge.style, opacity: isRelatedToSelection ? 1 : 0.46 },
      };
    }),
    [deployment.edges, selectedId],
  );

  useEffect(() => {
    document.title = `${deployment.title} – Sicherheitsarchitektur`;
  }, [deployment.title]);

  const selectMode = (nextMode: DeploymentMode) => {
    setMode(nextMode);
    const url = new URL(window.location.href);
    url.searchParams.set('deployment', nextMode);
    window.history.replaceState({}, '', url);
  };

  return (
    <main className="security-arch-page">
      <header className="security-arch-header">
        <div>
          <div className="security-arch-brand"><LockKeyhole aria-hidden="true" /> StatO Sicherheitsarchitektur</div>
          <h1>{deployment.title}</h1>
          <p>{deployment.subtitle}</p>
        </div>
        <div className="security-arch-switch" role="group" aria-label="Betriebsmodell auswählen">
          <Button variant="ghost" size="sm" aria-pressed={mode === 'mittwald'} onClick={() => selectMode('mittwald')}>Mittwald</Button>
          <Button variant="ghost" size="sm" aria-pressed={mode === 'onprem'} onClick={() => selectMode('onprem')}>On-Premises</Button>
        </div>
      </header>

      <section className="security-arch-canvas" aria-label={`${deployment.title}: interaktives Sicherheitsdiagramm`}>
        <ReactFlow
          key={mode}
          nodes={renderedNodes}
          edges={renderedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_event, node) => { if (node.data.kind === 'component') setSelectedId(node.id); }}
          fitView
          fitViewOptions={{ padding: 0.04, minZoom: 0.45, maxZoom: 1 }}
          minZoom={0.38}
          maxZoom={1.4}
          nodesDraggable={false}
          nodesConnectable={false}
          elevateNodesOnSelect={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={22} size={1} color="rgba(91, 108, 255, 0.16)" />
          <Controls position="bottom-left" style={{ bottom: 66 }} showInteractive={false} />
          <Panel position="bottom-left" className="security-arch-legend">
            <span><i data-tone="encrypted" />verschlüsselt</span>
            <span><i data-tone="internal" />intern</span>
            <span><i data-tone="external" />externer Dienst</span>
            <span><i data-tone="backup" />Sicherung</span>
          </Panel>
          {selected && (
            <Panel position="top-right" className="security-arch-detail">
              <div className="security-arch-detail__eyebrow">{selected.eyebrow}</div>
              <h2>{selected.label}</h2>
              <p>{selected.summary}</p>
              <h3>Schutzmaßnahmen</h3>
              <ul>{selected.controls.map((control) => <li key={control}>{control}</li>)}</ul>
              <div className="security-arch-detail__responsibility"><strong>Verantwortung:</strong> {selected.responsibility}</div>
            </Panel>
          )}
        </ReactFlow>
      </section>

      <footer className="security-arch-footer">
        <span>{deployment.note}</span>
        <span>Vereinfachte Architekturdarstellung · Stand August 2026</span>
      </footer>
    </main>
  );
}
