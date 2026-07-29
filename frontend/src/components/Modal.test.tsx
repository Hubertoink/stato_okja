import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal, { ModalBackdrop } from './Modal';

describe('Modal', () => {
  it('keeps visual backdrops from intercepting dialog interactions', () => {
    const { container } = render(<ModalBackdrop />);

    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('pointer-events-none');
  });

  it('keeps the header separate from the scrolling content for information modals', () => {
    render(
      <Modal open onClose={vi.fn()} title="Information" variant="information">
        <p>Inhalt</p>
      </Modal>,
    );

    const title = screen.getByText('Information');
    const content = screen.getByText('Inhalt').parentElement;

    expect(title.parentElement).toHaveClass('shrink-0');
    expect(content).toHaveClass('overflow-y-auto');
    expect(content).toHaveClass('min-h-0');
  });
});
