import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorActions, EditorHeader, EditorSurface } from './EditorFrame';

describe('EditorFrame', () => {
  it('uses the shared framed surface and header controls', () => {
    const onClose = vi.fn();
    render(
      <EditorSurface>
        <EditorHeader
          title="Eintrag bearbeiten"
          actions={<span>Status</span>}
          closeLabel="Schließen"
          onClose={onClose}
        />
      </EditorSurface>,
    );

    expect(screen.getByText('Eintrag bearbeiten')).toHaveClass('text-viridian');
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Eintrag bearbeiten').closest('div')).toHaveClass('rounded-2xl');
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps mobile actions in document flow with save before cancel', () => {
    render(
      <EditorActions
        secondary={<button>Abbrechen</button>}
        primary={<button>Speichern</button>}
      />,
    );

    const footer = screen.getByText('Speichern').closest('footer');
    expect(footer).not.toHaveClass('fixed');
    expect(footer).not.toHaveClass('sticky');
    expect(screen.getByText('Speichern').parentElement).toHaveClass('order-1');
    expect(screen.getByText('Abbrechen').parentElement).toHaveClass('order-2');
  });
});
