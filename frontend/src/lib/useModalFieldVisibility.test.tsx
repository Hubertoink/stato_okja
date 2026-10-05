import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input, Textarea } from '@/components/ui/Field';
import { useModalFieldVisibility } from './useModalFieldVisibility';
import { readVisibleViewport } from './visibleViewport';

function Fixture({ custom = false }: { custom?: boolean }) {
  useModalFieldVisibility();
  return (
    <div className={custom ? 'modal-overlay' : undefined} role={custom ? undefined : 'dialog'}>
      <header className="editor-modal-header">Form</header>
      <div data-testid="scroller" style={{ overflowY: 'auto' }}>
        <label htmlFor="reference">Standard reference</label>
        <Input id="reference" />
        <label>Description<Textarea rows={12} /></label>
      </div>
    </div>
  );
}

const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top, toJSON: () => undefined });

function setup(custom = false) {
  vi.useFakeTimers();
  const viewport = Object.assign(new EventTarget(), { height: 400, offsetTop: 200 });
  vi.stubGlobal('visualViewport', viewport);
  const view = render(<Fixture custom={custom} />);
  const scroller = screen.getByTestId('scroller');
  Object.defineProperties(scroller, { scrollHeight: { value: 1200 }, clientHeight: { value: 340 } });
  scroller.scrollBy = vi.fn();
  vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(rect(260, 600));
  vi.spyOn(screen.getByText('Form'), 'getBoundingClientRect').mockReturnValue(rect(200, 260));
  return { ...view, scroller, viewport };
}

describe('useModalFieldVisibility', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([false, true])('reveals a lower field in a custom=%s dialog after viewport resize', (custom) => {
    const { scroller, viewport } = setup(custom);
    const field = screen.getByLabelText('Standard reference');
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(rect(700, 745));
    vi.spyOn(screen.getByText('Standard reference'), 'getBoundingClientRect').mockReturnValue(rect(670, 690));
    field.focus();
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
      vi.runOnlyPendingTimers();
    });
    expect(scroller.scrollBy).toHaveBeenCalledWith({ top: 161, behavior: 'auto' });
    expect(field).toHaveFocus();
  });

  it('shows the start and label of a textarea taller than the available space', () => {
    const { scroller } = setup();
    const field = screen.getByLabelText('Description');
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(rect(650, 1100));
    vi.spyOn(field.closest('label')!, 'getBoundingClientRect').mockReturnValue(rect(620, 1100));
    field.focus();
    act(() => vi.runOnlyPendingTimers());
    expect(scroller.scrollBy).toHaveBeenCalledWith({ top: 348, behavior: 'auto' });
  });

  it('does not move an already visible field', () => {
    const { scroller } = setup();
    const field = screen.getByLabelText('Standard reference');
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(rect(350, 395));
    vi.spyOn(screen.getByText('Standard reference'), 'getBoundingClientRect').mockReturnValue(rect(320, 340));
    field.focus();
    act(() => vi.runOnlyPendingTimers());
    expect(scroller.scrollBy).not.toHaveBeenCalled();
  });

  it('keeps fields in the recovered Edge viewport area visible without unnecessary scrolling', () => {
    const { scroller, viewport } = setup();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android EdgA/140.0');
    vi.stubGlobal('innerHeight', 800);
    readVisibleViewport();
    vi.stubGlobal('innerHeight', 450);
    Object.assign(viewport, { height: 370, offsetTop: 0 });
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(rect(60, 450));
    vi.spyOn(screen.getByText('Form'), 'getBoundingClientRect').mockReturnValue(rect(0, 60));
    const field = screen.getByLabelText('Standard reference');
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(rect(390, 425));
    vi.spyOn(screen.getByText('Standard reference'), 'getBoundingClientRect').mockReturnValue(rect(370, 385));
    field.focus();
    act(() => vi.runOnlyPendingTimers());
    expect(scroller.scrollBy).not.toHaveBeenCalled();
  });

  it('does not scroll after the user dismisses the keyboard', () => {
    const { scroller } = setup();
    const field = screen.getByLabelText('Standard reference');
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(rect(700, 745));
    field.focus();
    field.blur();
    act(() => vi.runOnlyPendingTimers());
    expect(scroller.scrollBy).not.toHaveBeenCalled();
  });

  it('cancels pending work on unmount', () => {
    const { unmount, scroller, viewport } = setup();
    fireEvent.focusIn(screen.getByLabelText('Standard reference'));
    unmount();
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
      vi.runOnlyPendingTimers();
    });
    expect(scroller.scrollBy).not.toHaveBeenCalled();
  });
});
