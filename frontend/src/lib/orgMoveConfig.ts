export const orgMoveFeatureEnabled = import.meta.env.VITE_ENABLE_ORG_MOVE === 'true';

export function canAccessOrgMove(role?: string | null) {
  return orgMoveFeatureEnabled && role === 'superadmin';
}