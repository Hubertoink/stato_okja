import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LogbookStatusBadge from '@/components/LogbookStatusBadge';
import { Button } from './Button';
import { ColorPicker } from './ColorPicker';
import { FilterChip } from './FilterChip';
import { ErrorState, LoadingState } from './StatePanel';

describe('shared UI components', () => {
  it('renders semantic status tokens for discussed logbook entries', () => {
    render(<LogbookStatusBadge status="discussed" />);

    expect(screen.getByText('Besprochen')).toHaveClass('bg-[var(--status-success-bg)]');
    expect(screen.getByText('Besprochen')).toHaveClass('text-[var(--status-success-text)]');
  });

  it('uses a safe button type and respects disabled state', () => {
    render(<Button disabled>Speichern</Button>);

    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('removes an active filter chip', () => {
    const onRemove = vi.fn();
    render(<FilterChip onRemove={onRemove}>Status: Offen</FilterChip>);

    fireEvent.click(screen.getByRole('button', { name: 'Filter entfernen' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('exposes loading and retry states accessibly', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<LoadingState label="Logbuch wird geladen" />);
    expect(screen.getByText('Logbuch wird geladen')).toBeInTheDocument();

    rerender(<ErrorState action={{ label: 'Erneut versuchen', onClick: onRetry }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('accepts hexadecimal values and generates random colors', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#0f766e" onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Farbwert als Hexadezimalzahl' }), {
      target: { value: '#b079d2' },
    });
    expect(onChange).toHaveBeenLastCalledWith('#b079d2');

    fireEvent.click(screen.getByRole('button', { name: 'Zufällige Farbe erzeugen' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^#[0-9a-f]{6}$/));

    fireEvent.click(screen.getByRole('button', { name: 'Farbauswahl öffnen' }));
    expect(screen.getByRole('dialog', { name: 'Farbe auswählen' })).toBeInTheDocument();
  });
});
