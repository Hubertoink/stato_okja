import type { WorkBook } from 'xlsx-js-style';
import { autoT } from '@/i18n/auto';

export function createProjectSheetNamer(workbook: WorkBook) {
  const used = new Set(workbook.SheetNames.map(name => name.toLowerCase()));
  return (title: string) => {
    const base = (title.replace(/[\\/?*[\]:]/g, ' ').trim() || autoT('ui_20bda6d2e725')).slice(0, 31);
    let name = base;
    for (let index = 2; used.has(name.toLowerCase()); index++) {
      const suffix = ' ' + index;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  };
}
