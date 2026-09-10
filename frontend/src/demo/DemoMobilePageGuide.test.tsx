import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DemoMobilePageGuide from './DemoMobilePageGuide';
import { setDemoMobileGuideMuted } from './mobileGuideState';

const mode = vi.hoisted(() => ({ demo: true, mobile: true }));
vi.mock('@/lib/useBodyScrollLock', () => ({ useBodyScrollLock: () => undefined }));
vi.mock('./config', () => ({ get demoModeEnabled() { return mode.demo; } }));
vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: () => mode.mobile }));

function showGuide(path: string) {
  const result = render(<MemoryRouter initialEntries={[path]}><DemoMobilePageGuide /></MemoryRouter>);
  act(() => vi.advanceTimersByTime(1100));
  return result;
}
describe('mobile demo page guidance', () => {
  beforeEach(() => { vi.useFakeTimers(); mode.demo = true; mode.mobile = true; setDemoMobileGuideMuted(false); });
  afterEach(() => { vi.useRealTimers(); });
  it.each(['/dashboard', '/activities', '/calendar', '/projects', '/statistics', '/settings', '/logbook', '/surveys'])('renders %s outside the page layout', (path) => {
    const { container } = showGuide(path);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
  it('closes with Escape', () => {
    showGuide('/projects');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog').parentElement).toHaveAttribute('data-state', 'closing');
    act(() => vi.advanceTimersByTime(250));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps the layout class and exposes the active state when toggled in either direction', () => {
    showGuide('/projects');
    const toggle = screen.getByRole('switch');
    const layoutClass = toggle.className;
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveClass('demo-mobile-page-guide-session-toggle');
    expect(toggle.className).toBe(layoutClass);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle.className).toBe(layoutClass);
  });
  it('mutes further hints only after confirmation', () => {
    const { unmount } = showGuide('/projects');
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verstanden' }));
    act(() => vi.advanceTimersByTime(250));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    showGuide('/activities');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it.each(['production', 'desktop', 'unsupported'])('does not show mobile guidance for %s', (kind) => {
    mode.demo = kind !== 'production'; mode.mobile = kind !== 'desktop';
    showGuide(kind === 'unsupported' ? '/me' : '/projects');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
