import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import NavigationLinks from './NavigationLinks';
import { SidebarIconOnlyContext } from './SidebarTooltip';

function Example({ collapsed }: { collapsed: boolean }) {
  return (
    <MemoryRouter>
      <SidebarIconOnlyContext.Provider value={collapsed}>
        <NavigationLinks sidebar items={[{ to: '/dashboard', label: 'Dashboard', icon: Home }]} />
      </SidebarIconOnlyContext.Provider>
    </MemoryRouter>
  );
}
describe('sidebar area tooltips', () => {
  it('shows the app tooltip immediately on hover, outside the scroll container', () => {
    const { container } = render(<Example collapsed />);
    const link = screen.getByRole('link', { name: 'Dashboard' });
    expect(link).not.toHaveAttribute('title');
    fireEvent.mouseEnter(link.parentElement!);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Dashboard');
    expect(tooltip).toHaveClass('app-action-tooltip');
    expect(container).not.toContainElement(tooltip);
    fireEvent.mouseLeave(link.parentElement!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('supports keyboard focus and removes the tooltip when expanded', () => {
    const view = render(<Example collapsed />);
    act(() => screen.getByRole('link').focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Dashboard');
    view.rerender(<Example collapsed={false} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole('link'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
