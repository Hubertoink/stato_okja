import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveSurveyDashboardSummary } from '@/lib/surveys';
import DashboardActiveSurveys from './DashboardActiveSurveys';

const summary = (
  overrides: Partial<ActiveSurveyDashboardSummary> = {},
): ActiveSurveyDashboardSummary => ({
  id: 'round-2',
  title: 'Wünsche für den Offenen Treff',
  projectId: 'project-1',
  projectTitle: 'Offener Treff',
  roundNumber: 2,
  questionCount: 4,
  status: 'active',
  responsesCount: 25,
  expectedParticipants: 20,
  responseRate: 125,
  responsesToday: 3,
  responsesLast7Days: 12,
  lastResponseAt: '2026-08-09T08:00:00Z',
  startedAt: '2026-08-01T08:00:00Z',
  endsAt: '2026-08-31T21:00:00Z',
  ...overrides,
});

describe('DashboardActiveSurveys', () => {
  it('stays hidden when there are no active surveys', () => {
    const { container } = render(<DashboardActiveSurveys surveys={[]} onOpenSurvey={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the unbounded response rate while capping only the progress bar', () => {
    render(<DashboardActiveSurveys surveys={[summary()]} onOpenSurvey={vi.fn()} />);

    expect(screen.getByText('125 % Rücklauf')).toBeInTheDocument();
    const progressLabel = screen.getByLabelText('125 Prozent Rücklauf');
    expect(progressLabel.querySelector('[style*="width"]')).toHaveStyle({ width: '100%' });
  });

  it('expands operational values and opens the currently active round', async () => {
    const user = userEvent.setup();
    const onOpenSurvey = vi.fn();
    render(<DashboardActiveSurveys surveys={[summary()]} onOpenSurvey={onOpenSurvey} />);
    const toggle = screen.getByRole('button', { name: /Wünsche für den Offenen Treff/i });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Letzte 7 Tage')).toBeInTheDocument();
    expect(screen.getByText('Offener Treff')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Auswertung öffnen' }));
    expect(onOpenSurvey).toHaveBeenCalledWith('round-2');
  });

  it('keeps only one survey expanded and supports keyboard activation', async () => {
    const user = userEvent.setup();
    render(
      <DashboardActiveSurveys
        surveys={[
          summary({ id: 'round-a', title: 'Umfrage A', projectTitle: 'Projekt A' }),
          summary({ id: 'round-b', title: 'Umfrage B', projectTitle: 'Projekt B' }),
        ]}
        onOpenSurvey={vi.fn()}
      />,
    );
    const first = screen.getByRole('button', { name: /Umfrage A/i });
    const second = screen.getByRole('button', { name: /Umfrage B/i });

    first.focus();
    await user.keyboard('{Enter}');
    expect(within(first.closest('article') as HTMLElement).getByText('Projekt A')).toBeInTheDocument();
    second.focus();
    await user.keyboard(' ');
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Projekt A')).not.toBeInTheDocument();
    expect(screen.getByText('Projekt B')).toBeInTheDocument();
  });

  it('shows no target and no response states without a progress bar', async () => {
    const user = userEvent.setup();
    render(
      <DashboardActiveSurveys
        surveys={[summary({ responsesCount: 0, expectedParticipants: null, responseRate: null, lastResponseAt: null })]}
        onOpenSurvey={vi.fn()}
      />,
    );

    expect(screen.getByText('Kein Zielwert')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Prozent Rücklauf/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Wünsche für den Offenen Treff/i }));
    expect(screen.getByText('Noch keine Antwort')).toBeInTheDocument();
  });

  it('warns when the planned end date has passed while the survey remains active', async () => {
    const user = userEvent.setup();
    render(
      <DashboardActiveSurveys
        surveys={[summary({ endsAt: '2020-01-01T00:00:00Z' })]}
        onOpenSurvey={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Wünsche für den Offenen Treff/i }));
    expect(screen.getAllByText('Enddatum erreicht')).toHaveLength(2);
  });
});
