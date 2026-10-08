import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnnualTargets from './AnnualTargets';
import AnnualTargetCards, { StatisticsTabs } from '@/components/AnnualTargetCards';
import type { AnnualTarget } from '@/lib/annualTargets';

const state = vi.hoisted(() => ({
  role: 'org_admin',
  enabled: true,
  targets: [] as AnnualTarget[],
  mutate: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: state.role } }) }));
vi.mock('@/lib/publicConfig', () => ({
  usePublicConfig: () => ({ data: { annualTargetsEnabled: state.enabled } }),
}));
vi.mock('@/lib/orgScope', () => ({ useOrgScopeKey: () => 'org-1' }));
vi.mock('@/lib/useActiveOrganizationName', () => ({
  useActiveOrganizationName: () => 'Jugendhaus',
}));
vi.mock('@/lib/projects', () => ({
  useProjects: () => ({ data: [{ id: 'p1', title: 'Medienwerkstatt' }] }),
}));
vi.mock('@/lib/activities', () => ({
  useActivity: () => ({ data: undefined }),
  useActivitiesPaged: () => ({ data: { data: [], total: 0 } }),
}));
vi.mock('@/components/Modal', () => ({
  useModalHistory: (onClose: () => void) => ({ dismiss: onClose }),
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}));
vi.mock('@/lib/useBodyScrollLock', () => ({ useBodyScrollLock: () => undefined }));
vi.mock('@/lib/annualTargets', async (original) => ({
  ...(await original<typeof import('@/lib/annualTargets')>()),
  useAnnualTargets: () => ({ data: state.targets }),
  useAnnualTarget: () => ({ data: state.targets[0] }),
  useTargetActivities: () => ({ data: { items: [], total: 0, pageSize: 25 } }),
  useTargetMutation: () => ({ mutate: state.mutate }),
}));

const target = (overrides: Partial<AnnualTarget> = {}): AnnualTarget => ({
  id: 't1',
  orgId: 'org-1',
  title: 'Stunden Offene Tür',
  year: 2025,
  metric: 'duration_hours',
  scope: { types: ['open_door'] },
  scopeLabel: 'Offene Tür',
  rule: 'min',
  target: 100,
  upperTarget: null,
  status: 'active',
  showOnDashboard: true,
  description: '',
  review: '',
  version: 2,
  snapshot: null,
  history: [],
  result: { value: 120, asOf: '2025-12-31', activityCount: 10, series: [] },
  current: { value: 120, asOf: '2025-12-31', activityCount: 10, series: [] },
  dataChanged: false,
  evaluation: { met: true, difference: 20 },
  ...overrides,
});
const show = (path = '/statistics/targets?year=2025') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AnnualTargets />
    </MemoryRouter>,
  );

describe('Annual target UI permissions and flows', () => {
  beforeEach(() => {
    state.role = 'org_admin';
    state.enabled = true;
    state.targets = [target()];
    state.mutate.mockReset();
  });
  afterEach(cleanup);
  it.each(['editor', 'user'])(
    'lets %s read the report and detail without modification controls',
    (role) => {
      state.role = role;
      show('/statistics/targets?year=2025&target=t1');
      expect(screen.getByText('120 h', { selector: 'strong' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument();
      for (const name of [
        'Ziel hinzufügen',
        'Bearbeiten',
        'Jahr abschließen',
        'Für 2026 übernehmen',
      ])
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      expect(screen.getByText('Berechnungsgrundlage')).toBeInTheDocument();
    },
  );
  it('lets an admin create a project-specific draft from a contextual entry', () => {
    show('/statistics/targets?year=2025&projectId=p1');
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Medienwerkstatt Besuche' },
    });
    fireEvent.change(screen.getByLabelText('Kennzahl'), { target: { value: 'participant_total' } });
    fireEvent.change(screen.getByLabelText('Zielwert'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'save',
        payload: expect.objectContaining({
          title: 'Medienwerkstatt Besuche',
          year: 2025,
          metric: 'participant_total',
          scope: { projectId: 'p1' },
          target: 250,
        }),
      }),
      expect.anything(),
    );
  });
  it('hides navigation, cards and direct route when disabled', () => {
    state.enabled = false;
    render(
      <MemoryRouter>
        <StatisticsTabs />
        <AnnualTargetCards />
        <AnnualTargets />
      </MemoryRouter>,
    );
    expect(screen.getByText('Jahresziele deaktiviert')).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Statistikansichten' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ziel hinzufügen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Jahresziele' })).not.toBeInTheDocument();
  });
  it('selects a project through the activity project picker while preserving the target draft', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Titel'), {
      target: { value: 'Medienwerkstatt Besuche' },
    });
    fireEvent.change(screen.getByLabelText('Kennzahl'), { target: { value: 'participant_total' } });
    fireEvent.change(screen.getByLabelText('Zielwert'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('Geltungsbereich'), { target: { value: 'project' } });
    expect(screen.getByRole('button', { name: 'Entwurf speichern' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Projekt auswählen' }));
    fireEvent.click(screen.getByRole('button', { name: /Medienwerkstatt/ }));
    expect(
      screen.getByRole('button', { name: 'Projekt auswählen: Medienwerkstatt' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Titel')).toHaveValue('Medienwerkstatt Besuche');
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'save',
        payload: expect.objectContaining({
          scope: { projectId: 'p1' },
          metric: 'participant_total',
          target: 250,
        }),
      }),
      expect.anything(),
    );
  });
  it('retains the unbounded achievement value but caps the visual bar', () => {
    render(
      <MemoryRouter>
        <AnnualTargetCards year={2025} />
      </MemoryRouter>,
    );
    expect(screen.getByText('120 % der Jahresvorgabe')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100');
  });
  it('shows saved and corrected values separately after closing', () => {
    state.targets = [
      target({
        status: 'closed',
        dataChanged: true,
        current: { value: 130, asOf: '2025-12-31', activityCount: 11, series: [] },
      }),
    ];
    show('/statistics/targets?year=2025&target=t1');
    expect(
      screen.getByText(/Gespeicherter Abschluss: 120 h · Aktuell berechnet: 130 h/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wieder öffnen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument();
  });
});
