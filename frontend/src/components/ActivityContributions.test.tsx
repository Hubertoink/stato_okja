import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivityContributions } from './ActivityContributions';
import type { Contribution } from '@/lib/contributors';

const save = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'new', name: 'Neue Person', color: '#7aa39a', active: true }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: 'editor' } }), canManageSettingsDestructiveActions: () => true }));
vi.mock('@/lib/contributors', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/contributors')>(),
  useContributors: () => ({ isSuccess: true, data: [
    { id: 'ben', name: 'Ben', active: true }, { id: 'lea', name: 'Lea', active: true }, { id: 'sam', name: 'Sam', active: false },
  ] }),
  useSaveContributor: () => ({ mutateAsync: save }),
}));
afterEach(cleanup);

function Editor() {
  const [value, onChange] = useState<Contribution[]>([]);
  return <MemoryRouter><ActivityContributions value={value} onChange={onChange} durationMinutes={120} /><output data-testid="saved">{JSON.stringify(value)}</output></MemoryRouter>;
}

describe('activity contributions', () => {
  it('selects badges in place and changes times only when the slider dialog is applied', () => {
    render(<Editor />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sam' })).not.toBeInTheDocument();
    const lea = screen.getByRole('button', { name: 'Lea' });
    const badgeOrder = Array.from(lea.parentElement!.children);
    fireEvent.click(lea);
    expect(screen.queryByRole('img', { name: /Angepasste Mitwirkungszeit/ })).not.toBeInTheDocument();
    expect(lea).toHaveAttribute('aria-pressed', 'true');
    expect(Array.from(lea.parentElement!.children)).toEqual(badgeOrder);
    expect(screen.getByTestId('saved')).toHaveTextContent('"minutes":120');
    expect(screen.queryByText('Mitwirkungszeit über die Uhr auswählen.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mitwirkungszeiten anpassen' }));
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeEnabled();
    expect(screen.getByRole('slider')).toHaveValue('120');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByTestId('saved')).toHaveTextContent('"minutes":120');
    fireEvent.click(screen.getByRole('button', { name: 'Mitwirkungszeiten anpassen' }));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '45' } });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(screen.getByRole('slider')).toHaveValue('60');
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(screen.getByTestId('saved')).toHaveTextContent('"minutes":60');
    expect(screen.getByRole('img', { name: 'Angepasste Mitwirkungszeit: 1 Std.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mitwirkungszeiten anpassen' }));
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(screen.queryByRole('img', { name: /Angepasste Mitwirkungszeit/ })).not.toBeInTheDocument();
    fireEvent.click(lea);
    expect(lea).toHaveAttribute('aria-pressed', 'false');
    expect(Array.from(lea.parentElement!.children)).toEqual(badgeOrder);
    expect(screen.getByTestId('saved')).toHaveTextContent('[]');
  });
  it('opens the shared creation modal from Add and selects the newly saved person', async () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Mitwirkende hinzufügen' }));
    expect(screen.getByRole('dialog', { name: 'Mitwirkende anlegen' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Neue Person' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.getByTestId('saved')).toHaveTextContent('"contributorId":"new"'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps assigned archived people removable', () => {
    render(<ActivityContributions value={[{ contributorId: 'sam', minutes: 30 }]} durationMinutes={120} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Sam (archiviert)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
