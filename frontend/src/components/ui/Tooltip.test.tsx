import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconButton } from './Button';
import { Tooltip } from './Tooltip';

afterEach(cleanup);
describe('App action tooltip', () => {
  it('shows on hover outside the clipped parent and dismisses on leaving or scrolling', () => {
    const { container } = render(
      <div style={{ overflow: 'hidden' }}>
        <Tooltip text="Bearbeiten">
          <IconButton aria-label="Bearbeiten">✎</IconButton>
        </Tooltip>
      </div>,
    );
    const trigger = screen.getByRole('button').parentElement!;
    fireEvent.mouseEnter(trigger);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Bearbeiten');
    expect(container).not.toContainElement(tooltip);
    expect(screen.getByRole('button')).toHaveAttribute('aria-describedby', tooltip.id);
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(trigger);
    fireEvent.scroll(window);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('supports keyboard focus and Escape without closing its surrounding modal', () => {
    const modalKey = vi.fn();
    render(
      <div onKeyDown={modalKey}>
        <Tooltip text="Bearbeiten">
          <IconButton aria-label="Bearbeiten">✎</IconButton>
        </Tooltip>
      </div>,
    );
    const button = screen.getByRole('button');
    act(() => button.focus());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(modalKey).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(modalKey).toHaveBeenCalledOnce();
  });

  it('makes explanations for disabled actions reachable by keyboard', () => {
    render(
      <Tooltip text="Abschluss nach dem 31.12.2026 möglich" disabled>
        <IconButton aria-label="Ziel abschließen" disabled>
          ▣
        </IconButton>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button').parentElement!;
    expect(trigger).toHaveAttribute('tabindex', '0');
    act(() => trigger.focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Abschluss nach dem 31.12.2026 möglich');
    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
