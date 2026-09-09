import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import QuickTallyButton from './QuickTallyButton';

describe('QuickTallyButton', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function Counter() {
    const [value, setValue] = useState(3);
    return <QuickTallyButton value={value} onChange={setValue} label="Teilnehmende" />;
  }

  function tap(button: HTMLElement) {
    fireEvent.touchStart(button, { touches: [{ clientX: 20, clientY: 20 }] });
    fireEvent.touchEnd(button);
  }

  it('accumulates rapid taps and starts a new badge after the last tap expires', () => {
    vi.useFakeTimers();
    render(<Counter />);
    const button = screen.getByRole('button');
    tap(button);
    expect(screen.getByText('+1')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(600));
    tap(button);
    expect(screen.getByText('+2')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(600));
    tap(button);
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(button).toHaveAccessibleName('Teilnehmende: 6');
    act(() => vi.advanceTimersByTime(899));
    expect(screen.getByText('+3')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('+3')).not.toBeInTheDocument();
    tap(button);
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(button).toHaveAccessibleName('Teilnehmende: 7');
  });

  it('accumulates long presses and shows the net change when directions alternate', () => {
    vi.useFakeTimers();
    render(<Counter />);
    const button = screen.getByRole('button');
    for (let count = 1; count <= 2; count += 1) {
      fireEvent.touchStart(button, { touches: [{ clientX: 20, clientY: 20 }] });
      act(() => vi.advanceTimersByTime(500));
      fireEvent.touchEnd(button);
      expect(screen.getByText(`−${count}`)).toBeInTheDocument();
    }
    expect(button).toHaveAccessibleName('Teilnehmende: 1');
    tap(button);
    expect(screen.getByText('−1')).toBeInTheDocument();
    tap(button);
    expect(button).toHaveAccessibleName('Teilnehmende: 3');
    expect(button.querySelector('[aria-live]')).toBeNull();
  });

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
