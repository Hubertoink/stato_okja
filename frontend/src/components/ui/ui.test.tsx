import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LogbookStatusBadge from '@/components/LogbookStatusBadge';
import { Button, CloseButton, CreateButton, IconButton } from './Button';
import { ColorPicker } from './ColorPicker';
import { FilterChip } from './FilterChip';
import { ErrorState, LoadingState } from './StatePanel';
import { FieldError, Input } from './Field';
import { ProjectStarButton } from './ProjectStar';
import Toggle from '@/components/Toggle';
import { HeaderFilterButton, HeaderSearchAction } from './HeaderActions';

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

  it('provides the shared primary create-button treatment', () => {
    render(<CreateButton>Neues Projekt</CreateButton>);

    const button = screen.getByRole('button', { name: 'Neues Projekt' });
    expect(button).toHaveClass('rounded-xl', 'bg-viridian', 'border-viridian');
    expect(button.querySelector('svg')).toHaveClass('h-4', 'w-4');
  });

  it('uses tokenized danger styles and defined icon target sizes', () => {
    render(<><Button variant="danger">Löschen</Button><IconButton aria-label="Bearbeiten" size="icon-touch">✎</IconButton></>);

    expect(screen.getByRole('button', { name: 'Löschen' })).toHaveClass('bg-[var(--status-danger-bg)]', 'text-[var(--status-danger-text)]');
    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toHaveClass('h-11', 'w-11');
  });

  it('uses the shared secondary highlight for neutral icon actions', () => {
    render(<IconButton aria-label="Herunterladen" size="icon-compact" variant="secondary">↓</IconButton>);

    expect(screen.getByRole('button', { name: 'Herunterladen' })).toHaveClass(
      'bg-[var(--surface-1)]',
      'hover:bg-[var(--interactive-soft)]',
      'hover:border-[var(--interactive-soft-border)]',
    );
  });

  it('provides one neutral close button with danger feedback', () => {
    render(<CloseButton aria-label="Dialog schließen" size="icon-touch" />);

    const button = screen.getByRole('button', { name: 'Dialog schließen' });
    expect(button).toHaveClass('h-11', 'w-11', 'rounded-full', 'border-[var(--border-subtle)]', 'bg-[var(--surface-2)]');
    expect(button).toHaveClass('hover:border-[var(--status-danger-border)]', 'hover:bg-[var(--status-danger-bg)]');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the same compact, frameless treatment for both project-highlight states', () => {
    const { rerender } = render(<ProjectStarButton ariaLabel="Projekt hervorheben" onClick={vi.fn()} starred={false} />);

    const button = screen.getByRole('button', { name: 'Projekt hervorheben' });
    expect(button).toHaveClass('h-8', 'w-8', 'border-transparent', 'bg-transparent', 'text-[var(--text-muted)]');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    rerender(<ProjectStarButton ariaLabel="Highlight entfernen" onClick={vi.fn()} starred />);
    const activeButton = screen.getByRole('button', { name: 'Highlight entfernen' });
    expect(activeButton).toHaveClass('h-8', 'w-8', 'border-transparent', 'bg-transparent', 'text-amber-400');
    expect(activeButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses the shared, high-contrast toggle track in the off state', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} label="Archiv" onChange={onChange} />);

    const toggle = screen.getByRole('switch', { name: 'Archiv' });
    expect(toggle).toHaveClass('min-h-10', 'items-center');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle.firstElementChild).toHaveClass('items-center', 'border');

    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('provides shared header search and filter actions', () => {
    const onClear = vi.fn();
    const onValueChange = vi.fn();
    render(<>
      <HeaderSearchAction
        clearLabel="Suche löschen"
        closeLabel="Suche schließen"
        onClear={onClear}
        onOpenChange={vi.fn()}
        onValueChange={onValueChange}
        open
        openLabel="Suche öffnen"
        placeholder="Suchen"
        value="Test"
      />
      <HeaderFilterButton aria-label="Filtern" onClick={vi.fn()} title="Filtern" />
    </>);

    expect(screen.getByRole('search')).toHaveClass('header-action-popover');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Neu' } });
    expect(onValueChange).toHaveBeenCalledWith('Neu');
    fireEvent.click(screen.getByRole('button', { name: 'Suche löschen' }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Filtern' })).toHaveClass('bg-[var(--surface-1)]');
  });

  it('provides shared invalid field semantics and an error message', () => {
    render(<><Input aria-describedby="name-error" invalid aria-label="Name" /><FieldError id="name-error">Name fehlt</FieldError></>);

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'name-error');
  });

  it('removes an active filter chip', () => {
    const onRemove = vi.fn();
    render(<FilterChip onRemove={onRemove}>Status: Offen</FilterChip>);

    const remove = screen.getByRole('button', { name: 'Filter entfernen' });
    expect(remove).toHaveClass('h-5', 'w-5', 'rounded-full', 'bg-[var(--surface-2)]');
    fireEvent.click(remove);
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
    expect(screen.getByRole('dialog', { name: 'Farbe auswählen' })).toHaveClass('fixed');
  });
});
