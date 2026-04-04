import axios from 'axios';
import { addDevMetricEvent } from './devMetrics';
import { devToolsFeatureEnabled } from './devToolsConfig';

// Allow overriding the API base URL at build time via Vite env (VITE_API_BASE_URL)
// Fallback to '/api' which works when the frontend's nginx proxies /api to the backend
const BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env?.VITE_API_BASE_URL) || '/api';

export const api = axios.create({
  baseURL: BASE_URL,
});

let devMetricsInterceptorsAttached = false;

function formatRequestName(config: {
  method?: string;
  baseURL?: string;
  url?: string;
}): string {
  const method = (config.method || 'get').toUpperCase();
  const base = config.baseURL || '';
  const url = config.url || '';
  const full = `${base}${url}`;
  return `${method} ${full || url || '/'}`;
}

function summarizeParams(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 8);
  return Object.fromEntries(entries);
}

if (!devMetricsInterceptorsAttached) {
  devMetricsInterceptorsAttached = true;

  api.interceptors.request.use((config) => {
    if (!devToolsFeatureEnabled) return config;
    const requestMeta = {
      startedAt: performance.now(),
      requestName: formatRequestName(config),
      params: summarizeParams(config.params),
    };
    (config as typeof config & { __devMetric?: typeof requestMeta }).__devMetric = requestMeta;
    addDevMetricEvent({
      kind: 'http',
      status: 'start',
      name: requestMeta.requestName,
      meta: requestMeta.params ? { params: requestMeta.params } : undefined,
    });
    return config;
  });

  api.interceptors.response.use(
    (response) => {
      if (!devToolsFeatureEnabled) return response;
      const meta = (response.config as typeof response.config & {
        __devMetric?: { startedAt: number; requestName: string; params?: Record<string, unknown> };
      }).__devMetric;
      addDevMetricEvent({
        kind: 'http',
        status: 'success',
        name: meta?.requestName || formatRequestName(response.config),
        durationMs: meta ? performance.now() - meta.startedAt : undefined,
        meta: {
          statusCode: response.status,
          ...(meta?.params ? { params: meta.params } : {}),
        },
      });
      return response;
    },
    (error) => {
      if (!devToolsFeatureEnabled) return Promise.reject(error);
      const config = error?.config as
        | {
            method?: string;
            baseURL?: string;
            url?: string;
            __devMetric?: { startedAt: number; requestName: string; params?: Record<string, unknown> };
          }
        | undefined;
      const meta = config?.__devMetric;
      addDevMetricEvent({
        kind: 'http',
        status: 'error',
        name: meta?.requestName || formatRequestName(config || {}),
        durationMs: meta ? performance.now() - meta.startedAt : undefined,
        message: error instanceof Error ? error.message : 'HTTP request failed',
        meta: {
          statusCode: error?.response?.status,
          ...(meta?.params ? { params: meta.params } : {}),
        },
      });
      return Promise.reject(error);
    },
  );
}

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}
