import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey } from './orgScope';

export type TestDataPreset = 'small' | 'realistic' | 'large';

export type GenerateTestDataPayload = {
  preset: TestDataPreset;
  projects?: number;
  activities?: number;
  monthsBack?: number;
  clearExisting?: boolean;
};

export type GenerateTestDataResult = {
  orgId: string;
  orgName: string;
  preset: TestDataPreset;
  config: {
    projects: number;
    activities: number;
    monthsBack: number;
    clearExisting: boolean;
  };
  cleanedUp: {
    deletedActivities: number;
    deletedProjects: number;
  };
  created: {
    projects: number;
    activities: number;
    categories: number;
    tags: number;
    locations: number;
    cohorts: number;
    staff: number;
  };
};

function invalidateRelevantQueries(qc: ReturnType<typeof useQueryClient>, scopeKey: string) {
  void qc.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      const root = Array.isArray(key) ? key[0] : undefined;
      return (
        Array.isArray(key) &&
        key[1] === scopeKey &&
        (root === 'activities' ||
          root === 'projects' ||
          root === 'categories' ||
          root === 'tags' ||
          root === 'cohorts' ||
          root === 'locations' ||
          root === 'staff' ||
          (typeof root === 'string' && root.startsWith('stats:')))
      );
    },
  });
}

export function useGenerateTestData() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async (payload: GenerateTestDataPayload) => {
      const res = await api.post('/dev-tools/test-data/generate', payload);
      return res.data as GenerateTestDataResult;
    },
    onSuccess: () => invalidateRelevantQueries(qc, scopeKey),
  });
}

export function useDeleteGeneratedTestData() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async () => {
      const res = await api.delete('/dev-tools/test-data/generated');
      return res.data as { deletedActivities: number; deletedProjects: number };
    },
    onSuccess: () => invalidateRelevantQueries(qc, scopeKey),
  });
}