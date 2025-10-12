import { api } from './api';

export async function requestPasswordReset(email: string) {
  const res = await api.post('/auth/request-password-reset', { email });
  return res.data as { ok: boolean };
}

export async function resetPassword(token: string, password: string) {
  const res = await api.post('/auth/reset-password', { token, password });
  return res.data as { ok: boolean };
}

export async function adminResetPassword(userId: string) {
  const res = await api.post('/auth/admin-reset-password', { userId });
  return res.data as { ok: boolean };
}
