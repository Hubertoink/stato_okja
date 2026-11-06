import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StatisticsEmptyState } from './StatisticsEmptyState';

afterEach(cleanup);

describe('statistics empty state', () => {
  it('opens the activity creation flow when there are no activities yet', () => {
    render(<MemoryRouter><Routes>
      <Route path="/" element={<StatisticsEmptyState firstActivity />} />
      <Route path="/activities/new/select-project" element={<p>Projekt auswählen</p>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText('Noch keine Aktivitäten vorhanden')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Erste Aktivität erstellen' }));
    expect(screen.getByText('Projekt auswählen')).toBeInTheDocument();
  });

  it.each([false, true])('explains a selection without matches (team: %s)', team => {
    render(<MemoryRouter><StatisticsEmptyState team={team} /></MemoryRouter>);
    expect(screen.getByText(team ? 'Keine passenden Team-Einsätze' : 'Keine passenden Aktivitäten')).toBeInTheDocument();
    expect(screen.getByText(/Passe die Filter an/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Erste Aktivität erstellen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aktivität erstellen' })).toBeInTheDocument();
  });
});
