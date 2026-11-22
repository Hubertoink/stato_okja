import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import EmailChangeConfirmation from './EmailChangeConfirmation';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }));

it('opens each mail link without consuming it and supports both confirmations in one tab', async () => {
  const first = '/email-change#requestId=id&action=verify&token=new';
  const second = '/email-change#requestId=id&action=approve&token=old';
  vi.mocked(api.post).mockResolvedValueOnce({ data: { state: 'waiting' } })
    .mockResolvedValueOnce({ data: { state: 'completed' } });
  render(<MemoryRouter initialEntries={[first]}>
    <EmailChangeConfirmation /><Link to={second}>Zweite Mail</Link>
  </MemoryRouter>);

  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Neue Adresse bestätigen' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Bestätigung gespeichert');
  fireEvent.click(screen.getByRole('link', { name: 'Zweite Mail' }));
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Änderung freigeben' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Die Adresse wurde geändert');
  expect(api.post).toHaveBeenLastCalledWith('/auth/email-change/respond', { requestId: 'id', action: 'approve', token: 'old' });
});
