import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useOrgScopeKey, useOrgScopedQueryState } from './orgScope';

export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived';
export type SurveyQuestionType = 'single_choice' | 'multiple_choice' | 'scale' | 'text';
export type SurveyOption = { id: string; label: string };
export type SurveyQuestion = {
  id: string;
  type: SurveyQuestionType;
  label: string;
  hint?: string;
  required?: boolean;
  options?: SurveyOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  demographicKey?: 'age_cohort' | 'gender' | 'origin_area';
};
export type Survey = {
  id: string;
  orgId?: string | null;
  projectId?: string | null;
  title: string;
  introduction?: string | null;
  seriesId?: string | null;
  roundNumber?: number;
  status: SurveyStatus;
  publicToken: string;
  questions: SurveyQuestion[];
  allowMultiplePerDevice: boolean;
  expectedParticipants?: number | null;
  startsAt?: string | null;
  startedAt?: string | null;
  endsAt?: string | null;
  closedAt?: string | null;
  rawResponsesPurgeAt?: string | null;
  archived: boolean;
  responsesCount: number;
  rawResponsesAvailable: boolean;
  roundsCount?: number;
};
export type SurveyResponse = {
  id: string;
  surveyId: string;
  submittedAt: string;
  answers: Record<string, string | string[] | number | null>;
  number: number;
};
export type SurveyAnalyticsQuestion = {
  id: string;
  type: SurveyQuestionType;
  label: string;
  answeredCount: number;
  counts?: Record<string, number>;
  median?: number | null;
  mean?: number | null;
  texts?: string[];
};
export type SurveyAnalytics = {
  responsesCount: number;
  expectedParticipants?: number | null;
  responseRate?: number | null;
  questions: SurveyAnalyticsQuestion[];
  generatedAt: string;
  suppressed?: boolean;
};
export type SurveyTrendPoint = {
  roundId: string;
  roundNumber: number;
  date: string;
  responsesCount: number;
  answeredCount: number;
  median?: number | null;
  mean?: number | null;
  counts?: Record<string, number>;
  percentage?: number | null;
  suppressed?: boolean;
};
export type SurveyTrend = {
  rounds: Array<{
    id: string;
    roundNumber: number;
    status: SurveyStatus;
    date: string;
    responsesCount: number;
    expectedParticipants?: number | null;
    responseRate?: number | null;
    suppressed?: boolean;
  }>;
  questions: Array<{
    id: string;
    label: string;
    type: SurveyQuestionType;
    points?: SurveyTrendPoint[];
    options?: Array<{ id: string; label: string; points: SurveyTrendPoint[] }>;
  }>;
};
export type SurveyInput = Partial<
  Pick<
    Survey,
    | 'title'
    | 'introduction'
    | 'projectId'
    | 'questions'
    | 'allowMultiplePerDevice'
    | 'expectedParticipants'
    | 'startsAt'
    | 'endsAt'
  >
>;
export type SurveyTemplate = {
  format: 'stato-survey-template';
  version: 1;
  template: Pick<Survey, 'title' | 'introduction' | 'questions'>;
};

export function surveyQuestionId() {
  return (
    globalThis.crypto?.randomUUID?.() || `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

export function createSurveyTemplate(survey: Survey): SurveyTemplate {
  return {
    format: 'stato-survey-template',
    version: 1,
    template: {
      title: survey.title,
      introduction: survey.introduction || null,
      questions: survey.questions,
    },
  };
}

export function parseSurveyTemplate(
  json: string,
): Pick<SurveyInput, 'title' | 'introduction' | 'questions'> {
  const value = JSON.parse(json) as Partial<SurveyTemplate>;
  if (
    value.format !== 'stato-survey-template' ||
    value.version !== 1 ||
    !value.template ||
    typeof value.template.title !== 'string' ||
    !Array.isArray(value.template.questions)
  ) {
    throw new Error('Keine gültige StatO-Umfragevorlage.');
  }
  return {
    title: value.template.title,
    introduction:
      typeof value.template.introduction === 'string' ? value.template.introduction : null,
    questions: value.template.questions,
  };
}

export function useSurveys(params?: { search?: string; archived?: boolean }) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['surveys', scopeKey, params],
    enabled: ready,
    queryFn: async () => (await api.get('/surveys', { params })).data as Survey[],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 15_000,
  });
}
export function useSurvey(id?: string) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['survey', scopeKey, id],
    enabled: ready && !!id,
    queryFn: async () => (await api.get(`/surveys/${id}`)).data as Survey,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 15_000,
  });
}
export function useSurveyRounds(id?: string) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['survey-rounds', scopeKey, id],
    enabled: ready && !!id,
    queryFn: async () => (await api.get(`/surveys/${id}/rounds`)).data as Survey[],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 15_000,
  });
}
export function useSurveyTrend(id?: string) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['survey-trend', scopeKey, id],
    enabled: ready && !!id,
    queryFn: async () => (await api.get(`/surveys/${id}/trend`)).data as SurveyTrend,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 15_000,
  });
}
export function useArchivedSurveys() {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['surveys-has-archived', scopeKey],
    enabled: ready,
    queryFn: async () => Boolean((await api.get('/surveys/meta/has-archived')).data),
  });
}
function useSurveyMutation<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys', scopeKey] });
      qc.invalidateQueries({ queryKey: ['survey', scopeKey] });
      qc.invalidateQueries({ queryKey: ['survey-rounds', scopeKey] });
      qc.invalidateQueries({ queryKey: ['survey-trend', scopeKey] });
      qc.invalidateQueries({ queryKey: ['surveys-has-archived', scopeKey] });
    },
  });
}
export function useCreateSurvey() {
  return useSurveyMutation(
    async (input: SurveyInput) => (await api.post('/surveys', input)).data as Survey,
  );
}
export function useUpdateSurvey() {
  return useSurveyMutation(
    async ({ id, data }: { id: string; data: SurveyInput }) =>
      (await api.patch(`/surveys/${id}`, data)).data as Survey,
  );
}
export function useStartSurvey() {
  return useSurveyMutation(
    async (id: string) => (await api.post(`/surveys/${id}/start`)).data as Survey,
  );
}
export function useCloseSurvey() {
  return useSurveyMutation(
    async (id: string) => (await api.post(`/surveys/${id}/close`)).data as Survey,
  );
}
export function useArchiveSurvey() {
  return useSurveyMutation(
    async ({ id, archived }: { id: string; archived: boolean }) =>
      (await api.patch(`/surveys/${id}`, { archived })).data as Survey,
  );
}
export function useCreateSurveyRound() {
  return useSurveyMutation(
    async (id: string) => (await api.post(`/surveys/${id}/rounds`)).data as Survey,
  );
}
export function useSurveyResponses(id?: string) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['survey-responses', scopeKey, id],
    enabled: ready && !!id,
    queryFn: async () =>
      (await api.get(`/surveys/${id}/responses`)).data as {
        rawResponsesAvailable: boolean;
        responses: SurveyResponse[];
      },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 15_000,
  });
}
export function useSurveyAnalytics(id?: string) {
  const { scopeKey, ready } = useOrgScopedQueryState();
  return useQuery({
    queryKey: ['survey-analytics', scopeKey, id],
    enabled: ready && !!id,
    queryFn: async () => (await api.get(`/surveys/${id}/analytics`)).data as SurveyAnalytics,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 15_000,
  });
}
export function useDeleteSurveyResponse() {
  const qc = useQueryClient();
  const scopeKey = useOrgScopeKey();
  return useMutation({
    mutationFn: async ({
      surveyId,
      responseId,
      reason,
    }: {
      surveyId: string;
      responseId: string;
      reason: string;
    }) => api.delete(`/surveys/${surveyId}/responses/${responseId}`, { data: { reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['survey-responses', scopeKey] });
      qc.invalidateQueries({ queryKey: ['survey-analytics', scopeKey] });
      qc.invalidateQueries({ queryKey: ['surveys', scopeKey] });
    },
  });
}
export async function fetchPublicSurvey(token: string) {
  return (await api.get(`/public/surveys/${token}`)).data as Pick<
    Survey,
    'title' | 'introduction' | 'questions' | 'allowMultiplePerDevice'
  > & { organizationName?: string | null };
}
export async function submitPublicSurvey(
  token: string,
  answers: Record<string, string | string[] | number | null>,
  deviceToken?: string,
) {
  return api.post(`/public/surveys/${token}/responses`, { answers, deviceToken });
}
