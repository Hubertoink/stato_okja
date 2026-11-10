import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAuth } from '@/lib/auth';
import { DASHBOARD_SECTIONS, loadDashboardLayout, normalizeDashboardLayout } from '@/lib/dashboardLayout';
import DashboardLayoutSettings from './DashboardLayoutSettings';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'layout-user' } } as ReturnType<typeof useAuth>);
});
const labels = () => within(screen.getByRole('list')).getAllByRole('listitem').map(item => item.querySelector('span')?.textContent);

it('moves sections in both directions, persists per user and resets', () => {
  const view = render(<DashboardLayoutSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Jahresziele nach oben' }));
  expect(labels()[5]).toBe('Jahresziele');
  expect(loadDashboardLayout('layout-user')[5]).toBe('annualTargets');
  expect(loadDashboardLayout('other-user')).toEqual(DASHBOARD_SECTIONS);
  view.unmount();
  render(<DashboardLayoutSettings />);
  expect(labels()[5]).toBe('Jahresziele');
  fireEvent.click(screen.getByRole('button', { name: 'Jahresziele nach unten' }));
  expect(labels()[6]).toBe('Jahresziele');
  fireEvent.click(screen.getByRole('button', { name: 'Öffnungszeiten nach unten' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
  expect(loadDashboardLayout('layout-user')).toEqual(DASHBOARD_SECTIONS);
  expect(screen.getByRole('button', { name: 'Öffnungszeiten nach oben' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Letzte Aktionen nach unten' })).toBeDisabled();
});

it('recovers missing sections and removes invalid or duplicate saved entries', () => {
  const order = normalizeDashboardLayout(['annualTargets', 'removed', 'annualTargets']);
  expect(order[0]).toBe('annualTargets');
  expect(order).toHaveLength(DASHBOARD_SECTIONS.length);
  expect(new Set(order)).toEqual(new Set(DASHBOARD_SECTIONS));
  localStorage.setItem('dashboard_layout_v1:layout-user', 'invalid json');
  expect(loadDashboardLayout('layout-user')).toEqual(DASHBOARD_SECTIONS);
});

it('reports a failed save without pretending the layout was stored', () => {
  render(<DashboardLayoutSettings />);
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  fireEvent.click(screen.getByRole('button', { name: 'Jahresziele nach oben' }));
  expect(screen.getByRole('alert')).toHaveTextContent('konnte nicht gespeichert werden');
  expect(labels()[6]).toBe('Jahresziele');
  storage.mockRestore();
});
