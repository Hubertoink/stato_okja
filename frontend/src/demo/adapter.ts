import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError, AxiosHeaders } from 'axios';
import * as demo from './store';
import { autoT } from '@/i18n/auto';

type HandlerResult = { status?: number; data?: unknown; headers?: Record<string, string> };

class DemoHttpError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data || { message };
  }
}

function parseBody(data: unknown): Record<string, unknown> {
  if (!data) return {};
  if (typeof FormData !== 'undefined' && data instanceof FormData) return {};
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
}

function requestInfo(config: InternalAxiosRequestConfig) {
  const rawUrl = config.url || '/';
  const baseUrl = config.baseURL || '/api';
  const combined = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `${baseUrl.replace(/\/+$/, '')}/${rawUrl.replace(/^\/+/, '')}`;
  const url = new URL(combined, 'https://demo.local');
  const params: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = params[key] ? `${params[key]},${value}` : value;
  });
  if (config.params && typeof config.params === 'object') {
    Object.assign(params, config.params as Record<string, unknown>);
  }
  return {
    method: String(config.method || 'get').toLowerCase(),
    path: (url.pathname.replace(/^\/api(?=\/|$)/, '') || '/').replace(/\/+$/, '') || '/',
    params,
    body: parseBody(config.data),
  };
}

function textStatus(status: number): string {
  if (status === 201) return 'Created';
  if (status === 204) return 'No Content';
  if (status === 404) return 'Not Found';
  if (status >= 400) return 'Error';
  return 'OK';
}

function response(config: InternalAxiosRequestConfig, result: HandlerResult): AxiosResponse {
  const status = result.status || 200;
  return {
    data: result.data ?? null,
    status,
    statusText: textStatus(status),
    headers: new AxiosHeaders(result.headers || { 'content-type': 'application/json' }),
    config,
  };
}

function failure(config: InternalAxiosRequestConfig, error: DemoHttpError) {
  const errorResponse = response(config, { status: error.status, data: error.data });
  return Promise.reject(new AxiosError(error.message, undefined, config, undefined, errorResponse));
}

function notFound(path: string): never {
  throw new DemoHttpError(404, `Demo endpoint not found: ${path}`);
}

function ok(data: unknown, status = 200): HandlerResult {
  return { status, data };
}

function noContent(): HandlerResult {
  return { status: 204, data: null };
}

function uploadResult(): HandlerResult {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480"><rect width="800" height="480" fill="#2563eb"/><text x="60" y="260" font-family="Arial" font-size="54" font-weight="700" fill="white">Demo Upload</text></svg>';
  return ok({ url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, size: svg.length }, 201);
}

function handleAuth(method: string, path: string, body: Record<string, unknown>): HandlerResult | undefined {
  if (method === 'get' && path === '/auth/me') return ok(demo.getDemoUser());
  if (method === 'patch' && path === '/auth/me') return ok(demo.updateDemoUserProfile(body));
  if (method === 'post' && path === '/auth/login') return ok({ access_token: 'demo-token', user: demo.getDemoUser() });
  if (method === 'post' && path === '/auth/verify-two-factor') return ok({ access_token: 'demo-token', user: demo.getDemoUser() });
  if (method === 'post' && path === '/auth/resend-two-factor') return ok({ requiresTwoFactor: true, challengeToken: 'demo', emailHint: demo.getDemoUser().email, expiresInSeconds: 300 });
  if (method === 'post' && path === '/auth/invite') throw new DemoHttpError(403, autoT('ui_56a878e5ad61'));
  if (method === 'get' && path === '/auth/public-config') return ok(demo.getDemoPublicConfig());
  if (method === 'post' && (path === '/auth/change-password' || path === '/auth/request-password-reset' || path === '/auth/validate-reset-token' || path === '/auth/reset-password')) return ok({ ok: true });
  return undefined;
}

function handleTaxonomy(method: string, segments: string[], params: Record<string, unknown>, body: Record<string, unknown>): HandlerResult | undefined {
  if (segments[0] !== 'taxonomy') return undefined;
  const type = segments[1];
  const id = segments[2] ? decodeURIComponent(segments[2]) : '';
  if (type === 'access' && method === 'get') return ok(demo.getDemoTaxonomyAccess());
  if (type === 'categories') {
    if (method === 'get') return ok(demo.listDemoCategories(params));
    if (method === 'post') return ok(demo.createDemoCategory(body), 201);
    if (method === 'patch') return ok(demo.updateDemoCategory(id, body));
    if (method === 'delete') { demo.deleteDemoCategory(id); return noContent(); }
  }
  if (type === 'tags') {
    if (method === 'get') return ok(demo.listDemoTags(params));
    if (method === 'post') return ok(demo.createDemoTag(body), 201);
    if (method === 'patch') return ok(demo.updateDemoTag(id, body));
    if (method === 'delete') { demo.deleteDemoTag(id); return noContent(); }
  }
  if (type === 'cohorts') {
    if (method === 'get') return ok(demo.listDemoCohorts(params));
    if (method === 'post') return ok(demo.createDemoCohort(body), 201);
    if (method === 'patch') return ok(demo.updateDemoCohort(id, body));
    if (method === 'delete') { demo.deleteDemoCohort(id); return noContent(); }
  }
  return undefined;
}

function handleOrgs(method: string, segments: string[], params: Record<string, unknown>, body: Record<string, unknown>): HandlerResult | undefined {
  if (segments[0] !== 'orgs') return undefined;
  if (method === 'get' && segments.length === 1) return ok(demo.listDemoOrgs());
  if (method === 'post' && segments.length === 1) throw new DemoHttpError(403, autoT('ui_d9f9c2039ba3'));
  if (method === 'get' && segments[1] === 'subtree') return ok(demo.listDemoOrgs());
  const orgId = segments[1] ? decodeURIComponent(segments[1]) : '';
  if (method === 'get' && segments[2] === 'users') return ok(demo.listDemoUsers());
  if (method === 'get' && segments[2] === 'taxonomy-settings') return ok(demo.getDemoTaxonomySettings());
  if (method === 'patch' && segments[2] === 'taxonomy-settings') return ok(demo.getDemoTaxonomySettings());
  if (method === 'get' && segments[2] === 'opening-hours') return ok(demo.getDemoOpeningHours());
  if (method === 'patch' && segments[2] === 'opening-hours') return ok(demo.updateDemoOpeningHours(body as never));
  if (method === 'get' && segments[2] === 'closure-days') return ok(demo.listDemoClosureDays(params));
  if (method === 'patch' && segments[2] === 'closure-days' && segments[3]) return ok(demo.upsertDemoClosureDay(decodeURIComponent(segments[3]), body));
  if (method === 'delete' && segments[2] === 'closure-days' && segments[3]) return ok(demo.deleteDemoClosureDay(decodeURIComponent(segments[3])));
  if (method === 'post' && segments[2] === 'move-preview') return ok({ currentParentId: null, newParentId: body.parentId ?? null, affectedOrgs: 0, requiresConfirmation: false, resetNotice: '', lost: { categories: [], tags: [], cohorts: [] }, gained: { categories: [], tags: [], cohorts: [] }, activityConflicts: { categories: { activities: 0, items: [] }, tags: { activities: 0, items: [] }, cohorts: { activities: 0, items: [] } }, projectConflicts: { categories: { projects: 0, items: [] } } });
  if (method === 'patch' && segments[2] === 'move') return ok({ id: orgId, name: 'Demo Jugendhaus', parentId: null, path: orgId });
  return undefined;
}

function handleActivities(method: string, segments: string[], params: Record<string, unknown>, body: Record<string, unknown>): HandlerResult | undefined {
  if (segments[0] !== 'activities') return undefined;
  if (method === 'get' && segments[1] === 'acks') return ok(demo.getDemoActivityAcks(String(params.activityIds || '').split(',').filter(Boolean)));
  if (method === 'get' && segments.length === 1) return ok(demo.listDemoActivities(params));
  if (method === 'post' && segments.length === 1) return ok(demo.createDemoActivity(body), 201);
  const activityId = segments[1] ? decodeURIComponent(segments[1]) : '';
  if (method === 'patch' && segments[2] === 'ack') return ok(demo.setDemoActivityAck(activityId, body.done === true));
  if (method === 'get' && activityId) {
    const activity = demo.getDemoActivity(activityId);
    if (!activity) throw new DemoHttpError(404, 'Aktivitaet nicht gefunden');
    return ok(activity);
  }
  if (method === 'patch' && activityId) return ok(demo.updateDemoActivity(activityId, body));
  if (method === 'delete' && activityId) { demo.deleteDemoActivity(activityId); return noContent(); }
  return undefined;
}

function handleProjects(method: string, segments: string[], params: Record<string, unknown>, body: Record<string, unknown>): HandlerResult | undefined {
  if (segments[0] !== 'projects') return undefined;
  if (method === 'get' && segments.length === 1) return ok(demo.listDemoProjects(params));
  if (method === 'post' && segments.length === 1) return ok(demo.createDemoProject(body), 201);
  const projectId = segments[1] ? decodeURIComponent(segments[1]) : '';
  if (method === 'get' && projectId) {
    const project = demo.getDemoProject(projectId);
    if (!project) throw new DemoHttpError(404, autoT('ui_479d6709944b'));
    return ok(project);
  }
  if (method === 'patch' && segments[2] === 'archive') return ok(demo.updateDemoProject(projectId, { archived: body.archived === true }));
  if (method === 'patch' && projectId) return ok(demo.updateDemoProject(projectId, body));
  if (method === 'delete' && projectId) { demo.deleteDemoProject(projectId); return noContent(); }
  return undefined;
}

function handleLogbook(method: string, segments: string[], params: Record<string, unknown>, body: Record<string, unknown>): HandlerResult | undefined {
  if (segments[0] !== 'logbook') return undefined;
  if (method === 'get' && segments.length === 1) return ok(demo.listDemoLogbookEntries(params));
  if (method === 'post' && segments.length === 1) return ok(demo.createDemoLogbookEntry(body), 201);
  const entryId = segments[1] ? decodeURIComponent(segments[1]) : '';
  if (method === 'get' && entryId && segments.length === 2) {
    const entry = demo.getDemoLogbookEntry(entryId);
    if (!entry) throw new DemoHttpError(404, 'Logbucheintrag nicht gefunden');
    return ok(entry);
  }
  if (method === 'patch' && entryId && segments[2] === 'status') return ok(demo.setDemoLogbookStatus(entryId, body.status as never));
  if (method === 'patch' && entryId && segments.length === 2) return ok(demo.updateDemoLogbookEntry(entryId, body));
  if (method === 'delete' && entryId && segments.length === 2) return ok(demo.archiveDemoLogbookEntry(entryId));
  if (method === 'post' && entryId && segments[2] === 'comments') return ok(demo.createDemoLogbookComment(entryId, String(body.body || '')), 201);
  if (method === 'delete' && entryId && segments[2] === 'comments' && segments[3]) return ok(demo.removeDemoLogbookComment(entryId, decodeURIComponent(segments[3])));
  return undefined;
}

function handleProjectTemplates(method: string, segments: string[], body: Record<string, unknown>): HandlerResult | undefined {
  if (segments[0] !== 'project-templates') return undefined;
  if (method === 'get' && segments[1] === 'owned') return ok(demo.listDemoProjectTemplates(true));
  if (method === 'get' && segments.length === 1) return ok(demo.listDemoProjectTemplates(false));
  if (method === 'post' && segments.length === 1) return ok(demo.createDemoProjectTemplate(body), 201);
  const templateId = segments[1] ? decodeURIComponent(segments[1]) : '';
  if (method === 'patch' && templateId) return ok(demo.updateDemoProjectTemplate(templateId, body));
  if (method === 'delete' && templateId) { demo.deleteDemoProjectTemplate(templateId); return noContent(); }
  return undefined;
}

function handleSurveys(method: string, segments: string[], params: Record<string, unknown>, body: Record<string, unknown>): HandlerResult | undefined {
  if (segments[0] === 'public' && segments[1] === 'surveys' && segments[2]) {
    const token = decodeURIComponent(segments[2]);
    if (method === 'get' && segments.length === 3) return ok(demo.getDemoPublicSurvey(token));
    if (method === 'post' && segments[3] === 'responses') return ok(demo.submitDemoPublicSurvey(token, body.answers as never), 201);
  }
  if (segments[0] !== 'surveys') return undefined;
  if (method === 'get' && segments.length === 1) return ok(demo.listDemoSurveys(params));
  if (method === 'post' && segments.length === 1) return ok(demo.createDemoSurvey(body), 201);
  if (method === 'get' && segments[1] === 'meta' && segments[2] === 'has-archived') return ok(demo.hasDemoArchivedSurveys());
  const id = segments[1] ? decodeURIComponent(segments[1]) : '';
  if (!id) return undefined;
  if (method === 'get' && segments.length === 2) {
    const survey = demo.getDemoSurvey(id);
    if (!survey) throw new DemoHttpError(404, autoT('ui_2ce107281759'));
    return ok(survey);
  }
  if (method === 'patch' && segments.length === 2) return ok(demo.updateDemoSurvey(id, body));
  if (method === 'post' && segments[2] === 'start') return ok(demo.startDemoSurvey(id));
  if (method === 'post' && segments[2] === 'close') return ok(demo.closeDemoSurvey(id));
  if (method === 'get' && segments[2] === 'rounds') return ok(demo.listDemoSurveyRounds(id));
  if (method === 'post' && segments[2] === 'rounds') return ok(demo.createDemoSurveyRound(id), 201);
  if (method === 'delete' && segments[2] === 'rounds' && segments[3]) return ok(demo.deleteDemoSurveyRound(id, decodeURIComponent(segments[3])));
  if (method === 'get' && segments[2] === 'analytics') return ok(demo.getDemoSurveyAnalytics(id));
  if (method === 'get' && segments[2] === 'trend') return ok(demo.getDemoSurveyTrend(id));
  if (method === 'get' && segments[2] === 'responses') return ok(demo.listDemoSurveyResponses(id));
  if (method === 'delete' && segments[2] === 'responses' && segments[3]) return ok(demo.deleteDemoSurveyResponse(id, decodeURIComponent(segments[3])));
  return undefined;
}

function handleRequest(method: string, path: string, params: Record<string, unknown>, body: Record<string, unknown>): HandlerResult {
  const segments = path.split('/').filter(Boolean);
  const authResult = handleAuth(method, path, body);
  if (authResult) return authResult;
  const taxonomyResult = handleTaxonomy(method, segments, params, body);
  if (taxonomyResult) return taxonomyResult;
  const orgResult = handleOrgs(method, segments, params, body);
  if (orgResult) return orgResult;
  const activityResult = handleActivities(method, segments, params, body);
  if (activityResult) return activityResult;
  const projectResult = handleProjects(method, segments, params, body);
  if (projectResult) return projectResult;
  const logbookResult = handleLogbook(method, segments, params, body);
  if (logbookResult) return logbookResult;
  const templateResult = handleProjectTemplates(method, segments, body);
  if (templateResult) return templateResult;
  const surveyResult = handleSurveys(method, segments, params, body);
  if (surveyResult) return surveyResult;

  if (method === 'get' && path === '/locations') return ok(demo.listDemoLocations(params));
  if (method === 'post' && path === '/locations') return ok(demo.createDemoLocation(body), 201);
  if (method === 'patch' && segments[0] === 'locations' && segments[1]) return ok(demo.updateDemoLocation(decodeURIComponent(segments[1]), body));
  if (method === 'delete' && segments[0] === 'locations' && segments[1]) { demo.deleteDemoLocation(decodeURIComponent(segments[1])); return noContent(); }

  if (method === 'get' && path === '/staff') return ok(demo.listDemoStaff(params));
  if (method === 'post' && path === '/staff') return ok(demo.createDemoStaff(body), 201);
  if (method === 'patch' && segments[0] === 'staff' && segments[1]) return ok(demo.updateDemoStaff(decodeURIComponent(segments[1]), body));
  if (method === 'delete' && segments[0] === 'staff' && segments[1]) { demo.deleteDemoStaff(decodeURIComponent(segments[1])); return noContent(); }

  if (method === 'get' && path === '/users') return ok(demo.listDemoUsers());
  if (method === 'patch' && segments[0] === 'users' && segments[1]) return ok({ ok: true });
  if (method === 'delete' && segments[0] === 'users' && segments[1]) return noContent();

  if (method === 'get' && path === '/stats/summary') return ok(demo.getDemoStatsSummary(params));
  if (method === 'get' && path === '/stats/overview') return ok(demo.getDemoStatsOverview(params));
  if (method === 'get' && path === '/stats/participants-timeseries') {
    return ok(demo.getDemoStatsOverview(params).participantsTimeseries);
  }
  if (method === 'get' && path === '/stats/by-cohort') return ok(demo.getDemoStatsByCohort());

  if (method === 'get' && path === '/audit') return ok(demo.listDemoAuditLogs(params));
  if (method === 'get' && path === '/audit/metrics') return ok(demo.getDemoAuditMetrics());

  if (method === 'post' && path === '/uploads/images') return uploadResult();
  if (method === 'post' && path === '/dev-tools/test-data/generate') return ok(demo.runDemoTestDataGeneration(), 201);
  if (method === 'delete' && path === '/dev-tools/test-data/generated') return ok(demo.deleteDemoGeneratedTestData());
  if (method === 'get' && path === '/demo/info') return ok(demo.getDemoGeneratedInfo());
  if (method === 'get' && path === '/admin/system-data/export') return ok(new Blob([JSON.stringify({ demo: true })], { type: 'application/json' }), 200);

  return notFound(path);
}

export const demoAxiosAdapter: AxiosAdapter = async (config) => {
  const info = requestInfo(config);
  try {
    const result = handleRequest(info.method, info.path, info.params, info.body);
    return response(config, result);
  } catch (error) {
    if (error instanceof DemoHttpError) return failure(config, error);
    const message = error instanceof Error ? error.message : 'Demo request failed';
    return failure(config, new DemoHttpError(500, message));
  }
};
