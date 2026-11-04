import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectsFilterDrawer from './ProjectsFilterDrawer';

afterEach(cleanup);

describe('project filter selection', () => {
  it('applies drafts explicitly and can reset all advanced filters', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<ProjectsFilterDrawer anchorRef={{ current: null }} archivedCount={1}
      projects={[{ id: '1', title: 'Treff', type: 'event', defaultStaff: 'Mara', defaultVolunteers: 'Lea' }]}
      categories={[{ id: 'music', name: 'Musik' }]} initial={{ staffNames: [], categoryIds: [], showArchived: false }}
      onApply={onApply} onClose={onClose} />);
    expect(screen.queryByText('Projektarten')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Mitarbeitende'));
    fireEvent.click(screen.getByLabelText('Lea'));
    fireEvent.click(screen.getByText('Kategorien'));
    fireEvent.click(screen.getByRole('button', { name: 'Musik' }));
    fireEvent.click(screen.getByLabelText('Archivierte Projekte einblenden (1)'));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(onApply).toHaveBeenLastCalledWith({ staffNames: ['Lea'], categoryIds: ['music'], showArchived: true });
    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(onApply).toHaveBeenLastCalledWith({ staffNames: [], categoryIds: [], showArchived: false });
    fireEvent.click(screen.getAllByRole('button', { name: 'Schließen' }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });
});
