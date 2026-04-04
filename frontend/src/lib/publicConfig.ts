import { api } from './api';

export type PasswordResetMode = 'email' | 'admin_temp_password' | 'hybrid';
export type AdminResetActionMode = 'email' | 'temporary_password';

export interface PublicConfig {
  appName: string;
  orgName: string | null;
  loginTitle: string;
  loginSubtitle: string;
  passwordResetMode: PasswordResetMode;
  forgotPasswordEnabled: boolean;
  adminTemporaryPasswordEnabled: boolean;
}

export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  appName: 'StatO',
  orgName: null,
  loginTitle: 'StatO',
  loginSubtitle: 'OKJA Statistik & Dokumentation',
  passwordResetMode: 'email',
  forgotPasswordEnabled: true,
  adminTemporaryPasswordEnabled: false,
};

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