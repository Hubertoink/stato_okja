import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectPickerModal from './ProjectPickerModal';
import ProjectPickerPage from './ProjectPickerPage';

vi.mock('@/lib/projects', () => ({ useProjects: () => ({ data: [] }) }));
vi.mock('@/lib/useRecentProjectChoices', () => ({ useRecentProjectChoices: () => ({ recentIds: [], remember: vi.fn() }) }));
vi.mock('@/lib/starred', () => ({ getStarredProjectIds: () => [] }));

function PickerHost() {
  const [open, setOpen] = useState(true);
  return open ? <ProjectPickerModal onClose={() => setOpen(false)} onPick={vi.fn()} /> : <p>Calendar</p>;
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/calendar');
});
afterEach(cleanup);

describe('empty project picker', () => {
  it.each(['modal', 'page'])('preserves the empty state and link when toggling compact in %s', (kind) => {
    const { container } = render(<BrowserRouter>{kind === 'modal' ? <PickerHost /> : <ProjectPickerPage />}</BrowserRouter>);
    const link = screen.getByRole('link');
    const emptyState = link.parentElement!.parentElement!;
    const markup = emptyState.outerHTML;
    fireEvent.click(screen.getByRole('checkbox'));
    expect(emptyState.outerHTML).toBe(markup);
    expect(screen.getByRole('link')).toBe(link);
    expect(container.querySelector('ul')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('link')).toBe(link);
  });

  it.each([false, true])('navigates after removing modal history with compact=%s', async (compact) => {
    localStorage.setItem('projectPickerCompact', String(compact));
    render(<BrowserRouter><Routes>
      <Route path="/calendar" element={<PickerHost />} />
      <Route path="/projects" element={<h1>Project management</h1>} />
    </Routes></BrowserRouter>);
    fireEvent.click(screen.getByRole('link'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Project management' })).toBeInTheDocument());
    expect(window.location.pathname).toBe('/projects');
    expect(window.history.state.__statoModalStack).toBeUndefined();
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/calendar'));
  });
});
