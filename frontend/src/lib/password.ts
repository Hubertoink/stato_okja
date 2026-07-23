import { api } from './api';
import type { AdminResetActionMode } from './publicConfig';

export async function requestPasswordReset(email: string) {
  const res = await api.post('/auth/request-password-reset', { email });
  return res.data as { ok: boolean };
}

export async function resetPassword(token: string, password: string) {
  const res = await api.post('/auth/reset-password', { token, password });
  return res.data as { ok: boolean };
}

export async function validateResetToken(token: string) {
  const res = await api.post('/auth/validate-reset-token', { token });
  return res.data as { ok: boolean };
}

export async function adminResetPassword(payload: {
  userId: string;
  mode?: AdminResetActionMode;
  temporaryPassword?: string;
}) {
  const res = await api.post('/auth/admin-reset-password', payload);
  return res.data as { ok: boolean; mode?: AdminResetActionMode; mustChangePassword?: boolean };
}
