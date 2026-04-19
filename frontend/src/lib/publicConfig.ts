import { api } from './api';
import { useQuery } from '@tanstack/react-query';

export type PasswordResetMode = 'email' | 'admin_temp_password' | 'hybrid';
export type AdminResetActionMode = 'email' | 'temporary_password';

export interface PublicConfig {
  appName: string;
  orgName: string | null;
  loginTitle: string;
  loginSubtitle: string;
  liveRefreshIntervalMs: number;
  twoFactorEnabled: boolean;
  passwordResetMode: PasswordResetMode;
  forgotPasswordEnabled: boolean;
  adminTemporaryPasswordEnabled: boolean;
}

export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  appName: 'StatO',
  orgName: null,
  loginTitle: 'StatO',
  loginSubtitle: 'OKJA Statistik & Dokumentation',
  liveRefreshIntervalMs: 15000,
  twoFactorEnabled: false,
  passwordResetMode: 'email',
  forgotPasswordEnabled: true,
  adminTemporaryPasswordEnabled: false,
};

function parseLiveRefreshIntervalMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_PUBLIC_CONFIG.liveRefreshIntervalMs;
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  const res = await api.get<Partial<PublicConfig>>('/auth/public-config');
  const data = res.data || {};
  const mode =
    data.passwordResetMode === 'admin_temp_password' ||
    data.passwordResetMode === 'hybrid' ||
    data.passwordResetMode === 'email'
      ? data.passwordResetMode
      : DEFAULT_PUBLIC_CONFIG.passwordResetMode;

  return {
    appName: String(data.appName || DEFAULT_PUBLIC_CONFIG.appName),
    orgName: typeof data.orgName === 'string' && data.orgName.trim() ? data.orgName.trim() : null,
    loginTitle: String(data.loginTitle || DEFAULT_PUBLIC_CONFIG.loginTitle),
    loginSubtitle: String(data.loginSubtitle || DEFAULT_PUBLIC_CONFIG.loginSubtitle),
    liveRefreshIntervalMs: parseLiveRefreshIntervalMs(data.liveRefreshIntervalMs),
    twoFactorEnabled: typeof data.twoFactorEnabled === 'boolean' ? data.twoFactorEnabled : DEFAULT_PUBLIC_CONFIG.twoFactorEnabled,
    passwordResetMode: mode,
    forgotPasswordEnabled:
      typeof data.forgotPasswordEnabled === 'boolean'
        ? data.forgotPasswordEnabled
        : mode !== 'admin_temp_password',
    adminTemporaryPasswordEnabled:
      typeof data.adminTemporaryPasswordEnabled === 'boolean'
        ? data.adminTemporaryPasswordEnabled
        : mode !== 'email',
  };
}

export function usePublicConfig() {
  return useQuery({
    queryKey: ['public-config'],
    queryFn: fetchPublicConfig,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  });
}