import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import RoleInfo from './RoleInfo';

it('opens role permissions and restores focus on Escape', () => {
  render(<RoleInfo role="org_admin" />);
  const trigger = screen.getByRole('button', { name: 'Berechtigungen: Org-Admin' });
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Org-Admin' });
  expect(dialog).toHaveTextContent('organisationsweite Vorgaben');
  expect(dialog).toHaveTextContent('aktuellen Organisationskontext');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
