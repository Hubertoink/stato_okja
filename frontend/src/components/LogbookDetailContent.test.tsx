import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { LogbookEntry } from '@/lib/logbook';
import LogbookDetailContent from './LogbookDetailContent';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'author' } }) }));
vi.mock('./ProtectedImage', () => ({ default: () => null }));

const entry: LogbookEntry = {
  id: 'entry', orgId: 'org', occurredAt: '2026-09-08T08:30:00', type: 'incident',
  title: 'Konflikt beim Kochabend', body: 'Das Team konnte die Situation beruhigen.',
  status: 'open', visibility: 'team', createdByUserId: 'author', createdByName: 'Demo Admin',
  createdAt: '2026-09-08T08:30:00', updatedAt: '2026-09-08T08:30:00',
};

describe('logbook reading content', () => {
  it('keeps full documentation and every reflection visible in the new hierarchy', () => {
    render(<LogbookDetailContent entry={{ ...entry, highlights: 'Zurück in der Gruppe.', challenges: 'Unklare Rollen.', nextSteps: 'Aufgaben verteilen.' }} />, { wrapper: MemoryRouter });
    expect(screen.getByRole('heading', { level: 1, name: entry.title })).toBeInTheDocument();
    expect(screen.getByText(entry.body)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reflexion & Ausblick' })).toBeInTheDocument();
    for (const text of ['Zurück in der Gruppe.', 'Unklare Rollen.', 'Aufgaben verteilen.', 'Demo Admin']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('omits empty sections and retains the access restriction label', () => {
    render(<LogbookDetailContent entry={{ ...entry, visibility: 'admins' }} />, { wrapper: MemoryRouter });
    expect(screen.queryByRole('heading', { name: 'Reflexion & Ausblick' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Verknüpfungen' })).not.toBeInTheDocument();
    expect(screen.getByText('Nur Admins')).toBeInTheDocument();
  });

  it('links to the existing project filter and activity detail routes', () => {
    render(<LogbookDetailContent entry={{ ...entry,
      project: { id: 'project-1', title: 'Kochgruppe', type: 'project_open' },
      activity: { id: 'activity-1', title: 'Kochabend', date: '2026-09-08', type: 'project_open' },
    }} />, { wrapper: MemoryRouter });
    expect(screen.getByRole('link', { name: /Projekt.*Kochgruppe/ })).toHaveAttribute('href', '/activities?projectId=project-1');
    expect(screen.getByRole('link', { name: /Aktivität.*Kochabend/ })).toHaveAttribute('href', '/activities/activity-1');
  });
});
