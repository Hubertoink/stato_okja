import { api } from './api';

export interface OrgDto { id: string; name: string; parentId?: string | null; path?: string | null }

export interface OrgTaxonomyTypeSetting {
  allowOwn: boolean;
  inheritedIds: string[];
  inheritAll: boolean;
}

export interface VisibleTaxonomyItem {
  id: string;
  name: string;
  orgId?: string | null;
  sourceOrgId?: string | null;
  sourceOrgName?: string | null;
  isInherited?: boolean;
  canManage?: boolean;
}

export interface OrgTaxonomySettingsSnapshot {
  orgId: string;
  orgName: string;
  parentId: string | null;
  parentName: string | null;
  hasExplicitSettings: boolean;
  hasChildDefaults: boolean;
  childCount: number;
  settings: {
    categories: OrgTaxonomyTypeSetting;
    tags: OrgTaxonomyTypeSetting;
    cohorts: OrgTaxonomyTypeSetting;
  };
  settingsSource: {
    categories: { mode: 'explicit' | 'default' | 'legacy'; sourceOrgId: string | null; sourceOrgName: string | null };
    tags: { mode: 'explicit' | 'default' | 'legacy'; sourceOrgId: string | null; sourceOrgName: string | null };
    cohorts: { mode: 'explicit' | 'default' | 'legacy'; sourceOrgId: string | null; sourceOrgName: string | null };
  };
  fallbackSettings: {
    categories: OrgTaxonomyTypeSetting;
    tags: OrgTaxonomyTypeSetting;
    cohorts: OrgTaxonomyTypeSetting;
  };
  fallbackSource: {
    categories: { mode: 'default' | 'legacy'; sourceOrgId: string | null; sourceOrgName: string | null };
    tags: { mode: 'default' | 'legacy'; sourceOrgId: string | null; sourceOrgName: string | null };
    cohorts: { mode: 'default' | 'legacy'; sourceOrgId: string | null; sourceOrgName: string | null };
  };
  childDefaults: {
    categories: OrgTaxonomyTypeSetting;
    tags: OrgTaxonomyTypeSetting;
    cohorts: OrgTaxonomyTypeSetting;
  };
  access: {
    categories: { canCreateOwn: boolean };
    tags: { canCreateOwn: boolean };
    cohorts: { canCreateOwn: boolean };
  };
  parentOptions: {
    categories: VisibleTaxonomyItem[];
    tags: VisibleTaxonomyItem[];
    cohorts: Array<VisibleTaxonomyItem & { minAge?: number; maxAge?: number }>;
  };
  childDefaultOptions: {
    categories: VisibleTaxonomyItem[];
    tags: VisibleTaxonomyItem[];
    cohorts: Array<VisibleTaxonomyItem & { minAge?: number; maxAge?: number }>;
  };
}

export interface OrgTaxonomySettingsUpdatePayload {
  settings?: OrgTaxonomySettingsSnapshot['settings'] | null;
  childDefaults?: OrgTaxonomySettingsSnapshot['childDefaults'] | null;
}

export interface OrgMoveImpactItem {
  id: string;
  name: string;
  sourceOrgId: string | null;
  sourceOrgName: string | null;
}

export interface OrgMovePreview {
  currentParentId: string | null;
  newParentId: string | null;
  affectedOrgs: number;
  requiresConfirmation: boolean;
  resetNotice: string;
  lost: {
    categories: OrgMoveImpactItem[];
    tags: OrgMoveImpactItem[];
    cohorts: OrgMoveImpactItem[];
  };
  gained: {
    categories: OrgMoveImpactItem[];
    tags: OrgMoveImpactItem[];
    cohorts: OrgMoveImpactItem[];
  };
  activityConflicts: {
    categories: { activities: number; items: OrgMoveImpactItem[] };
    tags: { activities: number; items: OrgMoveImpactItem[] };
    cohorts: { activities: number; items: OrgMoveImpactItem[] };
  };
  projectConflicts: {
    categories: { projects: number; items: OrgMoveImpactItem[] };
  };
}

export async function listOrgs(): Promise<OrgDto[]> {
  const res = await api.get<OrgDto[]>('/orgs');
  return res.data;
}

export async function createOrgApi(name: string, parentId?: string | null): Promise<OrgDto> {
  const res = await api.post<OrgDto>('/orgs', { name, parentId: typeof parentId === 'undefined' ? undefined : parentId });
  return res.data;
}

export async function inviteUserApi(payload: { email: string; name?: string; role?: 'org_admin'|'user'; orgId?: string|null }): Promise<{ token: string }> {
  const res = await api.post<{ token: string }>('/auth/invite', payload);
  return res.data;
}

export async function acceptInviteApi(token: string, password: string) {
  const res = await api.post('/auth/accept-invite', { token, password });
  return res.data as { access_token: string };
}

export async function listUsersByOrg(orgId: string, includeSubtree = false) {
  const res = await api.get('/orgs/' + orgId + '/users', { params: { includeSubtree } });
  return res.data as Array<{ id: string; email: string; name: string; role: string; orgId?: string | null }>;
}

export async function moveOrgApi(id: string, parentId: string | null) {
  const res = await api.patch(`/orgs/${id}/move`, { parentId });
  return res.data as OrgDto;
}

export async function previewMoveOrgApi(id: string, parentId: string | null) {
  const res = await api.post<OrgMovePreview>(`/orgs/${id}/move-preview`, { parentId });
  return res.data;
}

export async function moveOrgWithConfirmationApi(id: string, parentId: string | null, force: boolean) {
  const res = await api.patch<OrgDto>(`/orgs/${id}/move`, { parentId, force });
  return res.data;
}

export async function getOrgTaxonomySettings(orgId: string) {
  const res = await api.get<OrgTaxonomySettingsSnapshot>(`/orgs/${orgId}/taxonomy-settings`);
  return res.data;
}

export async function updateOrgTaxonomySettings(orgId: string, payload: OrgTaxonomySettingsUpdatePayload) {
  const res = await api.patch<OrgTaxonomySettingsSnapshot>(`/orgs/${orgId}/taxonomy-settings`, payload);
  return res.data;
}

// Delete an organization (superadmin only). Returns { ok: true } on success.
export async function deleteOrgApi(id: string): Promise<{ ok: true }> {
  const res = await api.delete(`/orgs/${id}`);
  return res.data as { ok: true };
}

// --- Opening Hours ---
export interface DayOpeningHours {
  open: boolean;
  from?: string; // HH:mm format
  to?: string;   // HH:mm format
}

export interface OpeningHours {
  monday: DayOpeningHours;
  tuesday: DayOpeningHours;
  wednesday: DayOpeningHours;
  thursday: DayOpeningHours;
  friday: DayOpeningHours;
  saturday: DayOpeningHours;
  sunday: DayOpeningHours;
}

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  monday:    { open: false, from: '08:00', to: '17:00' },
  tuesday:   { open: false, from: '08:00', to: '17:00' },
  wednesday: { open: false, from: '08:00', to: '17:00' },
  thursday:  { open: false, from: '08:00', to: '17:00' },
  friday:    { open: false, from: '08:00', to: '17:00' },
  saturday:  { open: false, from: '08:00', to: '17:00' },
  sunday:    { open: false, from: '08:00', to: '17:00' },
};

export async function getOpeningHours(orgId: string): Promise<OpeningHours | null> {
  const res = await api.get<OpeningHours | null>(`/orgs/${orgId}/opening-hours`);
  return res.data;
}

export async function updateOpeningHours(orgId: string, hours: OpeningHours): Promise<OpeningHours> {
  const res = await api.patch<OpeningHours>(`/orgs/${orgId}/opening-hours`, hours);
  return res.data;
}
