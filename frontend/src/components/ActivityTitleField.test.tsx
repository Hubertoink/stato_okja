import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ActivityTitleField from './ActivityTitleField';

describe('ActivityTitleField', () => {
  it('uses a single-row textarea so Android does not classify it as a credential input', () => {
    render(<ActivityTitleField aria-label="Titel" value="Werkraum" onValueChange={vi.fn()} />);

    const field = screen.getByRole('textbox', { name: 'Titel' });
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('rows', '1');
    expect(field).toHaveAttribute('autocomplete', 'off');
    expect(field).toHaveAttribute('enterkeyhint', 'done');
  });

  it('normalizes pasted line breaks and does not insert a line on Enter', () => {
    const onValueChange = vi.fn();
    render(<ActivityTitleField aria-label="Titel" value="" onValueChange={onValueChange} />);

    const field = screen.getByRole('textbox', { name: 'Titel' });
    fireEvent.change(field, { target: { value: 'Offene\nTür' } });
    expect(onValueChange).toHaveBeenCalledWith('Offene Tür');

    field.focus();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).not.toHaveFocus();
  });
});
