import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CalendarClosureModal from './CalendarClosureModal';

describe('CalendarClosureModal', () => {
  it('renders the dialog above its visual backdrop', () => {
    render(
      <CalendarClosureModal
        date="2026-07-23"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toHaveClass('relative', 'z-10');
  });
});
