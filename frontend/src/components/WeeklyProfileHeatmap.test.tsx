import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WeeklyProfileHeatmap from './WeeklyProfileHeatmap';
import type { WeeklyProfile, WeeklyProfileSlot } from '@/lib/weeklyProfile';

vi.mock('@/i18n/formatters', () => ({ getCurrentIntlLocale: () => 'de-DE' }));

const slot: WeeklyProfileSlot = {
  weekday: 1, startMinute: 600, endMinute: 630,
  activityMinutes: 30, coveredMinutes: 30, activityCount: 1, participantTotal: 12,
  averageOffers: 0.5, averageParticipants: 12.5, coverageFrequency: 0.5,
};
const profile: WeeklyProfile = {
  slotMinutes: 30, rangeStart: 600, rangeEnd: 660, excludedWithoutTime: 0, days: [],
  slots: [slot, { ...slot, startMinute: 630, endMinute: 660, averageOffers: 1.5, averageParticipants: 20.5 }],
};

describe('weekly profile export values', () => {
  it('matches the selected metric and resolution, with zeroes distinct from excluded days', () => {
    const { container } = render(<WeeklyProfileHeatmap profile={profile} selectedWeekdays={[1, 2]} isMobile={false} />);
    expect(screen.getByRole('gridcell', { name: 'Mo 10:00' })).toHaveAttribute('data-export-value', '1');
    expect(screen.getByRole('gridcell', { name: 'Di 10:00' })).toHaveAttribute('data-export-value', '0');
    expect(screen.getByRole('gridcell', { name: 'Mi 10:00' })).toHaveAttribute('data-export-value', '\u2014');
    expect(screen.getByRole('gridcell', { name: 'Mo 10:00' })).toHaveTextContent('');
    fireEvent.click(screen.getByRole('tab', { name: 'Besucher:innen' }));
    expect(screen.getByRole('gridcell', { name: 'Mo 10:00' })).toHaveAttribute('data-export-value', '16,5');
    fireEvent.click(screen.getByRole('switch', { name: 'Zeitauflösung des Wochenprofils' }));
    expect(screen.getByRole('gridcell', { name: 'Mo 10:00' })).toHaveAttribute('data-export-value', '12,5');
    expect(screen.getByRole('gridcell', { name: 'Mo 10:30' })).toHaveAttribute('data-export-value', '20,5');
    expect(container.querySelector('[data-export-only]')).toHaveTextContent('Ø Besucher:innen');
    expect(container.querySelector('[data-export-only]')).toHaveTextContent('30 Min.');
  });
});
