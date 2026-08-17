import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  addEdge,
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '@/styles/processes.css';
import { Activity, Blocks, CheckSquare, ChevronDown, ChevronUp, Clock3, ExternalLink, FileDown, FileText, FilePlus2, GitBranch, GitFork, HelpCircle, LayoutPanelTop, Loader2, LogIn, LogOut, Maximize2, MessageCircle, Minimize2, Paperclip, Pencil, Plus, Save, Sparkles, Trash2, Undo2, X, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, CreateButton, DeleteIconButton, IconButton } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';
import ProtectedImage from '@/components/ProtectedImage';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useOrgScopeKey } from '@/lib/orgScope';
import { shouldQueueProcessAutosave } from '@/lib/processAutosave';
import {
  createProcess,
  deleteProcess,
  emptyProcessDefinition,
  listProcesses,
  type ProcessDefinition,
  type ProcessChecklistItem,
  type ProcessDto,
  type ProcessNodeType,
  type ProcessPath,
  type ProcessPathTone,
  type ProcessStepModule,
  updateProcess,
  uploadProcessFile,
  useProcessOAccess,
} from '@/lib/processes';

type FlowNodeData = {
  label: string;
  description?: string;
  responsibleRole?: string;
  estimatedDurationMinutes?: number;
  resources?: string[];
  checklist?: ProcessChecklistItem[];
  startCondition?: string;
  completionCriterion?: string;
  detailModuleOrder?: ProcessStepModule[];
  linkedProcessId?: string;
  fileUrl?: string;
  fileName?: string;
  fileMimeType?: string;
  paths?: ProcessPath[];
  nodeType: ProcessNodeType;
  canEdit?: boolean;
  onDelete?: (nodeId: string) => void;
  onOpenFile?: (fileUrl: string) => void;
};
type FlowNode = Node<FlowNodeData, 'process'>;

type FlowEdgeData = {
  canEdit?: boolean;
  onInsertNode?: (edgeId: string, nodeType: ProcessNodeType, position: { x: number; y: number }) => void;
  pathTone?: ProcessPathTone;
};
type FlowEdge = Edge<FlowEdgeData, 'process-edge'>;

type AutoSavePayload = {
  processId: string;
  title: string;
  purpose: string;
  definition: ProcessDefinition;
  snapshot: string;
};

type ProcessMetadataModal =
  | { mode: 'create' }
  | { mode: 'edit' }
  | null;

type StepModule = ProcessStepModule;

const stepModules: StepModule[] = ['duration', 'resources', 'checklist', 'startCondition', 'completionCriterion'];

function hasStepModuleData(data: Pick<FlowNodeData, 'estimatedDurationMinutes' | 'resources' | 'checklist' | 'startCondition' | 'completionCriterion'>, module: StepModule) {
  switch (module) {
    case 'duration': return typeof data.estimatedDurationMinutes === 'number';
    case 'resources': return Boolean(data.resources?.length);
    case 'checklist': return Boolean(data.checklist?.length);
    case 'startCondition': return Boolean(data.startCondition);
    case 'completionCriterion': return Boolean(data.completionCriterion);
  }
}

function orderedStepModules(data: Pick<FlowNodeData, 'estimatedDurationMinutes' | 'resources' | 'checklist' | 'startCondition' | 'completionCriterion' | 'detailModuleOrder'>) {
  const seen = new Set<StepModule>();
  const persisted = (data.detailModuleOrder || []).filter((module): module is StepModule => {
    if (!stepModules.includes(module) || seen.has(module)) return false;
    seen.add(module);
    return true;
  });
  return [...persisted, ...stepModules.filter((module) => !seen.has(module) && hasStepModuleData(data, module))];
}

type ElkConstructor = typeof import('elkjs/lib/elk.bundled.js').default;
let elkConstructorPromise: Promise<ElkConstructor> | null = null;

function loadElkConstructor() {
  if (!elkConstructorPromise) {
    elkConstructorPromise = import('elkjs/lib/elk.bundled.js').then((module) => module.default);
  }
  return elkConstructorPromise;
}

const nodeLabelKeys: Record<ProcessNodeType, string> = {
  input: 'nodes.input',
  activity: 'nodes.activity',
  decision: 'nodes.decision',
  branch: 'nodes.branch',
  subprocess: 'nodes.subprocess',
  file: 'nodes.file',
  output: 'nodes.output',
  outcome: 'nodes.outcome',
  reflection: 'nodes.reflection',
};

function processSelectionStorageKey(scopeKey: string) {
  return `stato.processo.selected-process.${scopeKey}`;
}

function readRememberedProcessId(scopeKey: string) {
  try {
    return window.localStorage.getItem(processSelectionStorageKey(scopeKey));
  } catch {
    return null;
  }
}

const nodeColors: Record<ProcessNodeType, string> = {
  input: '#2563eb',
  activity: '#0f766e',
  decision: '#c2410c',
  branch: '#4f46e5',
  subprocess: '#0e7490',
  file: '#64748b',
  output: '#7c3aed',
  outcome: '#be185d',
  reflection: '#a16207',
};

const nodeIcons: Record<ProcessNodeType, LucideIcon> = {
  input: LogIn,
  activity: Activity,
  decision: GitBranch,
  branch: GitFork,
  subprocess: Blocks,
  file: FileText,
  output: LogOut,
  outcome: Sparkles,
  reflection: HelpCircle,
};

function nodeId() {
  return globalThis.crypto?.randomUUID?.() || `process-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type FlowNodeActions = Pick<FlowNodeData, 'canEdit' | 'onDelete' | 'onOpenFile'>;
type FlowEdgeActions = Pick<FlowEdgeData, 'canEdit' | 'onInsertNode'>;

const workflowEdgeStyle = {
  stroke: 'var(--process-canvas-edge)',
  strokeWidth: 1.5,
  strokeDasharray: '4 5',
};

const pathToneColors: Record<ProcessPathTone, string> = {
  positive: '#15803d',
  negative: '#dc2626',
  neutral: '#64748b',
};

const defaultDecisionPaths: ProcessPath[] = [
  { id: 'yes', label: 'Ja', tone: 'positive' },
  { id: 'no', label: 'Nein', tone: 'negative' },
];

const defaultParallelPaths: ProcessPath[] = [
  { id: 'path-a', label: 'Pfad 1', tone: 'neutral' },
  { id: 'path-b', label: 'Pfad 2', tone: 'neutral' },
];

function defaultPathsFor(nodeType: ProcessNodeType): ProcessPath[] | undefined {
  if (nodeType === 'decision') return defaultDecisionPaths.map((path) => ({ ...path }));
  if (nodeType === 'branch') return defaultParallelPaths.map((path) => ({ ...path }));
  return undefined;
}

function nodePaths(nodeType: ProcessNodeType, paths?: ProcessPath[]): ProcessPath[] {
  if (paths?.length) return paths;
  return defaultPathsFor(nodeType) || [];
}

function pathHandleId(pathId: string) {
  return `path-${pathId}`;
}

function getPathForEdge(sourceNode: FlowNode | undefined, sourceHandle?: string | null) {
  if (!sourceNode || !sourceHandle?.startsWith('path-')) return undefined;
  return nodePaths(sourceNode.data.nodeType, sourceNode.data.paths).find((path) => pathHandleId(path.id) === sourceHandle);
}

function getWorkflowEdgeStyle(pathTone?: ProcessPathTone) {
  return pathTone
    ? { ...workflowEdgeStyle, stroke: pathToneColors[pathTone] }
    : workflowEdgeStyle;
}

function toFlowNodes(definition: ProcessDefinition, actions: FlowNodeActions): FlowNode[] {
  return definition.nodes.map((node) => ({
    id: node.id,
    type: 'process',
    position: node.position,
    data: { ...node.data, nodeType: node.type, ...actions },
  }));
}

function toFlowEdges(definition: ProcessDefinition, actions: FlowEdgeActions): FlowEdge[] {
  return definition.edges.map((edge) => {
    // Path labels and colours are derived from the source node as they are the
    // semantic outcome of a decision or parallelisation.
    const sourceNode = definition.nodes.find((node) => node.id === edge.source);
    const sourceHandle = edge.sourceHandle === 'branch-a'
      ? pathHandleId('path-a')
      : edge.sourceHandle === 'branch-b'
        ? pathHandleId('path-b')
        : edge.sourceHandle;
    const path = sourceNode && sourceHandle
      ? nodePaths(sourceNode.type, sourceNode.data.paths).find((candidate) => pathHandleId(candidate.id) === sourceHandle)
      : undefined;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label || path?.label,
      type: 'process-edge',
      style: getWorkflowEdgeStyle(path?.tone),
      data: { ...actions, pathTone: path?.tone },
    };
  });
}

function toDefinition(nodes: FlowNode[], edges: FlowEdge[]): ProcessDefinition {
  return {
    schemaVersion: 1,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.nodeType,
      position: node.position,
      data: {
        label: node.data.label,
        ...(node.data.description ? { description: node.data.description } : {}),
        ...(node.data.responsibleRole ? { responsibleRole: node.data.responsibleRole } : {}),
        ...(typeof node.data.estimatedDurationMinutes === 'number' ? { estimatedDurationMinutes: node.data.estimatedDurationMinutes } : {}),
        ...(node.data.resources?.length ? { resources: node.data.resources } : {}),
        ...(node.data.checklist?.length ? { checklist: node.data.checklist } : {}),
        ...(node.data.startCondition ? { startCondition: node.data.startCondition } : {}),
        ...(node.data.completionCriterion ? { completionCriterion: node.data.completionCriterion } : {}),
        ...(node.data.detailModuleOrder?.length ? { detailModuleOrder: node.data.detailModuleOrder } : {}),
        ...(node.data.linkedProcessId ? { linkedProcessId: node.data.linkedProcessId } : {}),
        ...(node.data.fileUrl ? { fileUrl: node.data.fileUrl } : {}),
        ...(node.data.fileName ? { fileName: node.data.fileName } : {}),
        ...(node.data.fileMimeType ? { fileMimeType: node.data.fileMimeType } : {}),
        ...(node.data.paths?.length ? { paths: node.data.paths } : {}),
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
      ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
      ...(typeof edge.label === 'string' && edge.label.trim() ? { label: edge.label } : {}),
    })),
  };
}

function getNodeDimensions(node: FlowNode) {
  const pathCount = node.data.nodeType === 'decision' || node.data.nodeType === 'branch'
    ? nodePaths(node.data.nodeType, node.data.paths).length
    : 0;
  const detailCount = Number(Boolean(node.data.resources?.length))
    + Number(Boolean(node.data.checklist?.length))
    + Number(Boolean(node.data.startCondition))
    + Number(Boolean(node.data.completionCriterion));
  return {
    width: 208,
    height: (node.data.nodeType === 'file' && node.data.fileUrl ? 190 : node.data.description ? 160 : 108)
      + (typeof node.data.estimatedDurationMinutes === 'number' ? 18 : 0)
      + detailCount * 18
      + pathCount * 26,
  };
}

async function getAutoLayoutedNodes(nodes: FlowNode[], edges: FlowEdge[]) {
  const Elk = await loadElkConstructor();
  const elk = new Elk();
  const layout = await elk.layout({
    id: 'process-workflow',
    layoutOptions: {
      'elk.algorithm': 'layered',
      // A top-down flow makes a branch read naturally: one predecessor above,
      // the alternative paths side by side below it.
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'SPLINES',
      'elk.spacing.nodeNode': '56',
      'elk.layered.spacing.nodeNodeBetweenLayers': '92',
      'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
    },
    children: nodes.map((node) => ({ id: node.id, ...getNodeDimensions(node) })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  });
  const positions = new Map((layout.children || []).map((node) => [node.id, node]));
  return nodes.map((node) => {
    const positioned = positions.get(node.id);
    return positioned ? { ...node, position: { x: positioned.x || 0, y: positioned.y || 0 } } : node;
  });
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  const normalized = value.length === 3 ? value.split('').map((character) => `${character}${character}`).join('') : value;
  const parsed = Number.parseInt(normalized, 16);
  return [parsed >> 16 & 255, parsed >> 8 & 255, parsed & 255] as const;
}

function getProcessSnapshot(title: string, purpose: string, definition: ProcessDefinition) {
  // PostgreSQL jsonb may return object properties in a different order. Keeping
  // one canonical representation avoids a completed autosave looking dirty again.
  const normalizedDefinition = {
    schemaVersion: 1,
    nodes: definition.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: { x: node.position.x, y: node.position.y },
      data: {
        label: node.data.label,
        ...(node.data.description ? { description: node.data.description } : {}),
        ...(node.data.responsibleRole ? { responsibleRole: node.data.responsibleRole } : {}),
        ...(typeof node.data.estimatedDurationMinutes === 'number' ? { estimatedDurationMinutes: node.data.estimatedDurationMinutes } : {}),
        ...(node.data.resources?.length ? { resources: node.data.resources } : {}),
        ...(node.data.checklist?.length ? { checklist: node.data.checklist } : {}),
        ...(node.data.startCondition ? { startCondition: node.data.startCondition } : {}),
        ...(node.data.completionCriterion ? { completionCriterion: node.data.completionCriterion } : {}),
        ...(node.data.detailModuleOrder?.length ? { detailModuleOrder: node.data.detailModuleOrder } : {}),
        ...(node.data.linkedProcessId ? { linkedProcessId: node.data.linkedProcessId } : {}),
        ...(node.data.fileUrl ? { fileUrl: node.data.fileUrl } : {}),
        ...(node.data.fileName ? { fileName: node.data.fileName } : {}),
        ...(node.data.fileMimeType ? { fileMimeType: node.data.fileMimeType } : {}),
        ...(node.data.paths?.length ? { paths: node.data.paths } : {}),
      },
    })),
    edges: definition.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
      ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
      ...(edge.label?.trim() ? { label: edge.label } : {}),
    })),
  } satisfies ProcessDefinition;
  return JSON.stringify({ title: title.trim(), purpose: purpose.trim(), definition: normalizedDefinition });
}

const ProcessNodeCard = memo(({ id, data, selected }: NodeProps<FlowNode>) => {
  const { t } = useTranslation('processes');
  const color = nodeColors[data.nodeType];
  const NodeIcon = nodeIcons[data.nodeType];
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const updateNodeInternals = useUpdateNodeInternals();
  const paths = nodePaths(data.nodeType, data.paths);
  const hasPaths = paths.length > 0;

  useEffect(() => {
    if (hasPaths) updateNodeInternals(id);
  }, [hasPaths, id, paths, updateNodeInternals]);

  return (
    <div
      className={`process-o-node min-w-44 rounded-xl border bg-[var(--surface-1)] shadow-sm ${selected ? 'ring-2 ring-viridian' : ''}`}
      style={{ borderColor: `${color}80` }}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5" style={{ background: color }} />
      <div className="flex items-center justify-between rounded-t-xl px-3 py-1.5 text-xs font-semibold text-white" style={{ background: color }}>
        <span className="flex items-center gap-1.5"><NodeIcon className="h-3.5 w-3.5" aria-hidden="true" />{t(nodeLabelKeys[data.nodeType])}</span>
        <span className="flex items-center gap-0.5">
          {data.nodeType === 'file' && data.fileUrl ? (
            <IconButton
              className="process-o-node-delete nodrag nowheel"
              aria-label={t('node.openFile')}
              size="icon-compact"
              variant="ghost"
              title={t('node.openFile')}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onOpenFile?.(data.fileUrl!);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </IconButton>
          ) : null}
          {data.canEdit ? (
            <IconButton
              className="process-o-node-delete nodrag nowheel"
              aria-label={t('node.remove')}
              size="icon-compact"
              variant="ghost"
              title={t('node.remove')}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onDelete?.(id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          ) : null}
        </span>
      </div>
      <div className="px-3 py-2">
        <div className="font-semibold text-[var(--text-primary)]">{data.label || t('node.unnamed')}</div>
        {data.responsibleRole ? <div className="mt-1 text-xs text-[var(--text-muted)]">{data.responsibleRole}</div> : null}
        {typeof data.estimatedDurationMinutes === 'number' ? (
          <div className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('node.estimatedDurationValue', { minutes: data.estimatedDurationMinutes })}
          </div>
        ) : null}
        {data.resources?.length ? (
          <div className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
            {t('node.resourcesSummary', { count: data.resources.length })}
          </div>
        ) : null}
        {data.checklist?.length ? (
          <div className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {t('node.checklistSummary', { count: data.checklist.length })}
          </div>
        ) : null}
        {data.startCondition ? <div className="mt-1 text-xs text-[var(--text-muted)]">{t('node.startConditionShort')}</div> : null}
        {data.completionCriterion ? <div className="mt-1 text-xs text-[var(--text-muted)]">{t('node.completionCriterionShort')}</div> : null}
        {data.nodeType === 'branch' ? <div className="mt-1 text-xs text-[var(--text-muted)]">{t('node.multiplePaths')}</div> : null}
        {data.nodeType === 'subprocess' && !data.linkedProcessId ? <div className="mt-1 text-xs text-[var(--text-muted)]">{t('node.unlinked')}</div> : null}
        {data.nodeType === 'file' && data.fileUrl ? (
          data.fileMimeType?.startsWith('image/')
            ? <ProtectedImage src={data.fileUrl} alt={data.fileName || data.label} className="process-o-file-preview mt-2" />
            : <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><FileText className="h-4 w-4" />{data.fileName || t('node.pdfFile')}</div>
        ) : null}
        {data.description ? (
          <div className="mt-2">
            <Button
              size="sm"
              variant="ghost"
              className="process-o-node-hint nodrag nowheel"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDescriptionOpen((current) => !current);
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {t('node.hint')}
              {isDescriptionOpen ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
            </Button>
            {isDescriptionOpen ? <p className="process-o-node-description nodrag nowheel">{data.description}</p> : null}
          </div>
        ) : null}
        {hasPaths ? (
          <div className="process-o-node-paths nodrag nowheel" aria-label={t('node.paths')}>
            {paths.map((path) => (
              <div key={path.id} className="process-o-node-path-row">
                <span className={`process-o-path-badge process-o-path-${path.tone}`}>
                  {path.label || t('node.unnamedPath')}
                </span>
                <Handle
                  id={pathHandleId(path.id)}
                  type="source"
                  position={Position.Right}
                  className="process-o-path-handle !h-2.5 !w-2.5"
                  style={{ background: pathToneColors[path.tone] }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {!hasPaths ? <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5" style={{ background: color }} /> : null}
    </div>
  );
});
ProcessNodeCard.displayName = 'ProcessNodeCard';

const ProcessEdge = memo(({ id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, style, data, label }: EdgeProps<FlowEdge>) => {
  const { t } = useTranslation('processes');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const insertNode = (nodeType: ProcessNodeType) => {
    data?.onInsertNode?.(id, nodeType, { x: labelX, y: labelY });
    setIsMenuOpen(false);
  };

  return (
    <>
      <BaseEdge path={edgePath} style={style} />
      {typeof label === 'string' && label.trim() ? (
        <EdgeLabelRenderer>
          <div
            className="process-o-edge-label nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 22}px)`,
              borderColor: data?.pathTone ? pathToneColors[data.pathTone] : undefined,
              color: data?.pathTone ? pathToneColors[data.pathTone] : undefined,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {data?.canEdit ? (
        <EdgeLabelRenderer>
          <div
            className="process-o-edge-control nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <IconButton
              aria-label={t('node.insert')}
              className="process-o-edge-add"
              size="icon-compact"
              variant="ghost"
              title={t('node.insert')}
              onClick={() => setIsMenuOpen((current) => !current)}
            >
              <Plus className="h-3.5 w-3.5" />
            </IconButton>
            {isMenuOpen ? (
              <div className="process-o-edge-menu" role="menu" aria-label={t('node.selectType')}>
                <div className="px-1.5 pb-1 text-xs font-semibold text-[var(--text-muted)]">{t('node.insert')}</div>
                {(Object.keys(nodeLabelKeys) as ProcessNodeType[]).map((nodeType) => {
                  const NodeIcon = nodeIcons[nodeType];
                  return (
                    <Button key={nodeType} size="sm" variant="ghost" className="process-o-edge-menu-item" onClick={() => insertNode(nodeType)}>
                      <NodeIcon className="h-3.5 w-3.5" style={{ color: nodeColors[nodeType] }} aria-hidden="true" />
                      {t(nodeLabelKeys[nodeType])}
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});
ProcessEdge.displayName = 'ProcessEdge';

export default function Processes() {
  const { t, i18n } = useTranslation('processes');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const scopeKey = useOrgScopeKey();
  const access = useProcessOAccess();
  const processesQuery = useQuery({
    queryKey: ['processes', scopeKey],
    queryFn: listProcesses,
    enabled: access.data?.enabled === true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const nodesRef = useRef<FlowNode[]>([]);
  const edgesRef = useRef<FlowEdge[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const savedProcessSnapshotsRef = useRef(new Map<string, string>());
  const pendingAutoSavesRef = useRef(new Map<string, AutoSavePayload>());
  const inFlightAutoSavesRef = useRef(new Map<string, AutoSavePayload>());
  const workflowHistoryRef = useRef<ProcessDefinition[]>([]);
  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSaveRetryTimerRef = useRef<number | null>(null);
  const autoSaveInFlightRef = useRef(false);
  const autoSaveInFlightProcessIdRef = useRef<string | null>(null);
  const autoSaveRunnerRef = useRef<() => void>(() => undefined);
  const autoSaveFailuresRef = useRef(new Set<string>());
  const autosaveTransitionNoticeRef = useRef<string | null>(null);
  const hydratedProcessIdRef = useRef<string | null>(null);
  const skipAutoSaveAfterHydrationRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const flowInstanceRef = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [layouting, setLayouting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [metadataModal, setMetadataModal] = useState<ProcessMetadataModal>(null);
  const [metadataTitle, setMetadataTitle] = useState('');
  const [metadataPurpose, setMetadataPurpose] = useState('');
  const [expandedStepModules, setExpandedStepModules] = useState<Record<string, Partial<Record<StepModule, boolean>>>>({});
  const [resourceDraft, setResourceDraft] = useState('');
  const [checklistDraft, setChecklistDraft] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(() => document.documentElement.getAttribute('data-color-mode') === 'dark');
  const [undoCount, setUndoCount] = useState(0);

  const processes = processesQuery.data || [];
  const selectedProcess = processes.find((process) => process.id === selectedId) || null;
  const canEdit = access.data?.canEdit === true;
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedNodeModuleOrder = selectedNode ? orderedStepModules(selectedNode.data) : [];
  const nodeTypes = useMemo(() => ({ process: ProcessNodeCard }), []);
  const edgeTypes = useMemo(() => ({ 'process-edge': ProcessEdge }), []);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    setResourceDraft('');
    setChecklistDraft('');
  }, [selectedNodeId]);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.getAttribute('data-color-mode') === 'dark');
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-color-mode'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === canvasRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!canvasRef.current) return;
    if (document.fullscreenElement === canvasRef.current) {
      await document.exitFullscreen();
    } else {
      await canvasRef.current.requestFullscreen();
    }
  }, []);

  const captureWorkflowHistory = useCallback(() => {
    if (!canEdit || !selectedIdRef.current) return;
    const snapshot = toDefinition(nodesRef.current, edgesRef.current);
    const latest = workflowHistoryRef.current.at(-1);
    if (latest && JSON.stringify(latest) === JSON.stringify(snapshot)) return;
    workflowHistoryRef.current = [...workflowHistoryRef.current.slice(-39), snapshot];
    setUndoCount(workflowHistoryRef.current.length);
  }, [canEdit]);

  const removeStep = useCallback((nodeIdToRemove: string) => {
    if (!canEdit) return;
    captureWorkflowHistory();
    setNodes((current) => current.filter((node) => node.id !== nodeIdToRemove));
    setEdges((current) => current.filter((edge) => edge.source !== nodeIdToRemove && edge.target !== nodeIdToRemove));
    setSelectedNodeId((current) => current === nodeIdToRemove ? null : current);
  }, [canEdit, captureWorkflowHistory, setEdges, setNodes]);

  const openProcessFile = useCallback(async (fileUrl: string) => {
    const fileWindow = window.open('about:blank', '_blank');
    try {
      const response = await api.get(fileUrl, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      if (fileWindow) fileWindow.location.href = url;
      else window.open(url, '_blank');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      fileWindow?.close();
      showToast(t('messages.fileOpenFailed'), { type: 'error' });
    }
  }, [showToast, t]);

  const insertNodeOnEdge = useCallback((edgeId: string, nodeType: ProcessNodeType, position: { x: number; y: number }) => {
    if (!canEdit) return;
    const edge = edgesRef.current.find((current) => current.id === edgeId);
    if (!edge) return;
    captureWorkflowHistory();
    const id = nodeId();
    setNodes((current) => [...current, {
      id,
      type: 'process',
      position: { x: position.x - 88, y: position.y - 32 },
      data: {
        label: t(nodeLabelKeys[nodeType]),
        nodeType,
        ...(defaultPathsFor(nodeType) ? { paths: defaultPathsFor(nodeType) } : {}),
        canEdit,
        onDelete: removeStep,
        onOpenFile: openProcessFile,
      },
    }]);
    setEdges((current) => [
      ...current.filter((currentEdge) => currentEdge.id !== edgeId),
      {
        id: nodeId(),
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: id,
        label: edge.label,
        type: 'process-edge',
        style: edge.style,
        data: edge.data,
      },
      {
        id: nodeId(),
        source: id,
        target: edge.target,
        targetHandle: edge.targetHandle,
        type: 'process-edge',
        style: workflowEdgeStyle,
        data: { canEdit, onInsertNode: insertNodeOnEdge },
      },
    ]);
    setSelectedNodeId(id);
  }, [canEdit, captureWorkflowHistory, openProcessFile, removeStep, setEdges, setNodes, t]);

  const undoWorkflow = useCallback(() => {
    if (!canEdit) return;
    const previous = workflowHistoryRef.current.at(-1);
    if (!previous) return;
    workflowHistoryRef.current = workflowHistoryRef.current.slice(0, -1);
    setUndoCount(workflowHistoryRef.current.length);
    setNodes(toFlowNodes(previous, { canEdit, onDelete: removeStep, onOpenFile: openProcessFile }));
    setEdges(toFlowEdges(previous, { canEdit, onInsertNode: insertNodeOnEdge }));
    setSelectedNodeId(null);
    setExpandedStepModules({});
    showToast(t('messages.workflowUndone'));
  }, [canEdit, insertNodeOnEdge, openProcessFile, removeStep, setEdges, setNodes, showToast, t]);

  const isCurrentProcessDirty = useMemo(() => {
    if (!selectedId) return false;
    const snapshot = savedProcessSnapshotsRef.current.get(selectedId);
    if (!snapshot) return false;
    return snapshot !== getProcessSnapshot(title, purpose, toDefinition(nodes, edges));
  }, [edges, nodes, purpose, selectedId, title]);
  const isCurrentProcessAutoSaving = isAutoSaving && autoSaveInFlightProcessIdRef.current === selectedId;

  useEffect(() => {
    if (!processes.length || processes.some((process) => process.id === selectedId)) return;
    const rememberedId = readRememberedProcessId(scopeKey);
    const nextProcess = processes.find((process) => process.id === rememberedId) || processes[0];
    selectedIdRef.current = nextProcess.id;
    setSelectedId(nextProcess.id);
  }, [processes, scopeKey, selectedId]);

  useEffect(() => {
    if (!selectedId || !processes.some((process) => process.id === selectedId)) return;
    try {
      window.localStorage.setItem(processSelectionStorageKey(scopeKey), selectedId);
    } catch {
      // Persistence is a convenience; private browser modes may deny storage.
    }
  }, [processes, scopeKey, selectedId]);

  useEffect(() => {
    if (!selectedProcess) {
      hydratedProcessIdRef.current = null;
      skipAutoSaveAfterHydrationRef.current = null;
      workflowHistoryRef.current = [];
      setUndoCount(0);
      setTitle('');
      setPurpose('');
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      return;
    }
    if (hydratedProcessIdRef.current === selectedProcess.id) return;
    workflowHistoryRef.current = [];
    setUndoCount(0);
    if (!savedProcessSnapshotsRef.current.has(selectedProcess.id)) {
      savedProcessSnapshotsRef.current.set(
        selectedProcess.id,
        getProcessSnapshot(selectedProcess.title, selectedProcess.purpose || '', selectedProcess.definition || emptyProcessDefinition()),
      );
    }
    const optimisticSave = pendingAutoSavesRef.current.get(selectedProcess.id) || inFlightAutoSavesRef.current.get(selectedProcess.id);
    const definition = optimisticSave?.definition || selectedProcess.definition || emptyProcessDefinition();
    skipAutoSaveAfterHydrationRef.current = selectedProcess.id;
    hydratedProcessIdRef.current = selectedProcess.id;
    setTitle(optimisticSave?.title ?? selectedProcess.title);
    setPurpose(optimisticSave?.purpose ?? selectedProcess.purpose ?? '');
    setNodes(toFlowNodes(definition, {
      canEdit,
      onDelete: removeStep,
      onOpenFile: openProcessFile,
    }));
    setEdges(toFlowEdges(definition, {
      canEdit,
      onInsertNode: insertNodeOnEdge,
    }));
    setSelectedNodeId(null);
  }, [canEdit, insertNodeOnEdge, openProcessFile, removeStep, selectedProcess, setEdges, setNodes]);

  const storeProcess = useCallback((updated: ProcessDto) => {
    queryClient.setQueryData<ProcessDto[]>(['processes', scopeKey], (current = []) =>
      current.some((process) => process.id === updated.id)
        ? current.map((process) => (process.id === updated.id ? updated : process))
        : [updated, ...current],
    );
  }, [queryClient, scopeKey]);

  const storeOptimisticProcess = useCallback((payload: AutoSavePayload) => {
    queryClient.setQueryData<ProcessDto[]>(['processes', scopeKey], (current = []) =>
      current.map((process) => process.id === payload.processId ? {
        ...process,
        title: payload.title,
        purpose: payload.purpose || null,
        definition: payload.definition,
      } : process),
    );
  }, [queryClient, scopeKey]);

  const flushPendingAutoSaves = useCallback(async () => {
    if (autoSaveInFlightRef.current) return;
    const next = pendingAutoSavesRef.current.entries().next().value as [string, AutoSavePayload] | undefined;
    if (!next) return;
    const [processId, payload] = next;
    pendingAutoSavesRef.current.delete(processId);
    inFlightAutoSavesRef.current.set(processId, payload);
    autoSaveInFlightRef.current = true;
    autoSaveInFlightProcessIdRef.current = processId;
    setIsAutoSaving(true);
    try {
      const updated = await updateProcess(processId, {
        title: payload.title,
        purpose: payload.purpose || null,
        definition: payload.definition,
      });
      const newerSave = pendingAutoSavesRef.current.get(processId);
      const isLatestSave = !newerSave || newerSave.snapshot === payload.snapshot;
      if (isLatestSave) storeProcess(updated);
      // The payload is already canonical. Do not rebuild this from jsonb, whose
      // key ordering may differ from the browser representation.
      if (isLatestSave) savedProcessSnapshotsRef.current.set(processId, payload.snapshot);
      autoSaveFailuresRef.current.delete(processId);
      if (isLatestSave && autosaveTransitionNoticeRef.current === processId) {
        autosaveTransitionNoticeRef.current = null;
        showToast(t('messages.saved'), { durationMs: 2200 });
      }
    } catch {
      pendingAutoSavesRef.current.set(processId, payload);
      if (!autoSaveFailuresRef.current.has(processId)) {
        autoSaveFailuresRef.current.add(processId);
        showToast(t('messages.saveFailed'), { type: 'error' });
      }
      if (autoSaveRetryTimerRef.current === null) {
        autoSaveRetryTimerRef.current = window.setTimeout(() => {
          autoSaveRetryTimerRef.current = null;
          autoSaveRunnerRef.current();
        }, 5000);
      }
    } finally {
      inFlightAutoSavesRef.current.delete(processId);
      autoSaveInFlightRef.current = false;
      autoSaveInFlightProcessIdRef.current = null;
      setIsAutoSaving(false);
      if (pendingAutoSavesRef.current.size > 0 && autoSaveTimerRef.current === null && autoSaveRetryTimerRef.current === null) {
        window.setTimeout(() => autoSaveRunnerRef.current(), 0);
      }
    }
  }, [showToast, storeProcess, t]);

  const queueAutoSave = useCallback((payload: AutoSavePayload) => {
    pendingAutoSavesRef.current.set(payload.processId, payload);
    storeOptimisticProcess(payload);
    autoSaveFailuresRef.current.delete(payload.processId);
    if (autoSaveRetryTimerRef.current !== null) {
      window.clearTimeout(autoSaveRetryTimerRef.current);
      autoSaveRetryTimerRef.current = null;
    }
    if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      autoSaveRunnerRef.current();
    }, 700);
  }, [storeOptimisticProcess]);

  const queueCurrentProcessAutoSave = useCallback(() => {
    const definition = toDefinition(nodes, edges);
    const snapshot = getProcessSnapshot(title, purpose, definition);
    const queuedSave = selectedId ? pendingAutoSavesRef.current.get(selectedId) || inFlightAutoSavesRef.current.get(selectedId) : undefined;
    if (!shouldQueueProcessAutosave({
      canEdit,
      selectedProcessId: selectedId,
      hydratedProcessId: hydratedProcessIdRef.current,
      title,
      currentSnapshot: snapshot,
      savedSnapshot: selectedId ? savedProcessSnapshotsRef.current.get(selectedId) : undefined,
      queuedSnapshot: queuedSave?.snapshot,
    })) return;
    queueAutoSave({
      processId: selectedId!,
      title: title.trim(),
      purpose: purpose.trim(),
      definition,
      snapshot,
    });
  }, [canEdit, edges, nodes, purpose, queueAutoSave, selectedId, title]);

  const openProcess = useCallback((processId: string) => {
    if (processId === selectedId) return;
    if (selectedId && isCurrentProcessDirty) autosaveTransitionNoticeRef.current = selectedId;
    queueCurrentProcessAutoSave();
    selectedIdRef.current = processId;
    setSelectedId(processId);
  }, [isCurrentProcessDirty, queueCurrentProcessAutoSave, selectedId]);

  const selectProcess = useCallback((processId: string) => {
    openProcess(processId);
  }, [openProcess]);

  useEffect(() => {
    autoSaveRunnerRef.current = () => { void flushPendingAutoSaves(); };
  }, [flushPendingAutoSaves]);

  useEffect(() => () => {
    if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
    if (autoSaveRetryTimerRef.current !== null) window.clearTimeout(autoSaveRetryTimerRef.current);
  }, []);

  useEffect(() => {
    if (skipAutoSaveAfterHydrationRef.current === selectedId) {
      skipAutoSaveAfterHydrationRef.current = null;
      return;
    }
    const definition = toDefinition(nodes, edges);
    const snapshot = getProcessSnapshot(title, purpose, definition);
    const queuedSave = selectedId ? pendingAutoSavesRef.current.get(selectedId) || inFlightAutoSavesRef.current.get(selectedId) : undefined;
    if (!shouldQueueProcessAutosave({
      canEdit,
      selectedProcessId: selectedId,
      hydratedProcessId: hydratedProcessIdRef.current,
      title,
      currentSnapshot: snapshot,
      savedSnapshot: selectedId ? savedProcessSnapshotsRef.current.get(selectedId) : undefined,
      queuedSnapshot: queuedSave?.snapshot,
    })) return;
    queueAutoSave({
      processId: selectedId!,
      title: title.trim(),
      purpose: purpose.trim(),
      definition,
      snapshot,
    });
  }, [canEdit, edges, nodes, purpose, queueAutoSave, selectedId, title]);

  const onConnect = useCallback((connection: Connection) => {
    if (!canEdit) return;
    captureWorkflowHistory();
    const sourcePath = getPathForEdge(
      nodesRef.current.find((node) => node.id === connection.source),
      connection.sourceHandle,
    );
    setEdges((current) => addEdge({
      ...connection,
      id: nodeId(),
      type: 'process-edge',
      ...(sourcePath ? { label: sourcePath.label } : {}),
      style: getWorkflowEdgeStyle(sourcePath?.tone),
      data: { canEdit, onInsertNode: insertNodeOnEdge, pathTone: sourcePath?.tone },
    }, current));
  }, [canEdit, captureWorkflowHistory, insertNodeOnEdge, setEdges]);

  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    if (canEdit && changes.some((change) => change.type === 'remove')) captureWorkflowHistory();
    onNodesChange(changes);
  }, [canEdit, captureWorkflowHistory, onNodesChange]);

  const handleEdgesChange = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    if (canEdit && changes.some((change) => change.type === 'remove')) captureWorkflowHistory();
    onEdgesChange(changes);
  }, [canEdit, captureWorkflowHistory, onEdgesChange]);

  const handleNodeDragStart = useCallback(() => {
    captureWorkflowHistory();
  }, [captureWorkflowHistory]);

  const addNode = (nodeType: ProcessNodeType) => {
    if (!canEdit) return;
    captureWorkflowHistory();
    const offset = nodes.length * 24;
    const id = nodeId();
    setNodes((current) => [...current, {
      id,
      type: 'process',
      position: { x: 120 + offset, y: 120 + offset },
      data: {
        label: t(nodeLabelKeys[nodeType]),
        nodeType,
        ...(defaultPathsFor(nodeType) ? { paths: defaultPathsFor(nodeType) } : {}),
        canEdit,
        onDelete: removeStep,
        onOpenFile: openProcessFile,
      },
    }]);
    setSelectedNodeId(id);
  };

  const updateSelectedNode = (patch: Partial<FlowNodeData>) => {
    if (!selectedNodeId || !canEdit) return;
    captureWorkflowHistory();
    setNodes((current) => current.map((node) =>
      node.id === selectedNodeId ? {
        ...node,
        data: {
          ...node.data,
          ...patch,
          ...((patch.nodeType === 'decision' || patch.nodeType === 'branch') && !node.data.paths
            ? { paths: defaultPathsFor(patch.nodeType) }
            : {}),
        },
      } : node,
    ));
  };

  const showStepModule = (nodeIdToUpdate: string, module: StepModule) => {
    if (!canEdit) return;
    captureWorkflowHistory();
    setExpandedStepModules((current) => ({
      ...current,
      [nodeIdToUpdate]: { ...current[nodeIdToUpdate], [module]: true },
    }));
    setNodes((current) => current.map((node) => {
      if (node.id !== nodeIdToUpdate) return node;
      const previousOrder = orderedStepModules(node.data).filter((currentModule) => currentModule !== module);
      return { ...node, data: { ...node.data, detailModuleOrder: [...previousOrder, module] } };
    }));
  };

  const hideStepModule = (nodeIdToUpdate: string, module: StepModule) => {
    if (!canEdit) return;
    captureWorkflowHistory();
    setExpandedStepModules((current) => ({
      ...current,
      [nodeIdToUpdate]: { ...current[nodeIdToUpdate], [module]: false },
    }));
    setNodes((current) => current.map((node) => {
      if (node.id !== nodeIdToUpdate) return node;
      const nextOrder = orderedStepModules(node.data).filter((currentModule) => currentModule !== module);
      return { ...node, data: { ...node.data, ...(nextOrder.length ? { detailModuleOrder: nextOrder } : { detailModuleOrder: undefined }) } };
    }));
  };

  const addNodeResource = (nodeIdToUpdate: string, value: string) => {
    const resource = value.trim();
    if (!canEdit || !resource) return;
    captureWorkflowHistory();
    setNodes((current) => current.map((node) => {
      if (node.id !== nodeIdToUpdate) return node;
      const resources = node.data.resources || [];
      if (resources.some((item) => item.localeCompare(resource, undefined, { sensitivity: 'accent' }) === 0)) return node;
      return { ...node, data: { ...node.data, resources: [...resources, resource] } };
    }));
  };

  const addNodeChecklistItem = (nodeIdToUpdate: string, value: string) => {
    const label = value.trim();
    if (!canEdit || !label) return;
    captureWorkflowHistory();
    setNodes((current) => current.map((node) => node.id === nodeIdToUpdate ? {
      ...node,
      data: { ...node.data, checklist: [...(node.data.checklist || []), { id: `check-${nodeId()}`, label }] },
    } : node));
  };

  const updateNodePath = (nodeIdToUpdate: string, pathId: string, patch: Partial<ProcessPath>) => {
    if (!canEdit) return;
    const targetNode = nodesRef.current.find((node) => node.id === nodeIdToUpdate);
    const currentPath = targetNode && nodePaths(targetNode.data.nodeType, targetNode.data.paths).find((path) => path.id === pathId);
    if (!currentPath) return;
    captureWorkflowHistory();
    const nextPath = { ...currentPath, ...patch };
    setNodes((current) => current.map((node) => node.id === nodeIdToUpdate ? {
      ...node,
      data: {
        ...node.data,
        paths: nodePaths(node.data.nodeType, node.data.paths).map((path) => path.id === pathId ? nextPath : path),
      },
    } : node));
    setEdges((current) => current.map((edge) => edge.source === nodeIdToUpdate && edge.sourceHandle === pathHandleId(pathId) ? {
      ...edge,
      label: nextPath.label,
      style: getWorkflowEdgeStyle(nextPath.tone),
      data: { ...edge.data, pathTone: nextPath.tone },
    } : edge));
  };

  const addNodePath = (nodeIdToUpdate: string) => {
    if (!canEdit) return;
    captureWorkflowHistory();
    const id = `path-${nodeId()}`;
    setNodes((current) => current.map((node) => node.id === nodeIdToUpdate ? {
      ...node,
      data: {
        ...node.data,
        paths: [...nodePaths(node.data.nodeType, node.data.paths), { id, label: t('node.newPath'), tone: 'neutral' }],
      },
    } : node));
  };

  const removeNodePath = (nodeIdToUpdate: string, pathId: string) => {
    if (!canEdit) return;
    captureWorkflowHistory();
    setNodes((current) => current.map((node) => node.id === nodeIdToUpdate ? {
      ...node,
      data: { ...node.data, paths: nodePaths(node.data.nodeType, node.data.paths).filter((path) => path.id !== pathId) },
    } : node));
    setEdges((current) => current.filter((edge) => !(edge.source === nodeIdToUpdate && edge.sourceHandle === pathHandleId(pathId))));
  };

  const uploadFileToSelectedNode = async (file: File) => {
    if (!canEdit || !selectedNode || selectedNode.data.nodeType !== 'file') return;
    setSaving(true);
    try {
      const uploaded = await uploadProcessFile(file);
      updateSelectedNode({
        label: uploaded.filename,
        fileUrl: uploaded.url,
        fileName: uploaded.filename,
        fileMimeType: uploaded.mimeType,
      });
      showToast(t('messages.fileUploaded'));
    } catch {
      showToast(t('messages.fileUploadFailed'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const createLinkedSubprocess = async () => {
    if (!canEdit || !selectedNode || selectedNode.data.nodeType !== 'subprocess') return;
    setSaving(true);
    try {
      const created = await createProcess({
        title: t('metadata.newSubprocessTitle'),
        purpose: t('metadata.newSubprocessPurpose'),
        definition: emptyProcessDefinition(),
      });
      storeProcess(created);
      updateSelectedNode({ linkedProcessId: created.id, label: created.title });
      showToast(t('messages.subprocessCreated'));
    } catch {
      showToast(t('messages.subprocessCreateFailed'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const autoArrange = async () => {
    if (!canEdit || nodes.length === 0) return;
    setLayouting(true);
    try {
      captureWorkflowHistory();
      setNodes(await getAutoLayoutedNodes(nodes, edges));
      window.requestAnimationFrame(() => {
        flowInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
      });
      showToast(t('messages.workflowArranged'));
    } catch {
      showToast(t('messages.workflowArrangeFailed'), { type: 'error' });
    } finally {
      setLayouting(false);
    }
  };

  const exportPdf = async () => {
    if (!selectedProcess || exporting) return;
    setExporting(true);
    try {
      const { jsPDF: JsPDF } = await import('jspdf');
      const arrangedNodes = await getAutoLayoutedNodes(nodes, edges);
      const nodeById = new Map(arrangedNodes.map((node) => [node.id, node]));
      const pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const margin = 12;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const graphTop = 42;
      const graphHeight = pageHeight - graphTop - margin;
      const bounds = arrangedNodes.reduce((current, node) => {
        const size = getNodeDimensions(node);
        return {
          minX: Math.min(current.minX, node.position.x),
          minY: Math.min(current.minY, node.position.y),
          maxX: Math.max(current.maxX, node.position.x + size.width),
          maxY: Math.max(current.maxY, node.position.y + size.height),
        };
      }, { minX: 0, minY: 0, maxX: 1, maxY: 1 });
      const graphWidth = Math.max(1, bounds.maxX - bounds.minX);
      const graphContentHeight = Math.max(1, bounds.maxY - bounds.minY);
      const scale = Math.min((pageWidth - margin * 2) / graphWidth, graphHeight / graphContentHeight, 0.24);
      const project = (position: { x: number; y: number }) => ({
        x: margin + (position.x - bounds.minX) * scale,
        y: graphTop + (position.y - bounds.minY) * scale,
      });

      pdf.setTextColor(15, 118, 110);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text(title.trim() || selectedProcess.title, margin, 16);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(71, 85, 105);
      const purposeLines = pdf.splitTextToSize(purpose.trim() || t('pdf.noDescription'), pageWidth - margin * 2);
      pdf.text(purposeLines.slice(0, 2), margin, 23);
      pdf.setFontSize(8);
      pdf.text(`${t('title')} · ${t('pdf.exportedAt')} ${new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date())}`, margin, 35);

      pdf.setDrawColor(100, 116, 139);
      pdf.setLineWidth(0.45);
      edges.forEach((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) return;
        const sourceSize = getNodeDimensions(source);
        const targetSize = getNodeDimensions(target);
        const from = project({ x: source.position.x + sourceSize.width, y: source.position.y + sourceSize.height / 2 });
        const to = project({ x: target.position.x, y: target.position.y + targetSize.height / 2 });
        const pathTone = edge.data?.pathTone;
        const [edgeRed, edgeGreen, edgeBlue] = pathTone ? hexToRgb(pathToneColors[pathTone]) : [100, 116, 139];
        pdf.setDrawColor(edgeRed, edgeGreen, edgeBlue);
        pdf.line(from.x, from.y, to.x, to.y);
        pdf.setFillColor(edgeRed, edgeGreen, edgeBlue);
        pdf.triangle(to.x, to.y, to.x - 1.8, to.y - 1.2, to.x - 1.8, to.y + 1.2, 'F');
        if (typeof edge.label === 'string' && edge.label.trim()) {
          const label = edge.label.trim();
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2 - 2;
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(6);
          const labelWidth = pdf.getTextWidth(label) + 2.5;
          pdf.setFillColor(255, 255, 255);
          pdf.roundedRect(midX - labelWidth / 2, midY - 2.5, labelWidth, 3.8, 0.9, 0.9, 'F');
          pdf.setTextColor(edgeRed, edgeGreen, edgeBlue);
          pdf.text(label, midX, midY, { align: 'center' });
        }
      });

      arrangedNodes.forEach((node) => {
        const size = getNodeDimensions(node);
        const position = project(node.position);
        const width = size.width * scale;
        const height = size.height * scale;
        const [red, green, blue] = hexToRgb(nodeColors[node.data.nodeType]);
        const headerHeight = Math.min(8.5, Math.max(5, height * 0.28));
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(red, green, blue);
        pdf.roundedRect(position.x, position.y, width, height, 2, 2, 'FD');
        pdf.setFillColor(red, green, blue);
        pdf.roundedRect(position.x, position.y, width, headerHeight, 2, 2, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(Math.min(8, Math.max(4.8, width / 27)));
        pdf.text(t(nodeLabelKeys[node.data.nodeType]), position.x + 2, position.y + headerHeight * 0.65);
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(Math.min(9.5, Math.max(5.3, width / 22)));
        const titleLines = pdf.splitTextToSize(node.data.label || t('node.unnamed'), Math.max(4, width - 4));
        pdf.text(titleLines.slice(0, 2), position.x + 2, position.y + headerHeight + 4);
        if (node.data.description && height > 20) {
          const hintStartY = position.y + headerHeight + 4 + Math.min(titleLines.length, 2) * 3.2 + 1.5;
          const hintLines = pdf.splitTextToSize(`${t('node.hint')}: ${node.data.description}`, Math.max(4, width - 4));
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(Math.min(6.2, Math.max(4.1, width / 34)));
          pdf.setTextColor(71, 85, 105);
          pdf.text(hintLines.slice(0, 2), position.x + 2, hintStartY);
        }
        if (node.data.responsibleRole && height > 15) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(Math.min(7, Math.max(4.5, width / 30)));
          pdf.setTextColor(71, 85, 105);
          pdf.text(pdf.splitTextToSize(node.data.responsibleRole, Math.max(4, width - 4)).slice(0, 1), position.x + 2, position.y + height - 3);
        }
      });

      pdf.addPage('a4', 'portrait');
      const detailsPageWidth = pdf.internal.pageSize.getWidth();
      const detailsPageHeight = pdf.internal.pageSize.getHeight();
      const detailMargin = 16;
      let detailY = 18;
      const drawDetailsHeader = () => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(15, 118, 110);
        pdf.text(t('pdf.detailsTitle'), detailMargin, detailY);
        detailY += 9;
      };
      drawDetailsHeader();

      if (arrangedNodes.length === 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(71, 85, 105);
        pdf.text(t('pdf.empty'), detailMargin, detailY + 4);
      }

      arrangedNodes.forEach((node, index) => {
        const [red, green, blue] = hexToRgb(nodeColors[node.data.nodeType]);
        const contentWidth = detailsPageWidth - detailMargin * 2 - 8;
        const titleLines = pdf.splitTextToSize(node.data.label || t('node.unnamed'), contentWidth);
        const responsibilityLines = node.data.responsibleRole ? pdf.splitTextToSize(`${t('node.responsibility')}: ${node.data.responsibleRole}`, contentWidth) : [];
        const durationLines = typeof node.data.estimatedDurationMinutes === 'number'
          ? pdf.splitTextToSize(`${t('node.estimatedDuration')}: ${t('node.estimatedDurationValue', { minutes: node.data.estimatedDurationMinutes })}`, contentWidth)
          : [];
        const resourceLines = node.data.resources?.length
          ? pdf.splitTextToSize(`${t('node.resources')}: ${node.data.resources.join(' · ')}`, contentWidth)
          : [];
        const checklistLines = node.data.checklist?.length
          ? pdf.splitTextToSize(`${t('node.checklist')}: ${node.data.checklist.map((item) => item.label).join(' · ')}`, contentWidth)
          : [];
        const startConditionLines = node.data.startCondition
          ? pdf.splitTextToSize(`${t('node.startCondition')}: ${node.data.startCondition}`, contentWidth)
          : [];
        const completionCriterionLines = node.data.completionCriterion
          ? pdf.splitTextToSize(`${t('node.completionCriterion')}: ${node.data.completionCriterion}`, contentWidth)
          : [];
        const reflectionLines = node.data.description ? pdf.splitTextToSize(`${t('node.reflectionQuestion')}: ${node.data.description}`, contentWidth) : [];
        const pathLines = nodePaths(node.data.nodeType, node.data.paths).length
          ? pdf.splitTextToSize(`${t('node.paths')}: ${nodePaths(node.data.nodeType, node.data.paths).map((path) => path.label).join(' · ')}`, contentWidth)
          : [];
        const itemHeight = 17 + titleLines.length * 4.6 + responsibilityLines.length * 4.3 + durationLines.length * 4.3 + resourceLines.length * 4.3 + checklistLines.length * 4.3 + startConditionLines.length * 4.3 + completionCriterionLines.length * 4.3 + reflectionLines.length * 4.3 + pathLines.length * 4.3;
        if (detailY + itemHeight > detailsPageHeight - detailMargin) {
          pdf.addPage('a4', 'portrait');
          detailY = 18;
          drawDetailsHeader();
        }
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(203, 213, 225);
        pdf.roundedRect(detailMargin, detailY, detailsPageWidth - detailMargin * 2, itemHeight, 2, 2, 'FD');
        pdf.setFillColor(red, green, blue);
        pdf.roundedRect(detailMargin, detailY, 4, itemHeight, 2, 2, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(red, green, blue);
        pdf.text(`${index + 1}. ${t(nodeLabelKeys[node.data.nodeType])}`, detailMargin + 8, detailY + 6);
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(titleLines, detailMargin + 8, detailY + 12);
        let contentY = detailY + 12 + titleLines.length * 4.6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        if (responsibilityLines.length) {
          contentY += 2;
          pdf.text(responsibilityLines, detailMargin + 8, contentY);
          contentY += responsibilityLines.length * 4.3;
        }
        if (durationLines.length) {
          contentY += 2;
          pdf.text(durationLines, detailMargin + 8, contentY);
          contentY += durationLines.length * 4.3;
        }
        if (resourceLines.length) {
          contentY += 2;
          pdf.text(resourceLines, detailMargin + 8, contentY);
          contentY += resourceLines.length * 4.3;
        }
        if (checklistLines.length) {
          contentY += 2;
          pdf.text(checklistLines, detailMargin + 8, contentY);
          contentY += checklistLines.length * 4.3;
        }
        if (startConditionLines.length) {
          contentY += 2;
          pdf.text(startConditionLines, detailMargin + 8, contentY);
          contentY += startConditionLines.length * 4.3;
        }
        if (completionCriterionLines.length) {
          contentY += 2;
          pdf.text(completionCriterionLines, detailMargin + 8, contentY);
          contentY += completionCriterionLines.length * 4.3;
        }
        if (reflectionLines.length) {
          contentY += 2;
          pdf.text(reflectionLines, detailMargin + 8, contentY);
          contentY += reflectionLines.length * 4.3;
        }
        if (pathLines.length) {
          contentY += 2;
          pdf.text(pathLines, detailMargin + 8, contentY);
        }
        detailY += itemHeight + 5;
      });

      const fileName = (title.trim() || selectedProcess.title).replace(/[^\p{L}\p{N}_-]+/gu, '_') || t('pdf.fileFallback');
      pdf.save(`${t('title')}-${fileName}.pdf`);
      showToast(t('messages.pdfCreated'));
    } catch {
      showToast(t('messages.pdfFailed'), { type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const openCreateProcessModal = () => {
    if (!canEdit) return;
    setMetadataTitle(t('newProcess'));
    setMetadataPurpose('');
    setMetadataModal({ mode: 'create' });
  };

  const openEditProcessModal = () => {
    if (!canEdit || !selectedProcess) return;
    setMetadataTitle(title);
    setMetadataPurpose(purpose);
    setMetadataModal({ mode: 'edit' });
  };

  const submitProcessMetadata = async () => {
    if (!canEdit || !metadataModal || !metadataTitle.trim()) return;
    if (metadataModal.mode === 'edit') {
      if (!selectedId) return;
      const definition = toDefinition(nodes, edges);
      const nextTitle = metadataTitle.trim();
      const nextPurpose = metadataPurpose.trim();
      const snapshot = getProcessSnapshot(nextTitle, nextPurpose, definition);
      setTitle(nextTitle);
      setPurpose(nextPurpose);
      queueAutoSave({ processId: selectedId, title: nextTitle, purpose: nextPurpose, definition, snapshot });
      setMetadataModal(null);
      return;
    }

    queueCurrentProcessAutoSave();
    setSaving(true);
    try {
      const created = await createProcess({
        title: metadataTitle.trim(),
        purpose: metadataPurpose.trim() || undefined,
        definition: emptyProcessDefinition(),
      });
      storeProcess(created);
      hydratedProcessIdRef.current = null;
      selectedIdRef.current = created.id;
      setSelectedId(created.id);
      setMetadataModal(null);
      showToast(t('messages.created'));
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      showToast(Array.isArray(message) ? message.join(' ') : message || t('messages.createFailed'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const requestCreate = () => {
    openCreateProcessModal();
  };

  const remove = async () => {
    if (!selectedProcess || !canEdit) return;
    pendingAutoSavesRef.current.delete(selectedProcess.id);
    autoSaveFailuresRef.current.delete(selectedProcess.id);
    setSaving(true);
    try {
      await deleteProcess(selectedProcess.id);
      queryClient.setQueryData<ProcessDto[]>(['processes', scopeKey], (current = []) =>
        current.filter((process) => process.id !== selectedProcess.id),
      );
      savedProcessSnapshotsRef.current.delete(selectedProcess.id);
      inFlightAutoSavesRef.current.delete(selectedProcess.id);
      hydratedProcessIdRef.current = null;
      setDeleteConfirmOpen(false);
      selectedIdRef.current = null;
      setSelectedId(null);
      showToast(t('messages.deleted'));
    } catch {
      showToast(t('messages.deleteFailed'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const nodeEditor = !selectedNode ? (
    <p className="text-sm text-[var(--text-muted)]">{t('node.select')}</p>
  ) : (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-[var(--text-secondary)]">{t('node.type')}
        <Select
          value={selectedNode.data.nodeType}
          disabled={!canEdit}
          onChange={(event) => updateSelectedNode({ nodeType: event.target.value as ProcessNodeType })}
          className="mt-1"
        >
          {(Object.keys(nodeLabelKeys) as ProcessNodeType[]).map((type) => <option key={type} value={type}>{t(nodeLabelKeys[type])}</option>)}
        </Select>
      </label>
      <label className="block text-xs font-medium text-[var(--text-secondary)]">{t('node.title')}
        <Input className="mt-1" value={selectedNode.data.label} disabled={!canEdit} onChange={(event) => updateSelectedNode({ label: event.target.value })} />
      </label>
      {selectedNode.data.nodeType === 'decision' || selectedNode.data.nodeType === 'branch' ? (
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-2.5">
          <div>
            <div className="text-xs font-medium text-[var(--text-secondary)]">{t('node.paths')}</div>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {selectedNode.data.nodeType === 'decision' ? t('node.decisionPathsHint') : t('node.parallelPathsHint')}
            </p>
          </div>
          <div className="space-y-1.5">
            {nodePaths(selectedNode.data.nodeType, selectedNode.data.paths).map((path) => (
              <div key={path.id} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] gap-1.5">
                <Input
                  value={path.label}
                  disabled={!canEdit}
                  aria-label={t('node.pathLabel')}
                  onChange={(event) => updateNodePath(selectedNode.id, path.id, { label: event.target.value })}
                />
                <Select
                  value={path.tone}
                  disabled={!canEdit}
                  aria-label={t('node.pathTone')}
                  onChange={(event) => updateNodePath(selectedNode.id, path.id, { tone: event.target.value as ProcessPathTone })}
                >
                  <option value="positive">{t('node.pathPositive')}</option>
                  <option value="negative">{t('node.pathNegative')}</option>
                  <option value="neutral">{t('node.pathNeutral')}</option>
                </Select>
                <DeleteIconButton
                  aria-label={t('node.removePath')}
                  title={t('node.removePath')}
                  size="icon-compact"
                  disabled={!canEdit || nodePaths(selectedNode.data.nodeType, selectedNode.data.paths).length <= 1}
                  onClick={() => removeNodePath(selectedNode.id, path.id)}
                />
              </div>
            ))}
          </div>
          {canEdit ? <Button size="sm" variant="secondary" onClick={() => addNodePath(selectedNode.id)}><Plus className="h-4 w-4" /> {t('node.addPath')}</Button> : null}
        </div>
      ) : null}
      {selectedNode.data.nodeType === 'subprocess' ? (
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-2.5">
          <label className="block text-xs font-medium text-[var(--text-secondary)]">{t('node.linkedSubprocess')}
            <Select
              value={selectedNode.data.linkedProcessId || ''}
              disabled={!canEdit}
              onChange={(event) => {
                const linkedProcess = processes.find((process) => process.id === event.target.value);
                updateSelectedNode({
                  linkedProcessId: linkedProcess?.id,
                  label: linkedProcess?.title || t(nodeLabelKeys.subprocess),
                });
              }}
              className="mt-1"
            >
              <option value="">{t('node.notLinked')}</option>
              {processes.filter((process) => process.id !== selectedProcess?.id).map((process) => <option key={process.id} value={process.id}>{process.title}</option>)}
            </Select>
          </label>
          {canEdit ? <Button size="sm" variant="secondary" disabled={saving} onClick={() => void createLinkedSubprocess()}><Plus className="h-4 w-4" /> {t('node.createSubprocess')}</Button> : null}
          {selectedNode.data.linkedProcessId ? <Button size="sm" variant="ghost" onClick={() => selectProcess(selectedNode.data.linkedProcessId!)}><ExternalLink className="h-4 w-4" /> {t('node.openSubprocess')}</Button> : null}
        </div>
      ) : null}
      {selectedNode.data.nodeType === 'file' ? (
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-2.5">
          <label className="block text-xs font-medium text-[var(--text-secondary)]">{t('node.addFile')}
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
              disabled={!canEdit || saving}
              className="mt-1"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFileToSelectedNode(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <p className="text-xs text-[var(--text-muted)]">{t('node.fileHint')}</p>
          {selectedNode.data.fileUrl ? <Button size="sm" variant="ghost" onClick={() => void openProcessFile(selectedNode.data.fileUrl!)}><ExternalLink className="h-4 w-4" /> {t('node.openFile')}</Button> : null}
        </div>
      ) : null}
      <label className="block text-xs font-medium text-[var(--text-secondary)]">{t('node.responsibility')}
        <Input className="mt-1" value={selectedNode.data.responsibleRole || ''} disabled={!canEdit} onChange={(event) => updateSelectedNode({ responsibleRole: event.target.value })} placeholder={t('node.responsibilityPlaceholder')} />
      </label>
      <label className="block text-xs font-medium text-[var(--text-secondary)]">{t('node.reflectionQuestion')}
        <Textarea value={selectedNode.data.description || ''} disabled={!canEdit} onChange={(event) => updateSelectedNode({ description: event.target.value })} className="mt-1 min-h-24" />
      </label>
      <div className="process-o-step-additional">
        <div className="process-o-step-additional-heading">{t('node.additionalDetails')}</div>
        {typeof selectedNode.data.estimatedDurationMinutes === 'number' || expandedStepModules[selectedNode.id]?.duration ? (
          <div className="process-o-step-module" style={{ order: selectedNodeModuleOrder.indexOf('duration') + 1 }}>
            <div className="process-o-step-module-header">
              <label className="text-xs font-medium text-[var(--text-secondary)]" htmlFor={`process-duration-${selectedNode.id}`}>{t('node.estimatedDuration')}</label>
              {canEdit ? (
                <IconButton
                  aria-label={t('node.removeDuration')}
                  title={t('node.removeDuration')}
                  size="icon-compact"
                  variant="ghost"
                  className="process-o-step-module-remove"
                  onClick={() => {
                    updateSelectedNode({ estimatedDurationMinutes: undefined });
                    hideStepModule(selectedNode.id, 'duration');
                  }}
                ><X className="h-4 w-4" /></IconButton>
              ) : null}
            </div>
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <Input
                id={`process-duration-${selectedNode.id}`}
                type="number"
                min={1}
                max={10_080}
                step={5}
                inputMode="numeric"
                disabled={!canEdit}
                value={selectedNode.data.estimatedDurationMinutes ?? ''}
                onChange={(event) => {
                  const value = event.target.value === '' ? undefined : Math.round(Number(event.target.value));
                  updateSelectedNode({
                    estimatedDurationMinutes: typeof value === 'number' && Number.isFinite(value)
                      ? Math.min(10_080, Math.max(1, value))
                      : undefined,
                  });
                }}
              />
              <span className="text-xs text-[var(--text-muted)]">{t('node.minutes')}</span>
            </div>
          </div>
        ) : null}
        {selectedNode.data.resources?.length || expandedStepModules[selectedNode.id]?.resources ? (
          <div className="process-o-step-module" style={{ order: selectedNodeModuleOrder.indexOf('resources') + 1 }}>
            <div className="process-o-step-module-header">
              <div className="text-xs font-medium text-[var(--text-secondary)]">{t('node.resources')}</div>
              {canEdit ? <IconButton aria-label={t('node.removeResources')} title={t('node.removeResources')} size="icon-compact" variant="ghost" className="process-o-step-module-remove" onClick={() => { updateSelectedNode({ resources: undefined }); hideStepModule(selectedNode.id, 'resources'); }}><X className="h-4 w-4" /></IconButton> : null}
            </div>
            {selectedNode.data.resources?.length ? (
              <div className="process-o-step-list mt-2">
                {selectedNode.data.resources.map((resource) => (
                  <div key={resource} className="process-o-step-list-row">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{resource}</span>
                    {canEdit ? <IconButton aria-label={t('node.removeResource', { resource })} title={t('node.removeResource', { resource })} size="icon-compact" variant="ghost" className="process-o-step-list-remove" onClick={() => updateSelectedNode({ resources: selectedNode.data.resources?.filter((item) => item !== resource) })}><X className="h-3.5 w-3.5" /></IconButton> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {canEdit ? (
              <div className="mt-2 flex gap-1.5">
                <Input value={resourceDraft} placeholder={t('node.resourcePlaceholder')} onChange={(event) => setResourceDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addNodeResource(selectedNode.id, resourceDraft); setResourceDraft(''); } }} />
                <Button size="sm" variant="secondary" disabled={!resourceDraft.trim()} onClick={() => { addNodeResource(selectedNode.id, resourceDraft); setResourceDraft(''); }}><Plus className="h-4 w-4" /><span className="sr-only">{t('node.addResource')}</span></Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {selectedNode.data.checklist?.length || expandedStepModules[selectedNode.id]?.checklist ? (
          <div className="process-o-step-module" style={{ order: selectedNodeModuleOrder.indexOf('checklist') + 1 }}>
            <div className="process-o-step-module-header">
              <div className="text-xs font-medium text-[var(--text-secondary)]">{t('node.checklist')}</div>
              {canEdit ? <IconButton aria-label={t('node.removeChecklist')} title={t('node.removeChecklist')} size="icon-compact" variant="ghost" className="process-o-step-module-remove" onClick={() => { updateSelectedNode({ checklist: undefined }); hideStepModule(selectedNode.id, 'checklist'); }}><X className="h-4 w-4" /></IconButton> : null}
            </div>
            {selectedNode.data.checklist?.length ? (
              <div className="process-o-step-list mt-2">
                {selectedNode.data.checklist.map((item) => (
                  <div key={item.id} className="process-o-step-list-row">
                    <CheckSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                    {canEdit ? <IconButton aria-label={t('node.removeChecklistItem', { item: item.label })} title={t('node.removeChecklistItem', { item: item.label })} size="icon-compact" variant="ghost" className="process-o-step-list-remove" onClick={() => updateSelectedNode({ checklist: selectedNode.data.checklist?.filter((current) => current.id !== item.id) })}><X className="h-3.5 w-3.5" /></IconButton> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {canEdit ? (
              <div className="mt-2 flex gap-1.5">
                <Input value={checklistDraft} placeholder={t('node.checklistPlaceholder')} onChange={(event) => setChecklistDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addNodeChecklistItem(selectedNode.id, checklistDraft); setChecklistDraft(''); } }} />
                <Button size="sm" variant="secondary" disabled={!checklistDraft.trim()} onClick={() => { addNodeChecklistItem(selectedNode.id, checklistDraft); setChecklistDraft(''); }}><Plus className="h-4 w-4" /><span className="sr-only">{t('node.addChecklistItem')}</span></Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {selectedNode.data.startCondition || expandedStepModules[selectedNode.id]?.startCondition ? (
          <div className="process-o-step-module" style={{ order: selectedNodeModuleOrder.indexOf('startCondition') + 1 }}>
            <div className="process-o-step-module-header">
              <label className="text-xs font-medium text-[var(--text-secondary)]" htmlFor={`process-start-condition-${selectedNode.id}`}>{t('node.startCondition')}</label>
              {canEdit ? <IconButton aria-label={t('node.removeStartCondition')} title={t('node.removeStartCondition')} size="icon-compact" variant="ghost" className="process-o-step-module-remove" onClick={() => { updateSelectedNode({ startCondition: undefined }); hideStepModule(selectedNode.id, 'startCondition'); }}><X className="h-4 w-4" /></IconButton> : null}
            </div>
            <Textarea id={`process-start-condition-${selectedNode.id}`} value={selectedNode.data.startCondition || ''} disabled={!canEdit} onChange={(event) => updateSelectedNode({ startCondition: event.target.value })} className="mt-1 min-h-20" placeholder={t('node.startConditionPlaceholder')} />
          </div>
        ) : null}
        {selectedNode.data.completionCriterion || expandedStepModules[selectedNode.id]?.completionCriterion ? (
          <div className="process-o-step-module" style={{ order: selectedNodeModuleOrder.indexOf('completionCriterion') + 1 }}>
            <div className="process-o-step-module-header">
              <label className="text-xs font-medium text-[var(--text-secondary)]" htmlFor={`process-completion-criterion-${selectedNode.id}`}>{t('node.completionCriterion')}</label>
              {canEdit ? <IconButton aria-label={t('node.removeCompletionCriterion')} title={t('node.removeCompletionCriterion')} size="icon-compact" variant="ghost" className="process-o-step-module-remove" onClick={() => { updateSelectedNode({ completionCriterion: undefined }); hideStepModule(selectedNode.id, 'completionCriterion'); }}><X className="h-4 w-4" /></IconButton> : null}
            </div>
            <Textarea id={`process-completion-criterion-${selectedNode.id}`} value={selectedNode.data.completionCriterion || ''} disabled={!canEdit} onChange={(event) => updateSelectedNode({ completionCriterion: event.target.value })} className="mt-1 min-h-20" placeholder={t('node.completionCriterionPlaceholder')} />
          </div>
        ) : null}
        {canEdit ? (
          <div className="process-o-step-module-triggers" style={{ order: stepModules.length + 1 }}>
            {!expandedStepModules[selectedNode.id]?.duration && typeof selectedNode.data.estimatedDurationMinutes !== 'number' ? <Button size="sm" variant="secondary" className="process-o-step-module-trigger" onClick={() => showStepModule(selectedNode.id, 'duration')}><Plus className="h-3.5 w-3.5" /> <Clock3 className="h-3.5 w-3.5" /> {t('node.addDuration')}</Button> : null}
            {!expandedStepModules[selectedNode.id]?.resources && !selectedNode.data.resources?.length ? <Button size="sm" variant="secondary" className="process-o-step-module-trigger" onClick={() => showStepModule(selectedNode.id, 'resources')}><Plus className="h-3.5 w-3.5" /> <Paperclip className="h-3.5 w-3.5" /> {t('node.addResources')}</Button> : null}
            {!expandedStepModules[selectedNode.id]?.checklist && !selectedNode.data.checklist?.length ? <Button size="sm" variant="secondary" className="process-o-step-module-trigger" onClick={() => showStepModule(selectedNode.id, 'checklist')}><Plus className="h-3.5 w-3.5" /> <CheckSquare className="h-3.5 w-3.5" /> {t('node.addChecklist')}</Button> : null}
            {!expandedStepModules[selectedNode.id]?.startCondition && !selectedNode.data.startCondition ? <Button size="sm" variant="secondary" className="process-o-step-module-trigger" onClick={() => showStepModule(selectedNode.id, 'startCondition')}><Plus className="h-3.5 w-3.5" /> {t('node.addStartCondition')}</Button> : null}
            {!expandedStepModules[selectedNode.id]?.completionCriterion && !selectedNode.data.completionCriterion ? <Button size="sm" variant="secondary" className="process-o-step-module-trigger" onClick={() => showStepModule(selectedNode.id, 'completionCriterion')}><Plus className="h-3.5 w-3.5" /> {t('node.addCompletionCriterion')}</Button> : null}
          </div>
        ) : null}
      </div>
      {canEdit ? <Button size="sm" variant="danger-ghost" onClick={() => removeStep(selectedNode.id)}><Trash2 className="h-4 w-4" /> {t('node.remove')}</Button> : null}
    </div>
  );

  if (access.isLoading) {
    return <div className="flex min-h-48 items-center justify-center text-[var(--text-muted)]"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('loading')}</div>;
  }

  if (!access.data?.enabled) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-8 text-center shadow-sm">
        <GitBranch className="mx-auto mb-3 h-10 w-10 text-viridian" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('disabledTitle')}</h1>
        <p className="mt-2 text-[var(--text-secondary)]">{t('disabledDescription')}</p>
      </div>
    );
  }

  return (
    <div className="process-o-page">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={canEdit ? <CreateButton disabled={saving} onClick={requestCreate}>{t('newProcess')}</CreateButton> : undefined}
      />
      <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="px-1 py-2">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t('listHeading')}</div>
          {processesQuery.isLoading ? <div className="p-3 text-sm text-[var(--text-muted)]">{t('loading')}</div> : null}
          {!processesQuery.isLoading && processes.length === 0 ? (
            <div className="p-3 text-sm text-[var(--text-muted)]">{t('empty')}</div>
          ) : null}
          <div className="space-y-1">
            {processes.map((process) => {
              const isSelected = process.id === selectedId;
              return (
                <div key={process.id} className={`process-o-template ${isSelected ? 'process-o-template-selected' : ''}`}>
                  <button
                    type="button"
                    onClick={() => selectProcess(process.id)}
                    className={`process-o-template-main w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${isSelected ? 'bg-[var(--interactive-soft-strong)] text-viridian' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}`}
                  >
                    <span className="block truncate font-semibold">{process.title}</span>
                  </button>
                  {isSelected && canEdit ? (
                    <div className="process-o-template-actions">
                      <IconButton
                        aria-label={t('actions.editDetails')}
                        title={t('actions.editDetails')}
                        size="icon-compact"
                        variant="ghost"
                        className="process-o-template-edit"
                        onClick={openEditProcessModal}
                      >
                        <Pencil aria-hidden="true" />
                      </IconButton>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0">
          {!selectedProcess ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center text-[var(--text-muted)]">
              <FilePlus2 className="mb-3 h-10 w-10 text-viridian" />
              <p>{t('emptySelection')}</p>
            </div>
          ) : (
            <div>
              <div ref={canvasRef} className={`process-o-canvas process-o-canvas-expanded overflow-hidden rounded-xl border border-[var(--border-subtle)] ${isFullscreen ? 'process-o-canvas-fullscreen' : ''}`}>
                  <ReactFlow
                    onInit={(instance) => { flowInstanceRef.current = instance; }}
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={handleEdgesChange}
                    onConnect={onConnect}
                    onNodeDragStart={handleNodeDragStart}
                    onSelectionChange={({ nodes: selection }) => setSelectedNodeId(selection[0]?.id || null)}
                    nodesDraggable={canEdit}
                    nodesConnectable={canEdit}
                    fitView
                    minZoom={0.2}
                    colorMode={isDarkTheme ? 'dark' : 'light'}
                    defaultEdgeOptions={{ type: 'process-edge', style: workflowEdgeStyle }}
                  >
                    <Background gap={16} size={1} color="var(--process-canvas-grid)" />
                    <Controls showInteractive={false} />
                    <MiniMap
                      nodeColor={(node) => nodeColors[(node.data as FlowNodeData).nodeType] || '#6b9080'}
                      nodeStrokeColor="var(--process-canvas-minimap-stroke)"
                      nodeBorderRadius={8}
                      bgColor="var(--process-canvas-minimap-bg)"
                      maskColor="var(--process-canvas-minimap-mask)"
                    />
                    <Panel position="top-right" className="flex gap-2">
                      <IconButton
                        aria-label={t('actions.exportPdf')}
                        title={t('actions.exportPdf')}
                        variant="secondary"
                        className="process-o-fullscreen-button"
                        disabled={exporting}
                        onClick={() => void exportPdf()}
                      >
                        <FileDown aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        aria-label={isFullscreen ? t('actions.leaveFullscreen') : t('actions.fullscreen')}
                        title={isFullscreen ? t('actions.leaveFullscreen') : t('actions.fullscreen')}
                        variant="secondary"
                        className="process-o-fullscreen-button"
                        onClick={() => void toggleFullscreen()}
                      >
                        {isFullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
                      </IconButton>
                    </Panel>
                    {canEdit ? (
                      <Panel position="bottom-right" className="process-o-auto-layout-panel">
                        <IconButton
                          aria-label={t('actions.undo')}
                          title={t('actions.undo')}
                          size="icon"
                          variant="secondary"
                          className="process-o-auto-layout-button"
                          disabled={undoCount === 0}
                          onClick={undoWorkflow}
                        >
                          <Undo2 aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          aria-label={t('actions.autoArrange')}
                          title={t('actions.autoArrange')}
                          size="icon"
                          variant="secondary"
                          className="process-o-auto-layout-button"
                          disabled={layouting || nodes.length === 0}
                          onClick={() => void autoArrange()}
                        >
                          <LayoutPanelTop aria-hidden="true" />
                        </IconButton>
                      </Panel>
                    ) : null}
                    {canEdit ? (
                      <Panel position="bottom-center" className="process-o-fullscreen-palette">
                        <div className="process-o-fullscreen-palette-inner" role="toolbar" aria-label={t('node.add', { type: '' }).trim()}>
                          {(Object.keys(nodeLabelKeys) as ProcessNodeType[]).map((nodeType) => {
                            const NodeIcon = nodeIcons[nodeType];
                            return (
                              <IconButton
                                key={nodeType}
                                aria-label={t('node.add', { type: t(nodeLabelKeys[nodeType]) })}
                                data-tooltip={t('node.add', { type: t(nodeLabelKeys[nodeType]) })}
                                title={t('node.add', { type: t(nodeLabelKeys[nodeType]) })}
                                size="icon"
                                variant="secondary"
                                className="process-o-fullscreen-palette-button process-o-icon-tooltip"
                                onClick={() => addNode(nodeType)}
                              >
                                <NodeIcon style={{ color: nodeColors[nodeType] }} aria-hidden="true" />
                              </IconButton>
                            );
                          })}
                        </div>
                      </Panel>
                    ) : null}
                    {selectedNode ? (
                      <Panel position="top-left" className="process-o-canvas-editor process-o-node-editor">
                        <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{t('node.edit')}</div>
                        {nodeEditor}
                      </Panel>
                    ) : null}
                  </ReactFlow>
              </div>
            </div>
          )}
        </section>
      </div>
      <Modal
        open={metadataModal !== null}
        title={metadataModal?.mode === 'create' ? t('metadata.createTitle') : t('metadata.editTitle')}
        onClose={() => setMetadataModal(null)}
        variant="form"
        maxWidth="md"
      >
        <div className="modal-editor-body space-y-4 px-4 py-4 md:px-6 md:py-5">
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            {t('metadata.title')}
            <Input
              className="mt-1.5"
              value={metadataTitle}
              autoFocus
              onChange={(event) => setMetadataTitle(event.target.value)}
              placeholder={t('metadata.titlePlaceholder')}
            />
          </label>
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            {t('metadata.description')} <span className="font-normal text-[var(--text-muted)]">({t('metadata.optional')})</span>
            <Textarea
              className="mt-1.5 min-h-28"
              value={metadataPurpose}
              onChange={(event) => setMetadataPurpose(event.target.value)}
              placeholder={t('metadata.descriptionPlaceholder')}
            />
          </label>
        </div>
        <footer className="flex flex-col gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 pb-safe md:flex-row md:items-center md:justify-end md:px-6">
          {metadataModal?.mode === 'edit' ? (
            <DeleteIconButton
              aria-label={t('actions.deleteProcess')}
              title={t('actions.deleteProcess')}
              size="icon-compact"
              className="md:mr-auto"
              disabled={saving || isCurrentProcessAutoSaving}
              onClick={() => {
                setMetadataModal(null);
                setDeleteConfirmOpen(true);
              }}
            />
          ) : null}
          <Button variant="secondary" onClick={() => setMetadataModal(null)}>{t('cancel')}</Button>
          <Button disabled={saving || !metadataTitle.trim()} onClick={() => void submitProcessMetadata()}>
            <Save aria-hidden="true" />
            {metadataModal?.mode === 'create' ? t('metadata.create') : t('metadata.apply')}
          </Button>
        </footer>
      </Modal>
      <ConfirmModal
        open={deleteConfirmOpen}
        title={t('actions.deleteProcess')}
        message={
          <div className="space-y-2">
            <p>{t('deleteConfirmation.question', { title: selectedProcess?.title })}</p>
            <p className="text-sm text-[var(--text-muted)]">{t('deleteConfirmation.notice')}</p>
          </div>
        }
        confirmLabel={t('actions.deleteProcess')}
        cancelLabel={t('cancel')}
        primaryAction="secondary"
        onConfirm={() => void remove()}
        onCancel={() => setDeleteConfirmOpen(false)}
        confirmDisabled={saving || isCurrentProcessAutoSaving}
      />
    </div>
  );
}
