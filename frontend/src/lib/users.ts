import { api } from './api';
import type { Role } from './auth';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId?: string | null;
  org?: { id: string; name: string } | null;
}

export async function fetchUsers(): Promise<UserDto[]> {
  const res = await api.get<UserDto[]>('/users');
  return res.data;
}

export async function fetchGlobalUsers(): Promise<UserDto[]> {
  const res = await api.get<UserDto[]>('/users/directory');
  return res.data;
}

export async function updateUserApi(
  id: string,
  patch: { role?: Exclude<Role, 'superadmin'>; orgId?: string | null },
) {
  await api.patch(`/users/${id}`, patch);
}

export async function removeUserApi(id: string) {
  await api.delete(`/users/${id}`);
}
