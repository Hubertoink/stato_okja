import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { HelpCircle, FilePlus2, GitBranch, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, CreateButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useToast } from '@/components/Toast';
import { useOrgScopeKey } from '@/lib/orgScope';
import {
  createProcess,
  deleteProcess,
  emptyProcessDefinition,
  listProcesses,
  type ProcessDefinition,
  type ProcessDto,
  type ProcessNodeType,
  updateProcess,
  useProcessOAccess,
} from '@/lib/processes';

type FlowNodeData = {
  label: string;
  description?: string;
  responsibleRole?: string;
  nodeType: ProcessNodeType;
};
type FlowNode = Node<FlowNodeData, 'process'>;

const nodeLabels: Record<ProcessNodeType, string> = {
  input: 'Input',
  activity: 'Aktivität',
  decision: 'Entscheidung',
  output: 'Output',
  outcome: 'Wirkung',
  reflection: 'Reflexion',
};

const nodeColors: Record<ProcessNodeType, string> = {
  input: '#2563eb',
  activity: '#0f766e',
  decision: '#c2410c',
  output: '#7c3aed',
  outcome: '#be185d',
  reflection: '#a16207',
};

function nodeId() {
  return globalThis.crypto?.randomUUID?.() || `process-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toFlowNodes(definition: ProcessDefinition): FlowNode[] {
  return definition.nodes.map((node) => ({
    id: node.id,
    type: 'process',
    position: node.position,
    data: { ...node.data, nodeType: node.type },
  }));
}

function toFlowEdges(definition: ProcessDefinition): Edge[] {
  return definition.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
  }));
}

function toDefinition(nodes: FlowNode[], edges: Edge[]): ProcessDefinition {
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
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(typeof edge.label === 'string' && edge.label.trim() ? { label: edge.label } : {}),
    })),
  };
}

const ProcessNodeCard = memo(({ data, selected }: NodeProps<FlowNode>) => {
  const color = nodeColors[data.nodeType];
  return (
    <div
      className={`min-w-44 rounded-xl border bg-[var(--surface-1)] shadow-sm ${selected ? 'ring-2 ring-viridian' : ''}`}
      style={{ borderColor: `${color}80` }}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5" style={{ background: color }} />
      <div className="rounded-t-xl px-3 py-1.5 text-xs font-semibold text-white" style={{ background: color }}>
        {nodeLabels[data.nodeType]}
      </div>
      <div className="px-3 py-2">
        <div className="font-semibold text-[var(--text-primary)]">{data.label || 'Unbenannter Schritt'}</div>
        {data.responsibleRole ? <div className="mt-1 text-xs text-[var(--text-muted)]">{data.responsibleRole}</div> : null}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5" style={{ background: color }} />
    </div>
  );
});
ProcessNodeCard.displayName = 'ProcessNodeCard';

export default function Processes() {
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
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);

  const processes = processesQuery.data || [];
  const selectedProcess = processes.find((process) => process.id === selectedId) || null;
  const canEdit = access.data?.canEdit === true;
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const nodeTypes = useMemo(() => ({ process: ProcessNodeCard }), []);

  useEffect(() => {
    if (!selectedId && processes[0]) setSelectedId(processes[0].id);
    if (selectedId && !processes.some((process) => process.id === selectedId)) {
      setSelectedId(processes[0]?.id || null);
    }
  }, [processes, selectedId]);

  useEffect(() => {
    if (!selectedProcess) {
      setTitle('');
      setPurpose('');
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      return;
    }
    setTitle(selectedProcess.title);
    setPurpose(selectedProcess.purpose || '');
    setNodes(toFlowNodes(selectedProcess.definition || emptyProcessDefinition()));
    setEdges(toFlowEdges(selectedProcess.definition || emptyProcessDefinition()));
    setSelectedNodeId(null);
  }, [selectedProcess, setEdges, setNodes]);

  const storeProcess = useCallback((updated: ProcessDto) => {
    queryClient.setQueryData<ProcessDto[]>(['processes', scopeKey], (current = []) =>
      current.some((process) => process.id === updated.id)
        ? current.map((process) => (process.id === updated.id ? updated : process))
        : [updated, ...current],
    );
  }, [queryClient, scopeKey]);

  const onConnect = useCallback((connection: Connection) => {
    if (!canEdit) return;
    setEdges((current) => addEdge({ ...connection, id: nodeId(), type: 'smoothstep' }, current));
  }, [canEdit, setEdges]);

  const addNode = (nodeType: ProcessNodeType) => {
    if (!canEdit) return;
    const offset = nodes.length * 24;
    const id = nodeId();
    setNodes((current) => [...current, {
      id,
      type: 'process',
      position: { x: 120 + offset, y: 120 + offset },
      data: { label: nodeLabels[nodeType], nodeType },
    }]);
    setSelectedNodeId(id);
  };

  const updateSelectedNode = (patch: Partial<FlowNodeData>) => {
    if (!selectedNodeId || !canEdit) return;
    setNodes((current) => current.map((node) =>
      node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node,
    ));
  };

  const save = async () => {
    if (!selectedProcess || !canEdit) return;
    if (!title.trim()) {
      showToast('Bitte gib dem Prozess einen Titel.', { type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProcess(selectedProcess.id, {
        title: title.trim(),
        purpose: purpose.trim() || null,
        definition: toDefinition(nodes, edges),
      });
      storeProcess(updated);
      showToast('Prozess gespeichert.');
    } catch {
      showToast('Der Prozess konnte nicht gespeichert werden.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const created = await createProcess({ title: 'Neuer Prozess', definition: emptyProcessDefinition() });
      storeProcess(created);
      setSelectedId(created.id);
      showToast('Neuer Prozess angelegt.');
    } catch {
      showToast('Der Prozess konnte nicht angelegt werden.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedProcess || !canEdit) return;
    if (!window.confirm(`„${selectedProcess.title}“ wirklich löschen?`)) return;
    setSaving(true);
    try {
      await deleteProcess(selectedProcess.id);
      queryClient.setQueryData<ProcessDto[]>(['processes', scopeKey], (current = []) =>
        current.filter((process) => process.id !== selectedProcess.id),
      );
      setSelectedId(null);
      showToast('Prozess gelöscht.');
    } catch {
      showToast('Der Prozess konnte nicht gelöscht werden.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (access.isLoading) {
    return <div className="flex min-h-48 items-center justify-center text-[var(--text-muted)]"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> ProzessO wird geladen …</div>;
  }

  if (!access.data?.enabled) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-8 text-center shadow-sm">
        <GitBranch className="mx-auto mb-3 h-10 w-10 text-viridian" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">ProzessO ist nicht freigeschaltet</h1>
        <p className="mt-2 text-[var(--text-secondary)]">Ein Superadmin kann ProzessO für diese Organisation in der Organisationsverwaltung aktivieren.</p>
      </div>
    );
  }

  return (
    <div className="process-o-page">
      <PageHeader
        title="ProzessO"
        description="Prozesse gemeinsam klären, visualisieren und reflektieren."
        actions={canEdit ? <CreateButton disabled={saving} onClick={() => void create()}>Neuer Prozess</CreateButton> : undefined}
      />
      <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 shadow-sm">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Prozessvorlagen</div>
          {processesQuery.isLoading ? <div className="p-3 text-sm text-[var(--text-muted)]">Lädt …</div> : null}
          {!processesQuery.isLoading && processes.length === 0 ? (
            <div className="p-3 text-sm text-[var(--text-muted)]">Noch keine Prozessvorlage vorhanden.</div>
          ) : null}
          <div className="space-y-1">
            {processes.map((process) => (
              <button
                key={process.id}
                type="button"
                onClick={() => setSelectedId(process.id)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${process.id === selectedId ? 'bg-[var(--interactive-soft-strong)] text-viridian' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}`}
              >
                <span className="block truncate font-semibold">{process.title}</span>
                <span className="block truncate text-xs opacity-75">{process.purpose || 'Ohne Beschreibung'}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 shadow-sm">
          {!selectedProcess ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center text-[var(--text-muted)]">
              <FilePlus2 className="mb-3 h-10 w-10 text-viridian" />
              <p>Wähle eine Vorlage oder lege einen neuen Prozess an.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <Input value={title} disabled={!canEdit} onChange={(event) => setTitle(event.target.value)} aria-label="Prozesstitel" />
                  <textarea
                    value={purpose}
                    disabled={!canEdit}
                    onChange={(event) => setPurpose(event.target.value)}
                    placeholder="Wozu dient dieser Prozess?"
                    className="min-h-18 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                {canEdit ? (
                  <div className="flex gap-2 md:flex-col">
                    <Button disabled={saving} onClick={() => void save()}><Save className="h-4 w-4" /> Speichern</Button>
                    <Button disabled={saving} variant="danger-ghost" onClick={() => void remove()}><Trash2 className="h-4 w-4" /> Löschen</Button>
                  </div>
                ) : null}
              </div>

              {canEdit ? (
                <div className="flex flex-wrap gap-2 rounded-xl bg-[var(--surface-2)] p-2">
                  {(Object.keys(nodeLabels) as ProcessNodeType[]).map((nodeType) => (
                    <Button key={nodeType} size="sm" variant="secondary" onClick={() => addNode(nodeType)}>
                      <Plus className="h-3.5 w-3.5" /> {nodeLabels[nodeType]}
                    </Button>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="process-o-canvas min-h-[32rem] overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onSelectionChange={({ nodes: selection }) => setSelectedNodeId(selection[0]?.id || null)}
                    nodesDraggable={canEdit}
                    nodesConnectable={canEdit}
                    fitView
                    minZoom={0.2}
                  >
                    <Background gap={16} size={1} />
                    <Controls showInteractive={false} />
                    <MiniMap nodeColor={(node) => nodeColors[(node.data as FlowNodeData).nodeType] || '#6b9080'} />
                  </ReactFlow>
                </div>

                <aside className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><HelpCircle className="h-4 w-4 text-viridian" /> Schritt bearbeiten</div>
                  {!selectedNode ? <p className="text-sm text-[var(--text-muted)]">Wähle einen Prozessschritt im Diagramm aus.</p> : (
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-[var(--text-secondary)]">Typ
                        <select
                          value={selectedNode.data.nodeType}
                          disabled={!canEdit}
                          onChange={(event) => updateSelectedNode({ nodeType: event.target.value as ProcessNodeType })}
                          className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input-bg)] px-2 py-2 text-sm"
                        >
                          {(Object.keys(nodeLabels) as ProcessNodeType[]).map((type) => <option key={type} value={type}>{nodeLabels[type]}</option>)}
                        </select>
                      </label>
                      <label className="block text-xs font-medium text-[var(--text-secondary)]">Titel
                        <Input className="mt-1" value={selectedNode.data.label} disabled={!canEdit} onChange={(event) => updateSelectedNode({ label: event.target.value })} />
                      </label>
                      <label className="block text-xs font-medium text-[var(--text-secondary)]">Verantwortung
                        <Input className="mt-1" value={selectedNode.data.responsibleRole || ''} disabled={!canEdit} onChange={(event) => updateSelectedNode({ responsibleRole: event.target.value })} placeholder="z. B. Teamleitung" />
                      </label>
                      <label className="block text-xs font-medium text-[var(--text-secondary)]">Hinweis / Reflexionsfrage
                        <textarea value={selectedNode.data.description || ''} disabled={!canEdit} onChange={(event) => updateSelectedNode({ description: event.target.value })} className="mt-1 min-h-24 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input-bg)] px-2 py-2 text-sm" />
                      </label>
                      {canEdit ? <Button size="sm" variant="danger-ghost" onClick={() => {
                        setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
                        setEdges((current) => current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
                        setSelectedNodeId(null);
                      }}><Trash2 className="h-4 w-4" /> Schritt entfernen</Button> : null}
                    </div>
                  )}
                </aside>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
