export const devToolsFeatureEnabled = import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';

export function canAccessDevTools(role?: string | null) {
  return devToolsFeatureEnabled && role === 'superadmin';
}