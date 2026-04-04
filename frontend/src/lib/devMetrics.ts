import { useSyncExternalStore } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { devToolsFeatureEnabled } from './devToolsConfig';

export type DevMetricKind = 'http' | 'query' | 'flow';
export type DevMetricStatus = 'start' | 'success' | 'error' | 'info' | 'cancelled';
export type DevFlowStatus = 'running' | 'success' | 'error' | 'cancelled';

export interface DevMetricEvent {
  id: string;
  timestamp: number;
  kind: DevMetricKind;
  status: DevMetricStatus;
  name: string;
  durationMs?: number;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface DevFlowMark {
  label: string;
  timestamp: number;
  sinceStartMs: number;
  meta?: Record<string, unknown>;
}

export interface DevFlowRun {
  id: string;
  name: string;
  status: DevFlowStatus;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  meta?: Record<string, unknown>;
  marks: DevFlowMark[];
}

type DevMetricsState = {
  enabled: boolean;
  events: DevMetricEvent[];
  flows: DevFlowRun[];
  updatedAt: number;
};

const MAX_EVENTS = 300;
const MAX_FLOWS = 80;
const ENABLED_STORAGE_KEY = 'stato:dev-metrics:enabled';

const listeners = new Set<() => void>();
let idCounter = 0;
let queryMetricsAttached = false;

function readInitialEnabled(): boolean {
  if (!devToolsFeatureEnabled) return false;
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(ENABLED_STORAGE_KEY);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    // ignore storage access problems
  }
  return true;
}

let state: DevMetricsState = {
  enabled: readInitialEnabled(),
  events: [],
  flows: [],
  updatedAt: Date.now(),
};

function emit() {
  state = { ...state, updatedAt: Date.now() };
  listeners.forEach((listener) => listener());
}

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function pushLimitedFront<T>(items: T[], nextItem: T, limit: number): T[] {
  return [nextItem, ...items].slice(0, limit);
}

function roundDuration(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.round(value * 10) / 10;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function previewValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'string') return value.length > 48 ? `${value.slice(0, 45)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const preview = value.slice(0, 3).map((entry) => previewValue(entry)).join(', ');
    return `[${preview}${value.length > 3 ? ', ...' : ''}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    const preview = keys
      .slice(0, 3)
      .map((key) => `${key}:${previewValue(record[key])}`)
      .join(', ');
    return `{${preview}${keys.length > 3 ? ', ...' : ''}}`;
  }
  return typeof value;
}

export function describeQueryKey(queryKey: unknown): string {
  if (!Array.isArray(queryKey)) return previewValue(queryKey);
  return queryKey.slice(0, 4).map((entry) => previewValue(entry)).join(' / ');
}

export function addDevMetricEvent(input: Omit<DevMetricEvent, 'id' | 'timestamp'>): DevMetricEvent | null {
  if (!devToolsFeatureEnabled || !state.enabled) return null;
  const event: DevMetricEvent = {
    id: nextId('evt'),
    timestamp: Date.now(),
    durationMs: roundDuration(input.durationMs),
    ...input,
  };
  state = {
    ...state,
    events: pushLimitedFront(state.events, event, MAX_EVENTS),
  };
  emit();
  return event;
}

export function startDevFlow(name: string, meta?: Record<string, unknown>): string | null {
  if (!devToolsFeatureEnabled || !state.enabled) return null;
  const flow: DevFlowRun = {
    id: nextId('flow'),
    name,
    status: 'running',
    startedAt: Date.now(),
    meta,
    marks: [],
  };
  state = {
    ...state,
    flows: pushLimitedFront(state.flows, flow, MAX_FLOWS),
  };
  emit();
  addDevMetricEvent({ kind: 'flow', status: 'start', name, meta });
  return flow.id;
}

export function markDevFlow(id: string | null | undefined, label: string, meta?: Record<string, unknown>) {
  if (!id || !devToolsFeatureEnabled || !state.enabled) return;
  let didUpdate = false;
  state = {
    ...state,
    flows: state.flows.map((flow) => {
      if (flow.id !== id) return flow;
      didUpdate = true;
      return {
        ...flow,
        marks: [
          ...flow.marks,
          {
            label,
            timestamp: Date.now(),
            sinceStartMs: roundDuration(Date.now() - flow.startedAt) || 0,
            meta,
          },
        ],
      };
    }),
  };
  if (didUpdate) emit();
}

export function finishDevFlow(
  id: string | null | undefined,
  status: Extract<DevFlowStatus, 'success' | 'error' | 'cancelled'>,
  meta?: Record<string, unknown>,
) {
  if (!id || !devToolsFeatureEnabled || !state.enabled) return;
  const existingFlow = state.flows.find((flow) => flow.id === id);
  if (!existingFlow) return;
  const finishedFlow: DevFlowRun = {
    ...existingFlow,
    status,
    endedAt: Date.now(),
    durationMs: roundDuration(Date.now() - existingFlow.startedAt),
    meta: { ...(existingFlow.meta || {}), ...(meta || {}) },
  };
  state = {
    ...state,
    flows: state.flows.map((flow) => {
      if (flow.id !== id) return flow;
      return finishedFlow;
    }),
  };
  emit();
  addDevMetricEvent({
    kind: 'flow',
    status: status === 'cancelled' ? 'cancelled' : status,
    name: finishedFlow.name,
    durationMs: finishedFlow.durationMs,
    meta: finishedFlow.meta,
  });
}

export function clearDevMetrics() {
  state = {
    ...state,
    events: [],
    flows: [],
  };
  emit();
}

export function setDevMetricsEnabled(enabled: boolean) {
  const nextEnabled = devToolsFeatureEnabled ? enabled : false;
  state = {
    ...state,
    enabled: nextEnabled,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ENABLED_STORAGE_KEY, nextEnabled ? '1' : '0');
    } catch {
      // ignore storage access problems
    }
  }
  emit();
}

export function serializeDevMetrics(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      metrics: state,
    },
    null,
    2,
  );
}

export function useDevMetricsStore(): DevMetricsState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}

export function attachQueryClientMetrics(queryClient: QueryClient) {
  if (!devToolsFeatureEnabled) return;
  if (queryMetricsAttached) return;
  queryMetricsAttached = true;

  const fetchState = new Map<
    string,
    {
      fetchStatus?: string;
      startedAt?: number;
    }
  >();

  queryClient.getQueryCache().subscribe((event) => {
    const query = toRecord(event)?.query as
      | {
          queryHash: string;
          queryKey: unknown;
          state: { fetchStatus?: string; status?: string; error?: unknown; dataUpdatedAt?: number };
        }
      | undefined;
    if (!query) return;

    const previous = fetchState.get(query.queryHash) || {};
    const currentFetchStatus = query.state.fetchStatus;
    const name = describeQueryKey(query.queryKey);

    if (previous.fetchStatus !== 'fetching' && currentFetchStatus === 'fetching') {
      fetchState.set(query.queryHash, {
        fetchStatus: currentFetchStatus,
        startedAt: performance.now(),
      });
      addDevMetricEvent({
        kind: 'query',
        status: 'start',
        name,
        meta: {
          queryKey: query.queryKey,
          queryHash: query.queryHash,
        },
      });
      return;
    }

    if (previous.fetchStatus === 'fetching' && currentFetchStatus !== 'fetching') {
      const durationMs =
        typeof previous.startedAt === 'number' ? performance.now() - previous.startedAt : undefined;
      addDevMetricEvent({
        kind: 'query',
        status: query.state.status === 'error' ? 'error' : 'success',
        name,
        durationMs,
        message:
          query.state.error instanceof Error
            ? query.state.error.message
            : typeof query.state.error === 'string'
              ? query.state.error
              : undefined,
        meta: {
          queryKey: query.queryKey,
          queryHash: query.queryHash,
          dataUpdatedAt: query.state.dataUpdatedAt,
          status: query.state.status,
        },
      });
      fetchState.set(query.queryHash, { fetchStatus: currentFetchStatus });
      return;
    }

    fetchState.set(query.queryHash, {
      ...previous,
      fetchStatus: currentFetchStatus,
    });
  });
}