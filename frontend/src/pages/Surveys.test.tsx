import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/Toast';
import type { Survey } from '@/lib/surveys';
import Surveys from './Surveys';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/lib/orgScope', () => ({
  useOrgScopeKey: () => 'test-org',
  useOrgScopedQueryState: () => ({ scopeKey: 'test-org', ready: true }),
}));
vi.mock('@/lib/taxonomy', () => ({ useCohorts: () => ({ data: [] }) }));
vi.mock('@/lib/projects', () => ({ useProjects: () => ({ data: [] }) }));

let surveys: Survey[];
const archivedSurvey = (id: string): Survey => ({
  id, title: `Umfrage ${id}`, status: 'closed', archived: true,
  publicToken: id, questions: [], responsesCount: 0,
  rawResponsesAvailable: true, allowMultiplePerDevice: false,
});

function renderSurveys() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><ToastProvider><Surveys /></ToastProvider></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  surveys = [archivedSurvey('A')];
  apiMock.get.mockReset().mockImplementation(async (url: string, config?: { params?: { archived?: boolean; search?: string } }) => {
    if (url === '/surveys/meta/has-archived') return { data: surveys.some((survey) => survey.archived) };
    if (url === '/surveys') return { data: surveys.filter((survey) => survey.archived === !!config?.params?.archived && survey.title.includes(config?.params?.search || '')) };
    throw new Error(`Unexpected GET ${url}`);
  });
  apiMock.patch.mockReset().mockImplementation(async (url: string, data: { archived: boolean }) => {
    const survey = surveys.find((entry) => url === `/surveys/${entry.id}`)!;
    const updated = { ...survey, ...data };
    surveys = surveys.map((entry) => entry.id === survey.id ? updated : entry);
    return { data: updated };
  });
});

describe('Surveys archive navigation', () => {
  it('shows a distinct archive heading and a working return button', async () => {
    const user = userEvent.setup();
    renderSurveys();
    await user.click(await screen.findByRole('button', { name: 'Archiv' }));
    expect(screen.getByRole('heading', { name: 'Umfragenarchiv' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zurück zu Umfragen' }));
    expect(screen.getByRole('heading', { name: 'Umfragen' })).toBeInTheDocument();
  });

  it('returns to the overview and shows the restored survey after restoring the last item', async () => {
    const user = userEvent.setup();
    renderSurveys();
    await user.click(await screen.findByRole('button', { name: 'Archiv' }));
    await user.click(await screen.findByRole('button', { name: 'Wiederherstellen' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Umfragen' })).toBeInTheDocument());
    expect(await screen.findByRole('heading', { name: 'Umfrage A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archiv' })).not.toBeInTheDocument();
  });

  it('keeps the archive open when other archived surveys remain', async () => {
    surveys.push(archivedSurvey('B'));
    const user = userEvent.setup();
    renderSurveys();
    await user.click(await screen.findByRole('button', { name: 'Archiv' }));
    await user.click((await screen.findAllByRole('button', { name: 'Wiederherstellen' }))[0]);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Umfrage A' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Umfragenarchiv' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zurück zu Umfragen' })).toBeInTheDocument();
  });

  it('does not offer an empty archive from the overview', async () => {
    surveys = [];
    renderSurveys();
    await screen.findByText('Noch keine Umfrage');
    expect(screen.queryByRole('button', { name: 'Archiv' })).not.toBeInTheDocument();
  });

  it('keeps the return button for an empty search and clears the filter when returning', async () => {
    surveys.push({ ...archivedSurvey('B'), archived: false });
    const user = userEvent.setup();
    renderSurveys();
    await user.click(await screen.findByRole('button', { name: 'Archiv' }));
    await user.click(screen.getByRole('button', { name: 'Suche öffnen' }));
    await user.type(screen.getByPlaceholderText('Suchen…'), 'Kein Treffer');
    await screen.findByText('Keine archivierten Umfragen');
    expect(screen.getByRole('heading', { name: 'Umfragenarchiv' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zurück zu Umfragen' }));
    expect(await screen.findByRole('heading', { name: 'Umfrage B' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Suche öffnen' }));
    expect(screen.getByPlaceholderText('Suchen…')).toHaveValue('');
  });
});
