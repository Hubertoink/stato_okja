import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HeaderSearchAction } from './HeaderActions';

function SearchExample() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('Test');
  return <>
    <HeaderSearchAction open={open} onOpenChange={setOpen} value={value} onValueChange={setValue}
      onClear={() => setValue('')} clearLabel="Löschen" closeLabel="Suche schließen" openLabel="Suche öffnen" placeholder="Suchen" />
    <button type="button">Außerhalb</button>
  </>;
}

describe('header search dismissal', () => {
  it('toggles with the trigger and stays open during interaction inside', async () => {
    const user = userEvent.setup();
    render(<SearchExample />);
    await user.click(screen.getByRole('button', { name: 'Suche öffnen' }));
    await user.click(screen.getByRole('searchbox'));
    expect(screen.getByRole('search')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Suche schließen' }));
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });

  it('closes on an outside pointer without discarding the search', async () => {
    const user = userEvent.setup();
    render(<SearchExample />);
    await user.click(screen.getByRole('button', { name: 'Suche öffnen' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Außerhalb' }), { pointerType: 'touch' });
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Suche öffnen' }));
    expect(screen.getByRole('searchbox')).toHaveValue('Test');
  });

  it('returns focus to the trigger on Escape', async () => {
    const user = userEvent.setup();
    render(<SearchExample />);
    await user.click(screen.getByRole('button', { name: 'Suche öffnen' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suche öffnen' })).toHaveFocus();
  });
});
