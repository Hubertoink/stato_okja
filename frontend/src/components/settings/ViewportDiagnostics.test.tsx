import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ViewportDiagnostics from './ViewportDiagnostics';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty('--visual-viewport-fixed-height');
});

it('records a silent viewport change separately from stale CSS without collecting field contents', async () => {
  vi.useFakeTimers();
  const viewport = Object.assign(new EventTarget(), {
    height: 438, width: 411, offsetTop: 0, pageTop: 0, scale: 1,
  });
  vi.stubGlobal('visualViewport', viewport);
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText }, userAgent: 'Test Edge' });
  document.documentElement.style.setProperty('--visual-viewport-fixed-height', '438px');
  const shell = document.createElement('div');
  shell.className = 'modal-overlay';
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  const field = document.createElement('textarea');
  field.value = 'Private description must never be exported';
  field.id = 'private-record-id';
  dialog.append(field);
  shell.append(dialog);
  document.body.append(shell);
  field.focus();
  const { unmount } = render(<ViewportDiagnostics />);
  try {
    // No resize/scroll event: this is the failure that ordinary viewport mocks miss.
    viewport.height = 520;
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByLabelText('Viewport-Diagnose')).toHaveTextContent('VV 520 · CSS 438');
    expect(document.documentElement.style.getPropertyValue('--visual-viewport-fixed-height')).toBe('438px');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Messwerte kopieren' })));
    const report = JSON.parse(writeText.mock.calls[0][0]);
    expect(report.samples[0].data.visualViewport.height).toBe(438);
    expect(report.samples.some((sample: { event: string; data: { visualViewport: { height: number } } }) =>
      sample.event === 'poll' && sample.data.visualViewport.height === 520)).toBe(true);
    expect(report.samples.at(-1).data.focus.tag).toBe('TEXTAREA');
    expect(writeText.mock.calls[0][0]).not.toContain(field.value);
    expect(writeText.mock.calls[0][0]).not.toContain(field.id);
    expect(document.activeElement).toBe(field);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    unmount();
    shell.remove();
  }
});

it('handles browsers without VisualViewport or clipboard access', async () => {
  vi.stubGlobal('visualViewport', undefined);
  vi.stubGlobal('navigator', { userAgent: 'Test browser' });
  const { unmount } = render(<ViewportDiagnostics />);
  expect(screen.getByLabelText('Viewport-Diagnose')).toHaveTextContent('VV –');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Messwerte kopieren' })));
  expect(screen.getByRole('button')).toHaveTextContent('Kopieren fehlgeschlagen');
  unmount();
});
