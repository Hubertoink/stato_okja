import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OrganizationModulesMenu from './OrganizationModulesMenu';

describe('OrganizationModulesMenu', () => {
  it('switches only the selected organization module and reflects saved settings', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    const org = { id: 'child', name: 'Jugendhaus', processesEnabled: false, logbookEnabled: false, surveysEnabled: false };
    const { rerender } = render(<OrganizationModulesMenu org={org} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Module für Jugendhaus' }));
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    fireEvent.click(screen.getByRole('switch', { name: 'Logbuch für Jugendhaus' }));
    expect(onChange).toHaveBeenCalledWith('child', 'logbook', true);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Logbuch für Jugendhaus' })).toBeEnabled());
    rerender(<OrganizationModulesMenu org={{ ...org, logbookEnabled: true }} onChange={onChange} />);
    expect(screen.getByRole('switch', { name: 'Logbuch für Jugendhaus' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Umfragen für Jugendhaus' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Module für Jugendhaus' })).toHaveFocus();
  });
});
