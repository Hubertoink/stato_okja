import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnnualTargets from './AnnualTargets';
import AnnualTargetCards, { StatisticsTabs } from '@/components/AnnualTargetCards';
import {
  type AnnualTarget,
  targetMonths,
  targetPeriodLabel,
  targetCanClose,
} from '@/lib/annualTargets';

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
  default: ({
    children,
    title,
    headerActions,
  }: {
    children: React.ReactNode;
    title: string;
    headerActions?: React.ReactNode;
  }) => (
    <div role="dialog" aria-label={title}>
      <header>{headerActions}</header>
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
      expect(
        within(screen.getByRole('article', { name: 'Stunden Offene Tür' })).getByText('120 h', {
          selector: 'strong',
        }),
      ).toBeInTheDocument();
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
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '120 % der Jahresvorgabe',
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
  it('shows the actual gender share rather than its ratio to the target', () => {
    state.targets = [
      target({
        title: 'Weiblicher Anteil',
        metric: 'female_share_percent',
        target: 40,
        result: { value: 37, asOf: '2025-12-31', activityCount: 10, series: [] },
        evaluation: { met: false, difference: -3 },
      }),
    ];
    render(
      <MemoryRouter>
        <AnnualTargetCards year={2025} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '37');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '37 %; Mindestens 40 %');
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

  it('saves a cross-year period and explicitly labels percentage limits', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Winterangebot' } });
    fireEvent.change(screen.getByLabelText('Zielzeitraum'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '2024-12-01' } });
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2025-03-31' } });
    fireEvent.change(screen.getByLabelText('Kennzahl'), {
      target: { value: 'female_share_percent' },
    });
    fireEvent.change(screen.getByLabelText('Vorgabe'), { target: { value: 'range' } });
    expect(screen.getByLabelText('Untere Grenze (%)')).toHaveAttribute('max', '100');
    expect(screen.getByLabelText('Obere Grenze (%)')).toHaveAttribute('max', '100');
    fireEvent.change(screen.getByLabelText('Untere Grenze (%)'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Obere Grenze (%)'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf speichern' }));
    expect(state.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          year: 2024,
          dateFrom: '2024-12-01',
          dateTo: '2025-03-31',
          target: 30,
          upperTarget: 50,
        }),
      }),
      expect.anything(),
    );
    fireEvent.change(screen.getByLabelText('Zielzeitraum'), { target: { value: 'year' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf speichern' }));
    expect(state.mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ dateFrom: null, dateTo: null }),
      }),
      expect.anything(),
    );
  });

  it('keeps detail actions in the header, shows the goal first and collapses activities and history', async () => {
    show('/statistics/targets?year=2025&target=t1');
    const dialog = screen.getByRole('dialog', { name: 'Stunden Offene Tür' });
    const edit = within(dialog).getByRole('button', { name: 'Bearbeiten' });
    expect(edit.closest('header')).toBeInTheDocument();
    const requirement = within(dialog).getByText('Jahresvorgabe');
    const actual = within(dialog).getByText('Istwert');
    expect(
      requirement.compareDocumentPosition(actual) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const activityDisclosure = within(dialog)
      .getByText('Zugehörige Aktivitäten')
      .closest('details')!;
    expect(activityDisclosure).not.toHaveAttribute('open');
    expect(within(dialog).getByText('Änderungsverlauf').closest('details')).not.toHaveAttribute(
      'open',
    );
    expect(screen.queryByRole('region', { name: 'Aktivitätenliste' })).not.toBeInTheDocument();
    fireEvent.click(activityDisclosure.querySelector('summary')!);
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Aktivitätenliste' })).toBeInTheDocument(),
    );
  });

  it('preserves a custom period when editing and displays only its months', () => {
    state.targets = [target({ dateFrom: '2025-02-15', dateTo: '2025-03-20' })];
    show('/statistics/targets?year=2025&target=t1');
    const dialog = screen.getByRole('dialog', { name: 'Stunden Offene Tür' });
    expect(within(dialog).queryByText('Januar')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Februar')).toBeInTheDocument();
    expect(within(dialog).getByText('März')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getByLabelText('Von')).toHaveValue('2025-02-15');
    expect(screen.getByLabelText('Bis')).toHaveValue('2025-03-20');
  });

  it('navigates years through accessible arrow buttons on either side of the year picker', () => {
    show();
    const previous = screen.getByRole('button', { name: 'Vorjahr' });
    const next = screen.getByRole('button', { name: 'Folgejahr' });
    const input = screen.getByLabelText('Zieljahr');
    expect(previous.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(next);
    expect(screen.getByLabelText('Zieljahr')).toHaveValue(2026);
    fireEvent.click(previous);
    expect(screen.getByLabelText('Zieljahr')).toHaveValue(2025);
  });

  it('lists months across years and preserves the full-year default', () => {
    expect(targetMonths({ year: 2025, dateFrom: '2025-12-15', dateTo: '2026-02-02' })).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(targetMonths({ year: 2025 })).toHaveLength(12);
    expect(targetPeriodLabel({ year: 2025 })).toBe('01.01.2025 – 31.12.2025');
  });

  it('allows closing only after the inclusive period end in Berlin', () => {
    vi.useFakeTimers();
    try {
      const period = { year: 2025, dateFrom: '2025-02-01', dateTo: '2025-02-28' };
      vi.setSystemTime(new Date('2025-02-28T22:59:00Z'));
      expect(targetCanClose(period)).toBe(false);
      vi.setSystemTime(new Date('2025-02-28T23:01:00Z'));
      expect(targetCanClose(period)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses a linked project image as decoration and leaves other targets without a background image', () => {
    state.targets = [
      target({ scope: { projectId: 'p1' }, projectImageUrl: 'https://example.test/project.jpg' }),
    ];
    const { container, unmount } = render(
      <MemoryRouter>
        <AnnualTargetCards year={2025} />
      </MemoryRouter>,
    );
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://example.test/project.jpg');
    expect(image).toHaveAttribute('alt', '');
    expect(image?.closest('[aria-hidden="true"]')).toBeInTheDocument();
    unmount();
    state.targets = [target()];
    const fallback = render(
      <MemoryRouter>
        <AnnualTargetCards year={2025} />
      </MemoryRouter>,
    );
    expect(fallback.container.querySelector('img')).toBeNull();
  });
});
