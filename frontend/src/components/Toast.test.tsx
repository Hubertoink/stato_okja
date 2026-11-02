import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useProgressToast } from './Toast';

function Progress({ active }: { active: boolean }) {
  useProgressToast(active, 'Statistik wird aktualisiert …');
  return null;
}

describe('progress toast', () => {
  afterEach(() => vi.useRealTimers());
  it('shows one delayed toast and removes it on completion or unmount', () => {
    vi.useFakeTimers();
    const view = render(<ToastProvider><Progress active /></ToastProvider>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    view.rerender(<ToastProvider><Progress active /></ToastProvider>);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    view.rerender(<ToastProvider><Progress active={false} /></ToastProvider>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    view.rerender(<ToastProvider><Progress active /></ToastProvider>);
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByRole('status')).toHaveTextContent('Statistik wird aktualisiert');
    view.rerender(<ToastProvider>{null}</ToastProvider>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('does not flash or leave a toast after fast requests', () => {
    vi.useFakeTimers();
    const view = render(<ToastProvider><Progress active /></ToastProvider>);
    act(() => vi.advanceTimersByTime(100));
    view.rerender(<ToastProvider><Progress active={false} /></ToastProvider>);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
