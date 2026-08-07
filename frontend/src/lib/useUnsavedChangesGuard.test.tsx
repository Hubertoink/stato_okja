import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { resources } from '@/i18n/resources';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

describe('useUnsavedChangesGuard', () => {
  it('only asks for confirmation after a value changed', () => {
    const onDiscard = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useUnsavedChangesGuard({ value }),
      { initialProps: { value: 'initial' } },
    );

    act(() => result.current.requestDiscard(onDiscard));
    expect(onDiscard).toHaveBeenCalledOnce();

    rerender({ value: 'changed' });
    expect(result.current.isDirty).toBe(true);
  });

  it('keeps edits until the user explicitly discards them', () => {
    const onDiscard = vi.fn();
    function Harness({ title }: { title: string }) {
      const guard = useUnsavedChangesGuard({ title });
      return (
        <>
          <button type="button" onClick={() => guard.requestDiscard(onDiscard)}>
            close
          </button>
          {guard.discardDialog}
        </>
      );
    }

    // First mount establishes the pristine snapshot; another value mirrors the
    // normal editor state update.
    const { rerender } = render(<Harness title="initial" />);
    expect(resources.de.common.unsavedChanges.title).toBe('Ungespeicherte Änderungen');
    expect(i18n.getResourceBundle('de', 'common').unsavedChanges.title).toBe('Ungespeicherte Änderungen');
    rerender(<Harness title="changed" />);
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
    expect(onDiscard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen verwerfen' }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('registers the browser unload warning only while changes are pending', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useUnsavedChangesGuard({ value }),
      { initialProps: { value: 'initial' } },
    );
    rerender({ value: 'changed' });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    act(() => result.current.reset({ value: 'changed' }));
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});
