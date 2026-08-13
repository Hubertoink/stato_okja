// Lightweight German holidays calculator for calendar overlay
// Note: Covers nationwide and common state-specific public holidays. School holidays not included.

export type StateCode =
  | 'BW'
  | 'BY'
  | 'BE'
  | 'BB'
  | 'HB'
  | 'HH'
  | 'HE'
  | 'MV'
  | 'NI'
  | 'NW'
  | 'RP'
  | 'SL'
  | 'SN'
  | 'ST'
  | 'SH'
  | 'TH';

export const germanStates: { code: StateCode; name: string }[] = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
];

function ymd(y: number, m: number, d: number) {
  // m: 1-12
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Anonymous Gregorian algorithm for Easter Sunday
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

export type Holiday = { date: string; name: string; type: 'public' | 'school' };

function baseHolidays(year: number) {
  const easter = easterSunday(year);
  const goodFriday = addDays(easter, -2);
  const easterMonday = addDays(easter, 1);
  const ascension = addDays(easter, 39); // Christi Himmelfahrt
  const pentecostMonday = addDays(easter, 50);

  return [
    { date: toISO(ymd(year, 1, 1)), name: 'Neujahr', type: 'public' as const },
    { date: toISO(goodFriday), name: 'Karfreitag', type: 'public' as const },
    { date: toISO(easterMonday), name: 'Ostermontag', type: 'public' as const },
    { date: toISO(ymd(year, 5, 1)), name: 'Tag der Arbeit', type: 'public' as const },
    { date: toISO(ascension), name: 'Christi Himmelfahrt', type: 'public' as const },
    { date: toISO(pentecostMonday), name: 'Pfingstmontag', type: 'public' as const },
    { date: toISO(ymd(year, 10, 3)), name: 'Tag der Deutschen Einheit', type: 'public' as const },
    { date: toISO(ymd(year, 12, 25)), name: '1. Weihnachtstag', type: 'public' as const },
    { date: toISO(ymd(year, 12, 26)), name: '2. Weihnachtstag', type: 'public' as const },
  ];
}

function stateSpecific(year: number, state?: StateCode | '' | null): Holiday[] {
  if (!state) return [];
  const easter = easterSunday(year);
  const corpusChristi = addDays(easter, 60); // Fronleichnam
  const epiphany = ymd(year, 1, 6); // Heilige Drei Könige
  const assumption = ymd(year, 8, 15); // Mariä Himmelfahrt
  const reformation = ymd(year, 10, 31);
  const allSaints = ymd(year, 11, 1);
  const repentance = (() => {
    // Buß- und Bettag: Wednesday before 23 Nov
    const nov23 = ymd(year, 11, 23);
    // go back to Wednesday
    const day = nov23.getDay(); // 0=Sun..6=Sat
    const daysBack = ((day + 4) % 7) + 5; // ensure previous Wednesday
    return addDays(nov23, -daysBack);
  })();

  const list: Holiday[] = [];
  // Heilige Drei Könige: BW, BY, ST
  if (['BW', 'BY', 'ST'].includes(state))
    list.push({ date: toISO(epiphany), name: 'Heilige Drei Könige', type: 'public' });
  // Fronleichnam: BW, BY, HE, NW, RP, SL
  if (['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].includes(state))
    list.push({ date: toISO(corpusChristi), name: 'Fronleichnam', type: 'public' });
  // Mariä Himmelfahrt: SL (voll), BY (in Teilen; wir zeigen es allgemein)
  if (['SL', 'BY'].includes(state))
    list.push({ date: toISO(assumption), name: 'Mariä Himmelfahrt', type: 'public' });
  // Reformationstag: BB, MV, SN, ST, TH, SH, HH, HB, NI
  if (['BB', 'MV', 'SN', 'ST', 'TH', 'SH', 'HH', 'HB', 'NI'].includes(state))
    list.push({ date: toISO(reformation), name: 'Reformationstag', type: 'public' });
  // Allerheiligen: BW, BY, NW, RP, SL
  if (['BW', 'BY', 'NW', 'RP', 'SL'].includes(state))
    list.push({ date: toISO(allSaints), name: 'Allerheiligen', type: 'public' });
  // Buß- und Bettag: nur SN
  if (state === 'SN')
    list.push({ date: toISO(repentance), name: 'Buß- und Bettag', type: 'public' });
  // Weltkindertag: TH (20. September)
  if (state === 'TH')
    list.push({ date: toISO(ymd(year, 9, 20)), name: 'Weltkindertag', type: 'public' });
  // Internationaler Frauentag: BE (8. März)
  if (state === 'BE')
    list.push({ date: toISO(ymd(year, 3, 8)), name: 'Internationaler Frauentag', type: 'public' });
  // Reformationstag in HB, HH, NI, SH added 2018 already handled above
  return list;
}

function getHolidays(year: number, state?: StateCode | '' | null): Holiday[] {
  return [...baseHolidays(year), ...stateSpecific(year, state)];
}

export function getHolidaysInRange(fromISO: string, toISO: string, state?: StateCode | '' | null) {
  const from = new Date(fromISO + 'T00:00:00');
  const to = new Date(toISO + 'T00:00:00');
  const years = new Set<number>();
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) years.add(y);
  const all: Holiday[] = [];
  years.forEach((y) => all.push(...getHolidays(y, state)));
  return all.filter((h) => {
    const d = new Date(h.date + 'T00:00:00');
    return d >= from && d <= to;
  });
}

export function readHolidayPrefs(): { state: StateCode | ''; school: boolean; publicHolidays: boolean } {
  try {
    const raw = localStorage.getItem('holidayPrefs');
    if (!raw) return { state: '', school: false, publicHolidays: true };
    const obj = JSON.parse(raw);
    return {
      state: (obj?.state || '') as StateCode | '',
      school: Boolean(obj?.school),
      publicHolidays: typeof obj?.publicHolidays === 'boolean' ? obj.publicHolidays : true,
    };
  } catch {
    return { state: '', school: false, publicHolidays: true };
  }
}
