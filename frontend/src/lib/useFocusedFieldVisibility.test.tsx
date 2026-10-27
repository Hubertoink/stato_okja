import { Input } from '@/components/ui/Field';
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFocusedFieldVisibility } from './useFocusedFieldVisibility';

function Fixture({ scrollMode = 'container', footer = false }: { scrollMode?: 'container' | 'document'; footer?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const onFocusCapture = useFocusedFieldVisibility(ref, true, scrollMode);
  return (
    <div ref={ref} onFocusCapture={onFocusCapture} data-testid="scroller">
      <label>
        Description
        <textarea aria-label="Description" />
      </label>
      {footer && <div data-scroll-footer data-testid="actions" style={{ position: 'sticky', bottom: 0 }}>Save</div>}
    </div>
  );
}

describe('useFocusedFieldVisibility', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

    expect(scrollBy).toHaveBeenCalledWith({ top: 126, behavior: 'instant' });
  });

  it('reveals the focused field again when the keyboard resizes the viewport after focus', () => {
    vi.useFakeTimers();
    const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
    vi.stubGlobal('visualViewport', viewport);
    const { unmount } = render(<Fixture />);
    const scroller = screen.getByTestId('scroller');
    const field = screen.getByLabelText('Description');
    const label = field.closest('label')!;
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy;
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 800));
    vi.spyOn(label, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 350, 280, 60));
    field.focus();
    vi.runAllTimers();
    expect(scrollBy).not.toHaveBeenCalled();

    viewport.height = 300;
    viewport.dispatchEvent(new Event('resize'));
    vi.runAllTimers();
    expect(scrollBy).toHaveBeenCalledWith({ top: 126, behavior: 'instant' });

    scrollBy.mockClear();
    viewport.dispatchEvent(new Event('resize'));
    unmount();
    vi.runAllTimers();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('scrolls the nested form body rather than the dialog or the page', () => {
    vi.useFakeTimers();
    function StructuredFixture() {
      const ref = useRef<HTMLDivElement>(null);
      const onFocusCapture = useFocusedFieldVisibility(ref, true);
      return <div ref={ref} onFocusCapture={onFocusCapture} data-testid="dialog">
        <header>Title</header>
        <div data-testid="body" style={{ overflowY: 'auto' }}><Input aria-label="Name" /></div>
      </div>;
    }
    render(<StructuredFixture />);
    const dialog = screen.getByTestId('dialog');
    const body = screen.getByTestId('body');
    const field = screen.getByLabelText('Name');
    dialog.scrollBy = vi.fn();
    body.scrollBy = vi.fn();
    vi.spyOn(body, 'scrollHeight', 'get').mockReturnValue(600);
    vi.spyOn(body, 'clientHeight', 'get').mockReturnValue(250);
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 300));
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 50, 300, 250));
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 360, 280, 40));

    field.focus();
    vi.runAllTimers();
    expect(body.scrollBy).toHaveBeenCalledWith({ top: 116, behavior: 'instant' });
    expect(dialog.scrollBy).not.toHaveBeenCalled();
  });

  it('keeps the focused field clear of a sticky save bar', () => {
    vi.useFakeTimers();
    render(<Fixture footer />);
    const scroller = screen.getByTestId('scroller');
    const field = screen.getByLabelText('Description');
    const label = field.closest('label')!;
    let fieldTop = 235;
    scroller.scrollBy = vi.fn((options?: ScrollToOptions | number) => {
      if (typeof options === 'object') fieldTop -= options.top ?? 0;
    });
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 350));
    vi.spyOn(screen.getByTestId('actions'), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 280, 300, 70));
    vi.spyOn(label, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, fieldTop, 280, 60));

    field.focus();
    vi.runAllTimers();

    expect(label.getBoundingClientRect().bottom).toBe(264);
    expect(scroller.scrollBy).toHaveBeenCalledTimes(1);
  });

  it('scrolls a standalone editor on its first focus and follows later viewport panning', () => {
    vi.useFakeTimers();
    const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
    vi.stubGlobal('visualViewport', viewport);
    render(<Fixture scrollMode="document" />);
    const scroller = screen.getByTestId('scroller');
    const field = screen.getByLabelText('Description');
    const label = field.closest('label')!;
    let fieldTop = 600;
    scroller.scrollBy = vi.fn();
    vi.spyOn(window, 'scrollBy').mockImplementation((options?: ScrollToOptions | number) => {
      if (typeof options === 'object') fieldTop -= options.top ?? 0;
    });
    vi.spyOn(document.documentElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 360, 1800));
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 360, 1800));
    vi.spyOn(label, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, fieldTop, 280, 80));

    field.focus();
    vi.advanceTimersByTime(500);
    expect(window.scrollBy).not.toHaveBeenCalled();

    viewport.height = 350;
    viewport.offsetTop = 100;
    viewport.dispatchEvent(new Event('resize'));
    vi.runAllTimers();
    expect(label.getBoundingClientRect().bottom).toBe(434);

    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('scroll'));
    vi.runAllTimers();
    expect(label.getBoundingClientRect().bottom).toBe(334);
    expect(scroller.scrollBy).not.toHaveBeenCalled();
  });

  it('does not scroll a standalone page while a modal locks the background', () => {
    vi.useFakeTimers();
    render(<Fixture scrollMode="document" />);
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    document.body.setAttribute('data-scroll-locked', 'true');
    screen.getByLabelText('Description').focus();
    vi.runAllTimers();
    document.body.removeAttribute('data-scroll-locked');
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('settles tall fields without bouncing between their top and bottom edges', () => {
    vi.useFakeTimers();
    render(<Fixture />);
    const scroller = screen.getByTestId('scroller');
    const field = screen.getByLabelText('Description');
    const label = field.closest('label')!;
    let fieldTop = 150;
    scroller.scrollBy = vi.fn((options?: ScrollToOptions | number) => {
      if (typeof options === 'object') fieldTop -= options.top ?? 0;
    });
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 200));
    vi.spyOn(label, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, fieldTop, 280, 240));
    field.focus();
    vi.runAllTimers();
    window.dispatchEvent(new Event('resize'));
    vi.runAllTimers();

    expect(label.getBoundingClientRect().top).toBe(12);
    expect(scroller.scrollBy).toHaveBeenCalledTimes(1);
  });

  it('rechecks the field after the dialog finishes resizing and disconnects on close', () => {
    vi.useFakeTimers();
    let onResize = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { onResize = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    const { unmount } = render(<Fixture />);
    const scroller = screen.getByTestId('scroller');
    const field = screen.getByLabelText('Description');
    const label = field.closest('label')!;
    scroller.scrollBy = vi.fn();
    const bounds = vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 500));
    vi.spyOn(label, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 350, 280, 60));
    field.focus();
    vi.runAllTimers();
    expect(scroller.scrollBy).not.toHaveBeenCalled();

    bounds.mockReturnValue(new DOMRect(0, 0, 300, 300));
    onResize();
    vi.advanceTimersByTime(20);
    expect(scroller.scrollBy).toHaveBeenCalledWith({ top: 126, behavior: 'instant' });
    vi.mocked(scroller.scrollBy).mockClear();
    unmount();
    vi.runAllTimers();
    expect(scroller.scrollBy).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
