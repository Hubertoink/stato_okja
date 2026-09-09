import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import OrganizationModuleRoute from './OrganizationModuleRoute';

const access = vi.hoisted(() => ({ isPending: false, isError: false, data: { logbook: true }, refetch: vi.fn() }));
vi.mock('@/lib/organizationModules', () => ({ useOrganizationModules: () => access }));

describe('OrganizationModuleRoute', () => {
  it('unmounts an open module when disabled and restores it when re-enabled', () => {
    const page = <MemoryRouter><OrganizationModuleRoute module="logbook"><p>Logbuchinhalt</p></OrganizationModuleRoute></MemoryRouter>;
    const { rerender } = render(page);
    expect(screen.getByText('Logbuchinhalt')).toBeInTheDocument();
    access.data.logbook = false;
    rerender(<MemoryRouter><OrganizationModuleRoute module="logbook"><p>Logbuchinhalt</p></OrganizationModuleRoute></MemoryRouter>);
    expect(screen.queryByText('Logbuchinhalt')).not.toBeInTheDocument();
    expect(screen.getByText('Modul deaktiviert')).toBeInTheDocument();
    access.data.logbook = true;
    rerender(<MemoryRouter><OrganizationModuleRoute module="logbook"><p>Logbuchinhalt</p></OrganizationModuleRoute></MemoryRouter>);
    expect(screen.getByText('Logbuchinhalt')).toBeInTheDocument();
  });
});
