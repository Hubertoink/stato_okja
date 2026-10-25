import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: 'user' } }) }));
vi.mock('./UserMenu', () => ({ default: () => null }));
vi.mock('./SidebarOrganization', () => ({ default: () => null }));
describe('narrow sidebar dismiss surface', () => {
  it('keeps a translucent inline background when the pointer leaves the sidebar, and closes on click', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar
          items={[]}
          collapsed={false}
          onToggle={vi.fn()}
          userMenu={{
            activeOrgName: 'Hochi',
            orgSwitching: false,
            canSwitchOrganization: false,
            onSwitchOrganization: vi.fn(),
            showDemoGuideRestore: false,
            onRestoreDemoGuides: vi.fn(),
          }}
        />
      </MemoryRouter>,
    );
    fireEvent.click(container.querySelector('.sidebar-toggle-narrow')!);
    const backdrop = container.querySelector<HTMLElement>('.sidebar-backdrop')!;
    // Inline color wins over the shared Button's opaque hover utility at every width.
    expect(backdrop.style.backgroundColor).toBe('rgba(0, 0, 0, 0.2)');
    fireEvent.mouseLeave(screen.getByRole('complementary'));
    fireEvent.mouseEnter(backdrop);
    expect(backdrop.style.backgroundColor).toBe('rgba(0, 0, 0, 0.2)');
    fireEvent.click(backdrop);
    expect(container.querySelector('.sidebar-backdrop')).toBeNull();
  });
});
