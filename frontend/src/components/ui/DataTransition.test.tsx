import { Button } from '@/components/ui/Button';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTransition } from './DataTransition';

describe('DataTransition', () => {
  it('keeps layout skeletons inert and restores interaction when loading finishes', () => {
    const { container, rerender } = render(<DataTransition pending variant="statistics" label="Laden"><Button>Export</Button></DataTransition>);
    const content = container.querySelector('.data-skeleton-content') as HTMLElement;
    expect(content.inert).toBe(true);
    expect(content).toHaveAttribute('aria-hidden', 'true');
    rerender(<DataTransition pending={false} variant="statistics" label="Laden"><Button>Export</Button></DataTransition>);
    expect(content.inert).toBe(false);
    expect(screen.getByRole('button', { name: 'Export' })).toBeVisible();
  });
  it('provides individual mobile cards on first load without a duplicate status', () => {
    const { container } = render(<DataTransition pending variant="activity-cards" empty showStatus={false} label="Laden"><div /></DataTransition>);
    expect(container.querySelectorAll('.activity-mobile-card')).toHaveLength(3);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('keeps the previous layout mounted but hides stale values and actions during a period change', () => {
    const { rerender } = render(<DataTransition pending={false} label="August wird geladen"><Button>Juli: 42</Button></DataTransition>);
    expect(screen.getByRole('button', { name: 'Juli: 42' })).toBeVisible();
    rerender(<DataTransition pending label="August wird geladen"><Button>Juli: 42</Button></DataTransition>);
    expect(screen.getByText('Juli: 42')).not.toBeVisible();
    expect(screen.queryByRole('button', { name: 'Juli: 42' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('August wird geladen');
    rerender(<DataTransition pending={false} label="August wird geladen"><Button>August: 12</Button></DataTransition>);
    expect(screen.getByRole('button', { name: 'August: 12' })).toBeVisible();
  });
  it('keeps current data visible during refresh and provides retry after failure', () => {
    const retry = vi.fn();
    const { rerender } = render(<DataTransition pending={false} refreshing label="Laden"><p>42 Aktivitäten</p></DataTransition>);
    expect(screen.getByText('42 Aktivitäten')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Wird aktualisiert');
    rerender(<DataTransition pending={false} error label="Laden" onRetry={retry}><p>42 Aktivitäten</p></DataTransition>);
    expect(screen.getByText('42 Aktivitäten')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
