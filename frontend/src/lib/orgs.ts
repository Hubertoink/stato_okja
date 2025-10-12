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
