import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal, { ModalBackdrop } from './Modal';

describe('Modal', () => {
  it('lets custom dialogs attach a backdrop-close action', () => {
    const onClick = vi.fn();
    const { container } = render(<ModalBackdrop onClick={onClick} />);

    fireEvent.click(container.querySelector('[aria-hidden="true"]')!);
    expect(onClick).toHaveBeenCalledTimes(1);
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

  it('uses the visual viewport for its fixed overlay', () => {
    render(
      <Modal open onClose={vi.fn()} title="Form" variant="form">
        <input aria-label="Field" />
      </Modal>,
    );

    expect(screen.getByRole('dialog').parentElement).toHaveClass('visual-viewport-fixed');
  });

  it('renders structured modal actions in the shared header', () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Form"
        variant="form"
        headerActions={<span>Status</span>}
      >
        <input aria-label="Field" />
      </Modal>,
    );

    expect(screen.getByText('Status').closest('header')).toContainElement(screen.getByText('Form'));
  });

  it('uses the visible title as its accessible name and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Form" variant="form">
        <input aria-label="Field" />
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Form' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.popState(window, { state: {} });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the modal backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Form" variant="form">
        <input aria-label="Field" />
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Form' });
    fireEvent.click(dialog.parentElement!);
    fireEvent.popState(window, { state: {} });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the structured header when its close button is hidden', () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Form"
        variant="form"
        showCloseButton={false}
      >
        <input aria-label="Field" />
      </Modal>,
    );

    expect(screen.getByText('Form').closest('header')).toHaveClass('border-b');
    expect(screen.queryByRole('button', { name: 'Schließen' })).not.toBeInTheDocument();
  });

  it('releases focused fields when it closes', () => {
    const { rerender } = render(
      <Modal open onClose={vi.fn()} title="Form" variant="form">
        <input aria-label="Field" />
      </Modal>,
    );
    const field = screen.getByLabelText('Field');
    field.focus();

    rerender(
      <Modal open={false} onClose={vi.fn()} title="Form" variant="form">
        <input aria-label="Field" />
      </Modal>,
    );

    expect(document.activeElement).not.toBe(field);
  });
});
