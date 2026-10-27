import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { applyTheme, DEFAULT_LIGHT_THEME } from '@/lib/theme';
import AppearanceSettings from './AppearanceSettings';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { patch: vi.fn() } }));
vi.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/lib/theme', async (original) => ({ ...await original<object>(), applyTheme: vi.fn() }));
const refresh = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ user: { theme: DEFAULT_LIGHT_THEME, themeMode: 'light' }, refresh } as unknown as ReturnType<typeof useAuth>);
});
it('persists appearance from settings', async () => {
  vi.mocked(api.patch).mockResolvedValue({ data: {} });
  render(<AppearanceSettings />);
  fireEvent.click(screen.getByRole('button', { name: /Darstellung anpassen/ }));
  fireEvent.change(screen.getByLabelText('Helligkeit'), { target: { value: 'dark' } });
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(api.patch).toHaveBeenCalledWith('/auth/me', { themeMode: 'dark' });
  expect(applyTheme).toHaveBeenCalledWith(DEFAULT_LIGHT_THEME, 'dark');
});
it('restores appearance when saving fails', async () => {
  vi.mocked(api.patch).mockRejectedValue(new Error('offline'));
  render(<AppearanceSettings />);
  fireEvent.click(screen.getByRole('button', { name: /Darstellung anpassen/ }));
  fireEvent.change(screen.getByLabelText('Helligkeit'), { target: { value: 'dark' } });
  await waitFor(() => expect(screen.getByLabelText('Helligkeit')).toHaveValue('light'));
  expect(applyTheme).toHaveBeenLastCalledWith(DEFAULT_LIGHT_THEME, 'light');
});
