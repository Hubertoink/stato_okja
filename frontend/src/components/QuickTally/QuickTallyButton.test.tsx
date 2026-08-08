import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuickTallyButton from './QuickTallyButton';

describe('QuickTallyButton', () => {
  it('increments after an intentional tap', () => {
    const onChange = vi.fn();
    render(<QuickTallyButton value={3} onChange={onChange} label="Jugendliche männlich" />);

    const button = screen.getByRole('button', { name: /Jugendliche männlich: 3/i });
    fireEvent.touchStart(button, { touches: [{ clientX: 20, clientY: 20 }] });
    fireEvent.touchEnd(button, { changedTouches: [{ clientX: 20, clientY: 20 }] });

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('does not change the count when the touch becomes a scroll gesture', () => {
    const onChange = vi.fn();
    render(<QuickTallyButton value={3} onChange={onChange} label="Jugendliche männlich" />);

    const button = screen.getByRole('button', { name: /Jugendliche männlich: 3/i });
    fireEvent.touchStart(button, { touches: [{ clientX: 20, clientY: 20 }] });
    fireEvent.touchMove(button, { touches: [{ clientX: 20, clientY: 48 }] });
    fireEvent.touchEnd(button, { changedTouches: [{ clientX: 20, clientY: 48 }] });

    expect(onChange).not.toHaveBeenCalled();
  });
});
