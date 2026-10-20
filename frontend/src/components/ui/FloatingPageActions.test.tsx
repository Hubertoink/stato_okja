import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingPageActions } from './FloatingPageActions';
import { Input } from './Field';
import { PageHeader } from './PageHeader';
import { Button } from './Button';

let anchorBottom = 180;
const flushScroll = () => {
  fireEvent.scroll(window);
  act(() => vi.runOnlyPendingTimers());
};

beforeEach(() => {
  vi.useFakeTimers();
  anchorBottom = 180;
  vi.stubGlobal('innerWidth', 1280);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { bottom: this.classList.contains('page-actions-anchor') ? anchorBottom : 80, width: 320, height: 44 } as DOMRect;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Example() {
  return <>
    <header className="header-navigation-shell" />
    <FloatingPageActions label="Oktober 2026"><Input aria-label="Suche" defaultValue="Ausflug" /></FloatingPageActions>
  </>;
}

describe('desktop floating page actions', () => {
  it('keeps page actions and secondary view controls together in a single dock', () => {
    render(<><header className="header-navigation-shell" /><PageHeader title="Projekte" actions={<Button>Neues Projekt</Button>} secondaryActions={<Button>Liste</Button>} /></>);
    const create = screen.getByRole('button', { name: 'Neues Projekt' });
    const view = screen.getByRole('button', { name: 'Liste' });
    anchorBottom = 70;
    flushScroll();
    expect(create.closest('.page-actions-dock')).not.toBeNull();
    expect(view.closest('.page-actions-dock')).toBe(create.closest('.page-actions-dock'));
    expect(screen.getAllByRole('button')).toHaveLength(2);
    anchorBottom = 180;
    flushScroll();
    expect(view.closest('.page-actions-dock')).toBeNull();
    expect(screen.getByRole('button', { name: 'Liste' })).toBe(view);
  });

  it('keeps the same controls and focus when docking and restores them on scroll up', () => {
    const { container } = render(<Example />);
    const input = screen.getByRole('textbox');
    input.focus();
    expect(container.querySelector('.page-actions-dock')).toBeNull();
    anchorBottom = 70;
    flushScroll();
    expect(input.closest('.page-actions-dock')).not.toBeNull();
    expect(screen.getByText('Oktober 2026')).toBeVisible();
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Ausflug');
    expect(container.querySelector('.page-actions-anchor')).toHaveStyle({ height: '44px', width: '320px' });
    anchorBottom = 180;
    flushScroll();
    expect(container.querySelector('.page-actions-dock')).toBeNull();
    expect(container.querySelector('.page-actions-anchor')).not.toHaveAttribute('style', expect.stringContaining('height'));
    expect(input).toHaveFocus();
  });

  it('does not float on mobile and restores inline actions when resizing to mobile', () => {
    vi.stubGlobal('innerWidth', 390);
    anchorBottom = -100;
    const { container } = render(<Example />);
    flushScroll();
    expect(container.querySelector('.page-actions-dock')).toBeNull();
    vi.stubGlobal('innerWidth', 1280);
    fireEvent.resize(window);
    act(() => vi.runOnlyPendingTimers());
    expect(container.querySelector('.page-actions-dock')).not.toBeNull();
    vi.stubGlobal('innerWidth', 390);
    fireEvent.resize(window);
    act(() => vi.runOnlyPendingTimers());
    expect(container.querySelector('.page-actions-dock')).toBeNull();
  });
});
