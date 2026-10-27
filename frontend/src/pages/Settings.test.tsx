import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import Settings from './Settings';

const auth = vi.hoisted(() => ({ role: 'org_admin' }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: auth.role } }) }));
vi.mock('@/demo/DemoHoverHint', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/settings/SettingsContent', () => ({
  default: ({ tab }: { tab: string }) => <p data-testid="content">{tab}</p>,
}));
vi.mock('@/components/settings/ViewportDiagnostics', () => ({
  default: () => <aside aria-label="Viewport-Diagnose" />,
}));
function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function show(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/master-data" element={<Settings />} />
        <Route path="/operations" element={<Settings />} />
      </Routes>
    </MemoryRouter>,
  );
}
describe('separate configuration sections', () => {
  beforeEach(() => {
    auth.role = 'org_admin';
  });
  it('only enables viewport diagnostics explicitly in master data', async () => {
    const { unmount } = show('/master-data?viewportDebug=1');
    expect(await screen.findByLabelText('Viewport-Diagnose')).toBeInTheDocument();
    unmount();
    show('/settings?viewportDebug=1');
    expect(screen.queryByLabelText('Viewport-Diagnose')).not.toBeInTheDocument();
  });
  it('keeps normal master data free of diagnostics', () => {
    show('/master-data');
    expect(screen.queryByLabelText('Viewport-Diagnose')).not.toBeInTheDocument();
  });
  it('keeps personal settings free of taxonomy and operations tabs', () => {
    show('/settings');
    expect(screen.getByRole('heading', { name: 'Persönliche Einstellungen' })).toBeInTheDocument();
    expect(screen.getByTestId('content')).toHaveTextContent('appearance');
    expect(screen.queryByRole('link', { name: 'Kategorien' })).not.toBeInTheDocument();
  });
  it('redirects legacy taxonomy bookmarks and keeps query parameters', () => {
    show('/settings?tab=tags&source=bookmark');
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/master-data?tab=tags&source=bookmark',
    );
    expect(screen.getByRole('heading', { name: 'Stammdaten' })).toBeInTheDocument();
    expect(screen.getByTestId('content')).toHaveTextContent('tags');
    fireEvent.click(screen.getByRole('link', { name: 'Altersgruppen' }));
    expect(screen.getByTestId('location')).toHaveTextContent('tab=cohorts');
    expect(screen.getByTestId('content')).toHaveTextContent('cohorts');
  });
  it('redirects opening-hours bookmarks to operations', () => {
    show('/settings?tab=openingHours');
    expect(screen.getByRole('heading', { name: 'Betrieb' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Öffnungszeiten' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('link', { name: 'Tags' })).not.toBeInTheDocument();
  });
  it('does not expose admin-only templates via direct query parameters', () => {
    auth.role = 'user';
    show('/master-data?tab=templates');
    expect(screen.getByTestId('content')).toHaveTextContent('categories');
    expect(screen.queryByRole('link', { name: 'Vorlagen' })).not.toBeInTheDocument();
  });
});
