import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileLogbookCard from './MobileLogbookCard';
import type { LogbookEntry } from '@/lib/logbook';
vi.mock('./ProtectedImage', () => ({ default: () => null }));
const entry: LogbookEntry = { id: 'entry-1', orgId: 'org-1', occurredAt: '2026-09-10T14:30:00', type: 'observation', title: 'Hausordnung Medienraum', body: 'Neue Regeln wurden gemeinsam besprochen.', status: 'open', visibility: 'team', createdByUserId: 'author-1', createdByName: 'Mara Nguyen', createdAt: '2026-09-10T14:30:00', updatedAt: '2026-09-10T14:30:00', commentCount: 2 };

describe('shared mobile logbook card', () => {
  it('shows the entry hierarchy and opens the existing detail once from the comments action', () => {
    const onOpen = vi.fn();
    render(<MobileLogbookCard entry={entry} onOpen={onOpen} />);
    expect(screen.getByRole('heading', { name: entry.title })).toBeInTheDocument();
    expect(screen.getByText(entry.body)).toBeInTheDocument();
    expect(screen.getByText(entry.createdByName)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2 Kommentare' }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(entry.id);
  });
  it('keeps the existing status action separate from opening the card', () => {
    const onOpen = vi.fn();
    const mark = vi.fn();
    render(<MobileLogbookCard entry={entry} onOpen={onOpen} onMarkDiscussed={mark} />);
    const statusButton = screen.getAllByRole('button').find(button => button !== screen.getByRole('button', { name: entry.title }) && !button.textContent?.includes('Kommentare'))!;
    fireEvent.keyDown(statusButton, { key: 'Enter' });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(statusButton);
    expect(mark).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
