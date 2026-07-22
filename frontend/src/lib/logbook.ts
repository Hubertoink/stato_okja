import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey, useOrgScopedQueryState } from './orgScope';
import type { Activity } from './activities';
import type { Project } from './projects';

export type LogbookEntryType = 'observation' | 'incident' | 'success' | 'handover' | 'debrief' | 'other';
export type LogbookEntryStatus = 'open' | 'follow_up' | 'discussed' | 'archived';
export type LogbookVisibility = 'team' | 'admins';

export type LogbookAuthor = {
  id: string;
  avatarUrl: string | null;
};

export interface LogbookComment {
  id: string;
  entryId: string;
  body: string;
  createdByUserId: string | null;
  createdByName: string;
  createdByUser?: LogbookAuthor | null;
  createdAt: string;
}

export interface LogbookEntry {
  id: string;
  orgId: string | null;
  occurredAt: string;
  type: LogbookEntryType;
  title: string;
  body: string;
  highlights?: string | null;
  challenges?: string | null;
  nextSteps?: string | null;
  status: LogbookEntryStatus;
  visibility: LogbookVisibility;
  activityId?: string | null;
  activity?: Activity | null;
  projectId?: string | null;
  project?: Project | null;
  createdByUserId: string | null;
  createdByName: string;
  createdByUser?: LogbookAuthor | null;
  updatedByUserId?: string | null;
  updatedByName?: string | null;
  documentationUpdatedByUserId?: string | null;
  documentationUpdatedByName?: string | null;
  documentationUpdatedAt?: string | null;
  discussedByUserId?: string | null;
  discussedByName?: string | null;
  discussedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  comments?: LogbookComment[];
  commentCount?: number;
}

export type LogbookFilters = {
  search?: string;
  from?: string;
  to?: string;
  type?: LogbookEntryType;
  status?: LogbookEntryStatus;
  authorId?: string;
  activityId?: string;
  projectId?: string;
  includeArchived?: boolean;
};

export type LogbookEntryInput = Partial<Pick<
  LogbookEntry,
  'occurredAt' | 'type' | 'title' | 'body' | 'highlights' | 'challenges' | 'nextSteps' | 'status' | 'visibility' | 'activityId' | 'projectId'
>>;

type LogbookListResult = { data: LogbookEntry[]; total: number; page: number; pageSize: number };

/** Load the complete visible logbook through the same bounded API pagination as the UI. */
export async function fetchAllLogbookEntries(filters: LogbookFilters = {}): Promise<LogbookEntry[]> {
  const data: LogbookEntry[] = [];
  const limit = 100;
  let page = 1;
  let total = 0;

  do {
    const response = await api.get<LogbookListResult>('/logbook', { params: { ...filters, page, limit } });
    const rows = Array.isArray(response.data.data) ? response.data.data : [];
    data.push(...rows);
    total = Number.isFinite(response.data.total) ? response.data.total : data.length;
    if (rows.length === 0) break;
    page += 1;
  } while (data.length < total);

  return data;
}

export function useLogbookEntries(filters: LogbookFilters = {}, page = 1, limit = 30) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['logbook', scopeKey, filters, page, limit],
    queryFn: async () => {
      const res = await api.get('/logbook', { params: { ...filters, page, limit } });
      return res.data as LogbookListResult;
    },
    enabled: ready,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export function useLogbookEntry(id?: string) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['logbook-entry', scopeKey, id],
    queryFn: async () => (await api.get(`/logbook/${encodeURIComponent(id || '')}`)).data as LogbookEntry,
    enabled: ready && !!id,
  });
}

function useInvalidateLogbook() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return () => {
    void qc.invalidateQueries({ queryKey: ['logbook', scopeKey] });
    void qc.invalidateQueries({ queryKey: ['logbook-entry', scopeKey] });
  };
}

export function useCreateLogbookEntry() {
  const invalidate = useInvalidateLogbook();
  return useMutation({
    mutationFn: async (data: LogbookEntryInput) => (await api.post('/logbook', data)).data as LogbookEntry,
    onSuccess: invalidate,
  });
}

export function useUpdateLogbookEntry() {
  const invalidate = useInvalidateLogbook();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LogbookEntryInput }) =>
      (await api.patch(`/logbook/${encodeURIComponent(id)}`, data)).data as LogbookEntry,
    onSuccess: invalidate,
  });
}

export function useSetLogbookStatus() {
  const invalidate = useInvalidateLogbook();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LogbookEntryStatus }) =>
      (await api.patch(`/logbook/${encodeURIComponent(id)}/status`, { status })).data as LogbookEntry,
    onSuccess: invalidate,
  });
}

export function useArchiveLogbookEntry() {
  const invalidate = useInvalidateLogbook();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/logbook/${encodeURIComponent(id)}`)).data as { id: string },
    onSuccess: invalidate,
  });
}

export function useCreateLogbookComment() {
  const invalidate = useInvalidateLogbook();
  return useMutation({
    mutationFn: async ({ entryId, body }: { entryId: string; body: string }) =>
      (await api.post(`/logbook/${encodeURIComponent(entryId)}/comments`, { body })).data as LogbookComment,
    onSuccess: invalidate,
  });
}

export function useRemoveLogbookComment() {
  const invalidate = useInvalidateLogbook();
  return useMutation({
    mutationFn: async ({ entryId, commentId }: { entryId: string; commentId: string }) => {
      await api.delete(`/logbook/${encodeURIComponent(entryId)}/comments/${encodeURIComponent(commentId)}`);
    },
    onSuccess: invalidate,
  });
}
