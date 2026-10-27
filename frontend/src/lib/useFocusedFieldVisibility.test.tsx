import { Input } from '@/components/ui/Field';
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

    expect(scrollBy).toHaveBeenCalledWith({ top: 126, behavior: 'auto' });
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
    expect(scrollBy).toHaveBeenCalledWith({ top: 126, behavior: 'auto' });

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
    expect(body.scrollBy).toHaveBeenCalledWith({ top: 116, behavior: 'auto' });
    expect(dialog.scrollBy).not.toHaveBeenCalled();
  });
});
