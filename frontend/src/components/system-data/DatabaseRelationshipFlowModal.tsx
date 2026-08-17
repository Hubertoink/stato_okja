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
import '@/styles/processes.css';
import { ArrowRight, Database, GitFork, Link2, TableProperties } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/Button';
import {
  type DatabaseExplorerRelation,
  type DatabaseExplorerTable,
} from '@/lib/systemData';

type RelationshipNodeData = {
  table: DatabaseExplorerTable;
  outgoing: DatabaseExplorerRelation[];
  incoming: DatabaseExplorerRelation[];
  selected: boolean;
  related: boolean;
  dimmed: boolean;
};

type RelationshipNode = Node<RelationshipNodeData, 'database-table'>;
type RelationshipEdgeData = { flowing: boolean };
type RelationshipFlowEdge = Edge<RelationshipEdgeData>;
type PositionedTable = { id: string; position: { x: number; y: number } };

function relationIdentity(relation: DatabaseExplorerRelation) {
  return `${relation.sourceTable}:${relation.sourceColumn}:${relation.targetTable}:${relation.targetColumn}`;
}

function relationHandleId(type: 'source' | 'target', relation: DatabaseExplorerRelation) {
  return `${type}:${relationIdentity(relation)}`;
}

function relationHandleOffset(index: number, count: number) {
  if (count <= 1) return '50%';
  return `${24 + (index / (count - 1)) * 52}%`;
}

function DatabaseTableNode({ data }: NodeProps<RelationshipNode>) {
  const { table, outgoing, incoming, selected, related, dimmed } = data;
  const shownRelations = [...outgoing, ...incoming].slice(0, 3);
  const remainingRelations = outgoing.length + incoming.length - shownRelations.length;

  return (
    <div
      className={`min-w-60 overflow-hidden rounded-xl border text-left shadow-lg transition ${selected
        ? 'border-[var(--interactive-soft-border)] ring-2 ring-[var(--focus-ring)]'
        : related
          ? 'border-[var(--interactive-soft-border)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--interactive-soft-border)]'
      } ${dimmed ? 'opacity-35 grayscale-[0.2]' : ''
      } bg-[var(--surface-elevated)]`}
    >
      {incoming.map((relation, index) => (
        <Handle
          key={relationHandleId('target', relation)}
          id={relationHandleId('target', relation)}
          type="target"
          position={Position.Left}
          style={{ top: relationHandleOffset(index, incoming.length) }}
          className="!h-2.5 !w-2.5 !border-0 !bg-[var(--interactive-text)]"
        />
      ))}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5">
        <TableProperties className="h-4 w-4 shrink-0 text-[var(--interactive-text)]" />
        <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{table.key}</span>
      </div>
      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{table.rowCount.toLocaleString()} Datensätze</span>
          <span>{table.columns.filter((column) => !column.hidden).length} Spalten</span>
        </div>
        {shownRelations.length > 0 && (
          <div className="space-y-1 border-t border-[var(--border-subtle)] pt-2 text-xs text-[var(--text-secondary)]">
            {shownRelations.map((relation) => {
              const providesData = relation.targetTable === table.key;
              return (
                <div key={relationIdentity(relation)} className="flex items-center gap-1.5 truncate">
                  <Link2 className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate">{providesData
                    ? `${relation.targetColumn} → ${relation.sourceTable}.${relation.sourceColumn}`
                    : `${relation.targetTable}.${relation.targetColumn} → ${relation.sourceColumn}`
                  }</span>
                </div>
              );
            })}
            {remainingRelations > 0 && <div className="text-[var(--text-muted)]">+{remainingRelations} weitere</div>}
          </div>
        )}
      </div>
      {outgoing.map((relation, index) => (
        <Handle
          key={relationHandleId('source', relation)}
          id={relationHandleId('source', relation)}
          type="source"
          position={Position.Right}
          style={{ top: relationHandleOffset(index, outgoing.length) }}
          className="!h-2.5 !w-2.5 !border-0 !bg-[var(--interactive-text)]"
        />
      ))}
    </div>
  );
}

const relationshipNodeTypes = { 'database-table': DatabaseTableNode };

function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  label,
  markerEnd,
  style,
  data,
}: EdgeProps<RelationshipFlowEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 24,
    offset: 32,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {data?.flowing && (
        <circle
          className="database-relation-flow-dot"
          r="5.5"
          style={{ fill: 'var(--process-canvas-edge-selected)', stroke: 'var(--process-canvas-bg)' }}
        >
          <animateMotion dur="1.35s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {label && (
        <EdgeLabelRenderer>
          <div
            className="process-o-edge-label nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 17}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function SelfReferenceEdge({ id, sourceX, sourceY, targetX, targetY, label, markerEnd, style, data }: EdgeProps<RelationshipFlowEdge>) {
  const loopX = Math.max(sourceX, targetX) + 82;
  const loopTop = Math.min(sourceY, targetY) - 66;
  const path = `M ${sourceX},${sourceY} C ${loopX},${sourceY} ${loopX},${loopTop} ${loopX - 22},${loopTop} C ${targetX - 86},${loopTop} ${targetX - 58},${targetY} ${targetX},${targetY}`;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {data?.flowing && (
        <circle
          className="database-relation-flow-dot"
          r="5.5"
          style={{ fill: 'var(--process-canvas-edge-selected)', stroke: 'var(--process-canvas-bg)' }}
        >
          <animateMotion dur="1.35s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      {label && (
        <EdgeLabelRenderer>
          <div
            className="process-o-edge-label nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${loopX - 22}px,${loopTop - 8}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const relationshipEdgeTypes = {
  'database-relation': RelationshipEdge,
  'self-reference': SelfReferenceEdge,
};

type ElkConstructor = typeof import('elkjs/lib/elk.bundled.js').default;
let elkConstructorPromise: Promise<ElkConstructor> | null = null;

function loadElkConstructor() {
  if (!elkConstructorPromise) {
    elkConstructorPromise = import('elkjs/lib/elk.bundled.js').then((module) => module.default);
  }
  return elkConstructorPromise;
}

async function layoutNodes(tables: DatabaseExplorerTable[], relations: DatabaseExplorerRelation[]) {
  const Elk = await loadElkConstructor();
  const elk = new Elk();
  const layout = await elk.layout({
    id: 'database-relationships',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'SPLINES',
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '116',
      'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
    },
    children: tables.map((table) => ({ id: table.key, width: 240, height: 128 })),
    // Foreign keys point from the consuming table to the referenced table.
    // Reverse that technical direction here so the diagram reads as data flow:
    // provider → consumer.
    edges: relations.map((relation) => ({ id: relation.id, sources: [relation.targetTable], targets: [relation.sourceTable] })),
  });
  const positions = new Map((layout.children || []).map((node) => [node.id, node]));
  return tables.map((table, index) => {
    const position = positions.get(table.key);
    return { id: table.key, position: position ? { x: position.x || 0, y: position.y || 0 } : { x: (index % 4) * 300, y: Math.floor(index / 4) * 180 } };
  });
}

function getRelations(tables: DatabaseExplorerTable[], relations: DatabaseExplorerRelation[]) {
  const known = new Set<string>();
  const available = new Set(tables.map((table) => table.key));
  const add = (relation: DatabaseExplorerRelation) => {
    if (!available.has(relation.sourceTable) || !available.has(relation.targetTable)) return;
    known.add(`${relation.sourceTable}:${relation.sourceColumn}:${relation.targetTable}:${relation.targetColumn}`);
  };
  relations.forEach(add);
  tables.forEach((table) => table.columns.forEach((column) => {
    if (!column.reference) return;
    add({
      id: `${table.key}-${column.name}-${column.reference.tableKey}`,
      sourceTable: table.key,
      sourceColumn: column.name,
      targetTable: column.reference.tableKey,
      targetColumn: column.reference.column,
    });
  }));

  const source = [...relations, ...tables.flatMap((table) => table.columns.flatMap((column) => column.reference ? [{
    id: `${table.key}-${column.name}-${column.reference.tableKey}`,
    sourceTable: table.key,
    sourceColumn: column.name,
    targetTable: column.reference.tableKey,
    targetColumn: column.reference.column,
  }] : []))];
  const result = new Map<string, DatabaseExplorerRelation>();
  source.forEach((relation) => {
    const key = `${relation.sourceTable}:${relation.sourceColumn}:${relation.targetTable}:${relation.targetColumn}`;
    if (known.has(key)) result.set(key, relation);
  });
  return [...result.values()];
}

function RelationshipGroup({
  title,
  relations,
  format,
  onSelect,
}: {
  title: string;
  relations: DatabaseExplorerRelation[];
  format: (relation: DatabaseExplorerRelation) => string;
  onSelect: (relation: DatabaseExplorerRelation) => void;
}) {
  if (!relations.length) return null;
  return (
    <section>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</div>
      <div className="space-y-1.5">
        {relations.map((relation) => (
          <Button
            key={relation.id}
            variant="ghost"
            size="sm"
            onClick={() => onSelect(relation)}
            className="block w-full rounded-md bg-[var(--surface-2)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--interactive-soft)] hover:text-[var(--interactive-text)]"
          >
            {format(relation)}
          </Button>
        ))}
      </div>
    </section>
  );
}

function RelationshipOverviewMap({
  positions,
  selectedTableKey,
  onSelect,
}: {
  positions: PositionedTable[];
  selectedTableKey: string | null;
  onSelect: (tableKey: string) => void;
}) {
  const bounds = useMemo(() => {
    if (!positions.length) return null;
    const xValues = positions.map(({ position }) => position.x);
    const yValues = positions.map(({ position }) => position.y);
    return {
      minX: Math.min(...xValues),
      maxX: Math.max(...xValues) + 240,
      minY: Math.min(...yValues),
      maxY: Math.max(...yValues) + 128,
    };
  }, [positions]);

  if (!bounds) return null;
  const mapWidth = 180;
  const mapHeight = 120;
  const innerPadding = 9;
  const scale = Math.min(
    (mapWidth - innerPadding * 2) / Math.max(1, bounds.maxX - bounds.minX),
    (mapHeight - innerPadding * 2) / Math.max(1, bounds.maxY - bounds.minY),
  );

  return (
    <Panel position="bottom-right" className="!m-4 overflow-hidden rounded-xl border border-[var(--process-canvas-control-border)] bg-[var(--process-canvas-minimap-bg)] shadow-lg">
      <svg width={mapWidth} height={mapHeight} viewBox={`0 0 ${mapWidth} ${mapHeight}`} aria-label="Tabellenübersicht">
        {positions.map(({ id, position }) => {
          const x = innerPadding + (position.x - bounds.minX) * scale;
          const y = innerPadding + (position.y - bounds.minY) * scale;
          const selected = id === selectedTableKey;
          return (
            <g key={id} role="button" tabIndex={0} className="cursor-pointer" onClick={() => onSelect(id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(id); }}>
              <title>{id}</title>
              <rect
                x={x}
                y={y}
                width={Math.max(5, 240 * scale)}
                height={Math.max(4, 128 * scale)}
                rx={2}
                fill={selected ? '#a78bfa' : '#6f7d9b'}
                stroke={selected ? '#e9d5ff' : '#d7dfef'}
                strokeWidth={selected ? 1.25 : 0.5}
              />
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}

export default function DatabaseRelationshipFlowModal({
  open,
  onClose,
  tables,
  relations,
}: {
  open: boolean;
  onClose: () => void;
  tables: DatabaseExplorerTable[];
  relations: DatabaseExplorerRelation[];
}) {
  const { t } = useTranslation('common');
  const resolvedRelations = useMemo(() => getRelations(tables, relations), [relations, tables]);
  const [positions, setPositions] = useState<PositionedTable[]>([]);
  const [selectedTableKey, setSelectedTableKey] = useState<string | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [isDarkTheme, setIsDarkTheme] = useState(() => document.documentElement.getAttribute('data-color-mode') === 'dark');

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.getAttribute('data-color-mode') === 'dark');
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-color-mode'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open || !tables.length) return;
    let active = true;
    void layoutNodes(tables, resolvedRelations).then((nextPositions) => {
      if (!active) return;
      setPositions(nextPositions);
      setLayoutVersion((version) => version + 1);
    }).catch(() => {
      if (!active) return;
      setPositions(tables.map((table, index) => ({ id: table.key, position: { x: (index % 4) * 300, y: Math.floor(index / 4) * 180 } })));
      setLayoutVersion((version) => version + 1);
    });
    return () => { active = false; };
  }, [open, resolvedRelations, tables]);

  const selectedTable = tables.find((table) => table.key === selectedTableKey) || null;
  const focusedRelations = useMemo(() => selectedTableKey
    ? resolvedRelations.filter((relation) => relation.sourceTable === selectedTableKey || relation.targetTable === selectedTableKey)
    : [], [resolvedRelations, selectedTableKey]);
  const relatedTableKeys = useMemo(() => new Set(focusedRelations.flatMap((relation) => [relation.sourceTable, relation.targetTable])), [focusedRelations]);
  const nodes = useMemo<RelationshipNode[]>(() => positions.map(({ id, position }) => {
    const table = tables.find((candidate) => candidate.key === id)!;
    return {
      id,
      type: 'database-table',
      position,
      data: {
        table,
        // A referenced table supplies data; a table holding the foreign key
        // receives it. These arrays determine the left/right graph ports.
        outgoing: resolvedRelations.filter((relation) => relation.targetTable === id),
        incoming: resolvedRelations.filter((relation) => relation.sourceTable === id),
        selected: selectedTableKey === id,
        related: relatedTableKeys.has(id),
        dimmed: Boolean(selectedTableKey) && !relatedTableKeys.has(id),
      },
    };
  }), [positions, relatedTableKeys, resolvedRelations, selectedTableKey, tables]);

  const edges = useMemo<RelationshipFlowEdge[]>(() => resolvedRelations.map((relation) => {
    const isFocused = selectedTableKey === relation.sourceTable || selectedTableKey === relation.targetTable;
    return {
      id: relationIdentity(relation),
      source: relation.targetTable,
      target: relation.sourceTable,
      sourceHandle: relationHandleId('source', relation),
      targetHandle: relationHandleId('target', relation),
      type: relation.sourceTable === relation.targetTable ? 'self-reference' : 'database-relation',
      label: isFocused ? `${relation.targetColumn} → ${relation.sourceColumn}` : undefined,
      data: { flowing: Boolean(selectedTableKey && isFocused) },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: isFocused ? 'var(--process-canvas-edge-selected)' : 'var(--process-canvas-edge)',
      },
      className: isFocused ? 'database-relation-edge database-relation-edge--active' : 'database-relation-edge',
      style: selectedTableKey
        ? isFocused
          ? { stroke: 'var(--process-canvas-edge-selected)', strokeWidth: 2.5, opacity: 1 }
          : { stroke: 'var(--process-canvas-edge)', strokeWidth: 1.25, opacity: 0.58 }
        : { stroke: 'var(--process-canvas-edge)', strokeWidth: 1.5 },
    };
  }), [resolvedRelations, selectedTableKey]);

  return (
    <Modal open={open} onClose={onClose} title={t('databaseExplorer.relationships')} variant="information" fullScreen>
      <div className="process-o-canvas relative h-full min-h-0 overflow-hidden">
        <ReactFlow
          key={layoutVersion}
          nodes={nodes}
          edges={edges}
          nodeTypes={relationshipNodeTypes}
          edgeTypes={relationshipEdgeTypes}
          onNodeClick={(_event, node) => setSelectedTableKey(node.id)}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          onPaneClick={() => setSelectedTableKey(null)}
          minZoom={0.15}
          maxZoom={1.25}
          colorMode={isDarkTheme ? 'dark' : 'light'}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} size={1} color="var(--process-canvas-grid)" />
          <Controls showInteractive={false} />
          <RelationshipOverviewMap positions={positions} selectedTableKey={selectedTableKey} onSelect={setSelectedTableKey} />
          <Panel position="top-left" className="!m-4 max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/95 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><GitFork className="h-4 w-4 text-[var(--interactive-text)]" />{t('databaseExplorer.relationships')}</div>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{t('databaseExplorer.relationshipsDescription')}</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--interactive-text)]"><ArrowRight className="h-3.5 w-3.5" />{t('databaseExplorer.dataFlow')}</div>
            <div className="mt-2 text-xs text-[var(--text-muted)]">{tables.length} {t('databaseExplorer.tables').toLowerCase()} · {resolvedRelations.length} {t('databaseExplorer.relations').toLowerCase()}</div>
          </Panel>
          {selectedTable && (
            <Panel position="top-right" className="!m-4 w-72 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/95 p-3 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Database className="h-4 w-4 text-[var(--interactive-text)]" />{selectedTable.key}</div>
              <div className="mt-2 space-y-3 text-xs text-[var(--text-secondary)]">
                <RelationshipGroup
                  title={t('databaseExplorer.dependsOn')}
                  relations={focusedRelations.filter((relation) => relation.sourceTable === selectedTable.key && relation.targetTable !== selectedTable.key)}
                  format={(relation) => `${relation.targetTable}.${relation.targetColumn} → ${relation.sourceColumn}`}
                  onSelect={(relation) => setSelectedTableKey(relation.targetTable)}
                />
                <RelationshipGroup
                  title={t('databaseExplorer.providesTo')}
                  relations={focusedRelations.filter((relation) => relation.targetTable === selectedTable.key && relation.sourceTable !== selectedTable.key)}
                  format={(relation) => `${relation.targetColumn} → ${relation.sourceTable}.${relation.sourceColumn}`}
                  onSelect={(relation) => setSelectedTableKey(relation.sourceTable)}
                />
                <RelationshipGroup
                  title={t('databaseExplorer.selfReferences')}
                  relations={focusedRelations.filter((relation) => relation.sourceTable === selectedTable.key && relation.targetTable === selectedTable.key)}
                  format={(relation) => `${relation.targetColumn} → ${relation.sourceColumn}`}
                  onSelect={() => setSelectedTableKey(selectedTable.key)}
                />
                {!focusedRelations.length && <div>{t('databaseExplorer.noRelations')}</div>}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </Modal>
  );
}
