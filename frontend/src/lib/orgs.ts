import { api } from './api';

export interface OrgDto { id: string; name: string }

export async function listOrgs(): Promise<OrgDto[]> {
  const res = await api.get<OrgDto[]>('/orgs');
  return res.data;
}

export async function createOrgApi(name: string): Promise<OrgDto> {
  const res = await api.post<OrgDto>('/orgs', { name });
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
