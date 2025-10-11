export type Role = 'superadmin' | 'org_admin' | 'user';

export interface Org {
  id: string;
  name: string;
}

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId?: string;
  password?: string; // mock only
  invited?: boolean; // mock invitation flag
}

const KEYS = {
  users: 'mock_users',
  orgs: 'mock_orgs',
  current: 'mock_current_user',
};

function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);
}

export function loadUsers(): MockUser[] {
  const raw = localStorage.getItem(KEYS.users);
  return raw ? (JSON.parse(raw) as MockUser[]) : [];
}

export function saveUsers(list: MockUser[]) {
  localStorage.setItem(KEYS.users, JSON.stringify(list));
}

export function loadOrgs(): Org[] {
  const raw = localStorage.getItem(KEYS.orgs);
  return raw ? (JSON.parse(raw) as Org[]) : [];
}

export function saveOrgs(list: Org[]) {
  localStorage.setItem(KEYS.orgs, JSON.stringify(list));
}

export function getCurrentUser(): MockUser | null {
  const raw = localStorage.getItem(KEYS.current);
  return raw ? (JSON.parse(raw) as MockUser) : null;
}

export function setCurrentUser(u: MockUser | null) {
  if (u) localStorage.setItem(KEYS.current, JSON.stringify(u));
  else localStorage.removeItem(KEYS.current);
}

export function ensureSeed() {
  let users = loadUsers();
  if (!users.some((u) => u.role === 'superadmin')) {
    const admin: MockUser = {
      id: uid('u_'),
      email: 'admin@example.com',
      name: 'Super Admin',
      role: 'superadmin',
      password: 'admin',
    };
    users = [...users, admin];
    saveUsers(users);
  }
}

export function createOrg(name: string): Org {
  const orgs = loadOrgs();
  const org: Org = { id: uid('o_'), name };
  saveOrgs([...orgs, org]);
  return org;
}

export function createUser(data: Omit<MockUser, 'id'>): MockUser {
  const users = loadUsers();
  const user: MockUser = { id: uid('u_'), ...data };
  saveUsers([...users, user]);
  return user;
}

export function updateUser(id: string, patch: Partial<MockUser>): MockUser | null {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  saveUsers(users);
  return users[idx];
}

export function listUsersByOrg(orgId: string): MockUser[] {
  return loadUsers().filter((u) => u.orgId === orgId);
}

export function removeUser(id: string) {
  const users = loadUsers().filter((u) => u.id !== id);
  saveUsers(users);
}
