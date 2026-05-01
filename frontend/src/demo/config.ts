import type { AuthUser } from '../lib/auth';

export const demoModeEnabled =
  typeof import.meta !== 'undefined' && import.meta.env.VITE_DEMO_MODE === 'true';

export const DEMO_ORG_ID = 'demo-org';
export const DEMO_USER_ID = 'demo-user';

export const demoUser: AuthUser = {
  id: DEMO_USER_ID,
  email: 'demo@stato-okja.de',
  name: 'Demo Admin',
  role: 'org_admin',
  orgId: DEMO_ORG_ID,
  orgName: 'Demo Jugendhaus',
  avatarUrl: null,
  theme: 'Default Theme',
  mustChangePassword: false,
};