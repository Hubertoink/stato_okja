import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFocusedFieldVisibility } from './useFocusedFieldVisibility';

function Fixture() {
  const ref = useRef<HTMLDivElement>(null);
  const onFocusCapture = useFocusedFieldVisibility(ref, true);
  return (
    <div ref={ref} onFocusCapture={onFocusCapture} data-testid="scroller">
      <label>
        Description
        <textarea aria-label="Description" />
      </label>
    </div>
  );
}

describe('useFocusedFieldVisibility', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('scrolls its container until the focused field and label are visible', () => {
    vi.useFakeTimers();
    render(<Fixture />);
    const scroller = screen.getByTestId('scroller');
    const field = screen.getByLabelText('Description');
    const label = field.closest('label') as HTMLLabelElement;
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy;
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 300,
      left: 0,
      right: 300,
      width: 300,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });
    vi.spyOn(label, 'getBoundingClientRect').mockReturnValue({
      top: 350,
      bottom: 410,
      left: 0,
      right: 280,
      width: 280,
      height: 60,
      x: 0,
      y: 350,
      toJSON: () => undefined,
    });

    field.focus();
    fireEvent.focus(field);
    vi.runAllTimers();

    expect(scrollBy).toHaveBeenCalledWith({ top: 126, behavior: 'smooth' });
  });
});
