import { Button } from '@/components/ui/Button';
import { getActivityEditorReturn } from '@/lib/activityEditorReturn';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActivityDetailPage from './ActivityDetailPage';

const fixture = vi.hoisted(() => ({
  activity: { id: 'a1', title: 'Sports Night', type: 'project_open', date: '2026-09-10', durationMinutes: 120, countMale: 7, countFemale: 10, countDiverse: 1, notes: 'Gut besucht', staff: [{ id: 's1', name: 'Mara Nguyen' }], projectId: 'p1', project: { title: 'Sportangebot', color: '#008877' }, categories: [{ id: 'c1', name: 'Sport' }], tags: [], executionStatus: 'completed' },
  logbook: true,
}));
vi.mock('@/lib/activities', () => ({ useActivity: () => ({ data: fixture.activity }) }));
vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('@/lib/organizationModules', () => ({ useOrganizationModules: () => ({ data: { logbook: fixture.logbook } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/ProtectedImage', () => ({ default: () => null }));

function EditorReturn() {
  const location = useLocation();
  const navigate = useNavigate();
  const target = getActivityEditorReturn(location.state);
  return <><Destination /><Button onClick={() => navigate(target.to, { replace: true, state: target.state })}>Editor schließen</Button></>;
}
function Destination() {
  const location = useLocation();
  return <div data-testid="destination">{location.pathname}{location.search} {JSON.stringify(location.state)}</div>;
}
function showDetail() {
  return render(<MemoryRouter initialEntries={[{ pathname: '/activities/a1', state: { from: '/activities?projectId=p1', activityListKey: 'list-page-3' } }]}><Routes><Route path="/activities/:id" element={<ActivityDetailPage />} /><Route path="/activities/:id/edit" element={<EditorReturn />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter>);
}

describe('mobile activity detail', () => {
  beforeEach(() => { fixture.logbook = true; fixture.activity.executionStatus = 'completed'; });
  it('shows the title, summed attendance, staff and notes without duplicate category sections', () => {
    showDetail();
    expect(screen.getByRole('heading', { level: 1, name: 'Sports Night' })).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Mara Nguyen')).toBeInTheDocument();
    expect(screen.getByText('Gut besucht')).toBeInTheDocument();
    expect(screen.getAllByText('Sport')).toHaveLength(1);
  });
  it('passes the list history key and filters back to the overview', () => {
    showDetail();
    fireEvent.click(screen.getByRole('button', { name: 'common:actions.back' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('/activities?projectId=p1');
    expect(screen.getByTestId('destination')).toHaveTextContent('list-page-3');
  });
  it('preserves the list return state when opening the editor', () => {
    showDetail();
    fireEvent.click(screen.getByRole('button', { name: 'common:actions.edit' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('/activities/a1/edit');
    expect(screen.getByTestId('destination')).toHaveTextContent('list-page-3');
  });
  it('returns from the editor to detail and retains the original list destination', () => {
    showDetail();
    fireEvent.click(screen.getByRole('button', { name: 'common:actions.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editor schließen' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Sports Night' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common:actions.back' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('/activities?projectId=p1');
    expect(screen.getByTestId('destination')).toHaveTextContent('list-page-3');
  });
  it('respects disabled logbook access', () => {
    fixture.logbook = false;
    showDetail();
    expect(screen.queryByRole('button', { name: 'Logbucheintrag' })).not.toBeInTheDocument();
  });
});
