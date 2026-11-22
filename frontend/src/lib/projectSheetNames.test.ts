import { expect, it } from 'vitest';
import { read, utils, write } from 'xlsx-js-style';
import { createProjectSheetNamer } from './projectSheetNames';

it('round-trips contribution and project sheets with colliding names and keeps their contents distinct', () => {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([['Zuordnung']]), 'Mitwirkung');
  const uniqueName = createProjectSheetNamer(workbook);
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([['Projekt A']]), uniqueName('Mitwirkung'));
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([['Projekt B']]), uniqueName('MITWIRKUNG'));

  const saved = read(write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
  expect(saved.SheetNames).toEqual(['Mitwirkung', 'Mitwirkung 2', 'MITWIRKUNG 3']);
  expect(saved.SheetNames.map(name => saved.Sheets[name].A1.v)).toEqual(['Zuordnung', 'Projekt A', 'Projekt B']);
});
