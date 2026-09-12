import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMouseDragScroll } from './useMouseDragScroll';

function Rail({ onClick }: { onClick: () => void }) {
  const handlers = useMouseDragScroll();
  return <div data-testid="rail" {...handlers}><button onClick={onClick}>Open</button></div>;
}

describe('mouse dragging dashboard rails', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    vi.stubGlobal('PointerEvent', class extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'mouse';
      }
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    const onClick = vi.fn();
    render(<Rail onClick={onClick} />);
    const rail = screen.getByTestId('rail');
    Object.defineProperties(rail, { scrollWidth: { value: 900 }, clientWidth: { value: 350 } });
    rail.setPointerCapture = vi.fn();
    return { rail, button: screen.getByRole('button'), onClick };
  }

  it('scrolls a mouse drag and suppresses the resulting card click', () => {
    const { rail, button, onClick } = setup();
    fireEvent.pointerDown(button, { clientX: 200, button: 0 });
    fireEvent.pointerMove(rail, { clientX: 100 });
    expect(rail.scrollLeft).toBe(100);
    expect(rail.dataset.mouseDragging).toBe('true');
    fireEvent.pointerUp(rail);
    fireEvent.click(button, { detail: 1 });
    expect(onClick).not.toHaveBeenCalled();
    expect(rail.dataset.mouseDragging).toBeUndefined();
    fireEvent.pointerDown(button, { clientX: 100, button: 0 });
    fireEvent.pointerUp(button);
    fireEvent.click(button, { detail: 1 });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('preserves clicks with minor mouse movement', () => {
    const { rail, button, onClick } = setup();
    fireEvent.pointerDown(button, { clientX: 200, button: 0 });
    fireEvent.pointerMove(button, { clientX: 197 });
    fireEvent.pointerUp(button);
    fireEvent.click(button, { detail: 1 });
    expect(rail.scrollLeft).toBe(0);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each(['touch', 'pen'])('leaves %s scrolling to the browser', (pointerType) => {
    const { rail, button } = setup();
    fireEvent.pointerDown(button, { clientX: 200, pointerType });
    fireEvent.pointerMove(rail, { clientX: 100, pointerType });
    expect(rail.scrollLeft).toBe(0);
    expect(rail.setPointerCapture).not.toHaveBeenCalled();
  });

  it('does not drag the wide desktop grid', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    const { rail, button } = setup();
    fireEvent.pointerDown(button, { clientX: 200 });
    fireEvent.pointerMove(rail, { clientX: 100 });
    expect(rail.scrollLeft).toBe(0);
  });
});
