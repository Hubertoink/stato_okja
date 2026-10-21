import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveFilterPanel } from './ResponsiveFilterPanel';
import { Button } from './Button';
import { PAGE_ACTIONS_POSITION_EVENT } from './FloatingPageActions';

let triggerRight = 350;
let dockTop = 600;
const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

function Example({ explicitAnchor = false, docked = true } = {}) {
  const [open, setOpen] = useState(true);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panel = <ResponsiveFilterPanel anchorRef={explicitAnchor ? anchorRef : undefined} open={open} onClose={() => setOpen(false)} title="Filter">
    <Button>Auswahl</Button>
  </ResponsiveFilterPanel>;
  return <>
    <header className="header-navigation-shell" />
    <div className={docked ? 'page-actions-dock' : ''}>
      <div ref={anchorRef} data-testid="trigger-wrapper">
        <Button aria-expanded={open} onClick={() => setOpen(value => !value)}>Öffnen</Button>
        {!explicitAnchor && panel}
      </div>
    </div>
    {explicitAnchor && panel}
    <Button>Außerhalb</Button>
  </>;
}

beforeEach(() => {
  triggerRight = 350;
  dockTop = 600;
  vi.stubGlobal('innerWidth', 1024);
  vi.stubGlobal('innerHeight', 768);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('header-navigation-shell')) return rect(0, 0, 1024, 100);
    if (this.classList.contains('page-actions-dock')) return rect(250, dockTop, 500, 140);
    if (this.dataset.testid === 'trigger-wrapper') return rect(triggerRight - 44, dockTop + 12, 44, 44);
    return rect(0, 0, 768, 1000);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('responsive filter positioning', () => {
  it.each([false, true])('keeps a wide flyout above the dock and below the header (explicit anchor: %s)', explicitAnchor => {
    render(<Example explicitAnchor={explicitAnchor} />);
    expect(screen.getByRole('dialog')).toHaveStyle({ position: 'fixed', left: '16px', bottom: '176px', maxHeight: '484px', margin: '0px' });
    // Dock height changes and the viewport gets shorter: recompute available space.
    dockTop = 420;
    vi.stubGlobal('innerHeight', 600);
    fireEvent(window, new Event(PAGE_ACTIONS_POSITION_EVENT));
    expect(screen.getByRole('dialog')).toHaveStyle({ bottom: '188px', maxHeight: '304px' });
  });

  it('clamps to the right viewport edge and opens beneath an inline trigger', () => {
    triggerRight = 1100;
    dockTop = 120;
    render(<Example docked={false} />);
    expect(screen.getByRole('dialog')).toHaveStyle({ left: '240px', top: '184px', maxHeight: '568px' });
  });

  it('allows interaction inside, toggles closed with its trigger and restores focus on Escape', () => {
    render(<Example />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Auswahl' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Öffnen' });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Außerhalb' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses a dropdown on a desktop with touch input', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(<Example />);
    expect(screen.getByRole('dialog')).toHaveClass('header-filter-popover');
  });

  it('retains the modal on a phone', () => {
    vi.stubGlobal('innerWidth', 390);
    render(<Example />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});
