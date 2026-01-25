import { FIXED_PALETTE } from './colorPalette';

export type DefaultCategoryDef = {
  name: string;
  color: string;
  description?: string;
  standardRef?: string;
};

// Standard-Kategorien (aus den Referenzbildern)
// Keep in sync with Settings and any template/category seeding.
export const DEFAULT_CATEGORIES: DefaultCategoryDef[] = [
  // Map defaults into the fixed palette; reuse colors if more than 12
  { name: 'Beratung', color: FIXED_PALETTE[0] },
  { name: 'Erlebnispädagogik', color: FIXED_PALETTE[1] },
  { name: 'Ernährung und Gesundheit', color: FIXED_PALETTE[2] },
  { name: 'Ferienfreizeiten und -angebote', color: FIXED_PALETTE[3] },
  { name: 'Genderpädagogik', color: FIXED_PALETTE[4] },
  { name: 'Handwerk und Technik', color: FIXED_PALETTE[5] },
  { name: 'Hausaufgaben- und Lernbetreuung', color: FIXED_PALETTE[6] },
  { name: 'Künstlerisches Gestalten (u.a. Basteln, Malen)', color: FIXED_PALETTE[7] },
  { name: 'Medienbildung', color: FIXED_PALETTE[8] },
  { name: 'Multiplikator*innenarbeit', color: FIXED_PALETTE[9] },
  { name: 'Musik und Tanz', color: FIXED_PALETTE[10 % FIXED_PALETTE.length] },
  { name: 'Natur und Umwelt', color: FIXED_PALETTE[11 % FIXED_PALETTE.length] },
  {
    name: 'Politische und gesellschaftliche Bildung',
    color: FIXED_PALETTE[12 % FIXED_PALETTE.length],
  },
  { name: 'Prävention und Soziales Lernen', color: FIXED_PALETTE[13 % FIXED_PALETTE.length] },
  {
    name: 'Sonderveranstaltungen und Stadtteilfeste',
    color: FIXED_PALETTE[14 % FIXED_PALETTE.length],
  },
  { name: 'Sonstiges', color: FIXED_PALETTE[15 % FIXED_PALETTE.length] },
  { name: 'Spiel', color: FIXED_PALETTE[16 % FIXED_PALETTE.length] },
  { name: 'Sport', color: FIXED_PALETTE[17 % FIXED_PALETTE.length] },
  { name: 'Theater und Kultur', color: FIXED_PALETTE[18 % FIXED_PALETTE.length] },
];

export function defaultCategoryByName(name: string): DefaultCategoryDef | undefined {
  const needle = (name || '').trim().toLowerCase();
  return DEFAULT_CATEGORIES.find((c) => c.name.trim().toLowerCase() === needle);
}
