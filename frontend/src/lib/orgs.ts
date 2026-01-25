import { api } from './api';

export interface OrgDto { id: string; name: string; parentId?: string | null; path?: string | null }

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
  monday:    { open: true,  from: '08:00', to: '17:00' },
  tuesday:   { open: true,  from: '08:00', to: '17:00' },
  wednesday: { open: true,  from: '08:00', to: '17:00' },
  thursday:  { open: true,  from: '08:00', to: '17:00' },
  friday:    { open: true,  from: '08:00', to: '17:00' },
  saturday:  { open: false },
  sunday:    { open: false },
};

export async function getOpeningHours(orgId: string): Promise<OpeningHours | null> {
  const res = await api.get<OpeningHours | null>(`/orgs/${orgId}/opening-hours`);
  return res.data;
}

export async function updateOpeningHours(orgId: string, hours: OpeningHours): Promise<OpeningHours> {
  const res = await api.patch<OpeningHours>(`/orgs/${orgId}/opening-hours`, hours);
  return res.data;
}
