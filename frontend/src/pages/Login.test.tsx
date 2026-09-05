import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Login from './Login';
import { useAuth } from '@/lib/auth';
import { DEFAULT_PUBLIC_CONFIG, fetchPublicConfig } from '@/lib/publicConfig';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/publicConfig', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/publicConfig')>(), fetchPublicConfig: vi.fn(),
}));
vi.mock('@/components/LegalModals', () => ({
  CookieNoticeModal: () => null, ImprintModal: () => null,
  PrivacyNoticeModal: () => null, TermsOfUseModal: () => null,
}));

describe('initial setup journey', () => {
  it('submits code and chosen email, then opens the organization onboarding', async () => {
    const completeInitialSetup = vi.fn().mockResolvedValue({ ok: true });
    vi.mocked(useAuth).mockReturnValue({ completeInitialSetup } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(fetchPublicConfig).mockResolvedValue({ ...DEFAULT_PUBLIC_CONFIG, initialSetupRequired: true });
    render(<MemoryRouter><Routes>
      <Route path="/" element={<Login />} />
      <Route path="/admin/orgs" element={<p>Organisation einrichten</p>} />
    </Routes></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText(/Einrichtungscode/), { target: { value: 'a'.repeat(64) } });
    fireEvent.change(screen.getByLabelText('Deine Admin-E-Mail-Adresse'), { target: { value: 'team@stato.local' } });
    fireEvent.change(screen.getByLabelText('Admin-Passwort'), { target: { value: 'StatoTeam_123!Secure' } });
    fireEvent.change(screen.getByLabelText('Passwort wiederholen'), { target: { value: 'StatoTeam_123!Secure' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adminzugang einrichten' }));
    await waitFor(() => expect(completeInitialSetup).toHaveBeenCalledWith('StatoTeam_123!Secure', 'a'.repeat(64), 'team@stato.local'));
    expect(await screen.findByText('Organisation einrichten')).toBeInTheDocument();
  });
});
