import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const auth = vi.hoisted(() => ({ user: null as null | { role: string; mustChangePassword?: boolean; termsAcceptanceRequired?: boolean }, loading: false }));
const modules = vi.hoisted(() => ({ data: { logbook: true, surveys: true }, isPending: false, isError: false }));
vi.mock('./lib/organizationModules', () => ({ useOrganizationModules: () => modules }));
vi.mock('./lib/auth', () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('./lib/devToolsConfig', () => ({ canAccessDevTools: () => true }));
vi.mock('./lib/orgScope', () => ({ OrgScopeProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('./components/Toast', () => ({ ToastProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('./components/PostLoginPrefetch', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('./components/TermsAcceptanceGate', () => ({ default: () => <p>Accept terms</p> }));
vi.mock('./components/Layout', async () => {
  const { Link, Outlet } = await import('react-router-dom');
  return { default: () => <><Link to="/dashboard">Home</Link><Link to="/admin/system-data">Data</Link><Link to="/admin/dev-tools">Dev</Link><Outlet /></> };
});
vi.mock('./pages/Login', () => ({ default: () => <p>Login required</p> }));
vi.mock('./pages/Dashboard', () => ({ default: () => <p>Dashboard content</p> }));
vi.mock('./pages/SettingsTestData', () => ({ default: () => <p>Dev Tools content</p> }));
vi.mock('./pages/SuperAdminSystemData', () => ({ default: () => <p>Data management content</p> }));
vi.mock('./pages/MyProfile', () => ({ default: () => <p>Profile content</p> }));
vi.mock('./pages/Logbook', () => ({ default: () => <p>Logbook content</p> }));
vi.mock('./pages/SurveyDetail', () => ({ default: () => <p>Survey detail content</p> }));
vi.mock('./pages/ActivityEditPage', async () => {
  const { useParams, useLocation } = await import('react-router-dom');
  return { default: () => <p>Edit {useParams().id}{useLocation().search}</p> };
});
vi.mock('./pages/PublicSurvey', async () => {
  const { useParams } = await import('react-router-dom');
  return { default: () => <p>Public survey {useParams().token}</p> };
});

describe('application routing after the router upgrade', () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    modules.data.logbook = true;
    modules.data.surveys = true;
    window.history.replaceState(null, '', '/');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  it('requires login for a protected deep link', () => {
    window.history.replaceState(null, '', '/activities/42/edit');
    render(<App />);
    expect(screen.getByText('Login required')).toBeInTheDocument();
  });

  it('opens a public QR survey without authentication', async () => {
    window.history.replaceState(null, '', '/survey/qr-token');
    render(<App />);
    expect(await screen.findByText('Public survey qr-token')).toBeInTheDocument();
    expect(screen.queryByText('Login required')).not.toBeInTheDocument();
  });

  it('keeps deep-link parameters and supports navigation from the nested route', async () => {
    auth.user = { role: 'editor' };
    window.history.replaceState(null, '', '/activities/42/edit?returnTo=calendar');
    render(<App />);
    expect(await screen.findByText('Edit 42?returnTo=calendar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it.each([
    ['/logbook', 'logbook', 'Logbook content'],
    ['/surveys/42', 'surveys', 'Survey detail content'],
  ] as const)('checks the module flag for the protected deep link %s', async (path, module, content) => {
    auth.user = { role: 'editor' };
    modules.data[module] = false;
    window.history.replaceState(null, '', path);
    const { rerender } = render(<App />);
    expect(await screen.findByText('Modul deaktiviert')).toBeInTheDocument();
    expect(screen.queryByText(content)).not.toBeInTheDocument();
    modules.data[module] = true;
    rerender(<App />);
    expect(await screen.findByText(content)).toBeInTheDocument();
  });

  it('switches between superadmin data routes when only the pathname changes', async () => {
    auth.user = { role: 'superadmin' };
    window.history.replaceState(null, '', '/admin/system-data');
    render(<App />);
    expect(await screen.findByText('Data management content')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Dev' }));
    expect(await screen.findByText('Dev Tools content')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/dev-tools');
    fireEvent.click(screen.getByRole('link', { name: 'Data' }));
    expect(await screen.findByText('Data management content')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/system-data');
  });

  it('redirects unavailable admin routes to the dashboard', async () => {
    auth.user = { role: 'editor' };
    window.history.replaceState(null, '', '/admin/audit');
    render(<App />);
    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
  });

  it('enforces password change before a protected deep link', async () => {
    auth.user = { role: 'editor', mustChangePassword: true };
    window.history.replaceState(null, '', '/activities/42/edit');
    render(<App />);
    expect(await screen.findByText('Profile content')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/me');
  });

  it('enforces terms acceptance before navigation', () => {
    auth.user = { role: 'editor', termsAcceptanceRequired: true };
    render(<App />);
    expect(screen.getByText('Accept terms')).toBeInTheDocument();
  });
});
