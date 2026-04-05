import type { StateCode } from '@/lib/holidays';

export type SchoolHolidayRange = {
  start: string; // ISO date YYYY-MM-DD
  end: string; // ISO date YYYY-MM-DD
  name: string;
};

// Map internal StateCode (e.g., 'HE') to OpenHolidays subdivision (e.g., 'DE-HE')
function subdivisionFor(code: StateCode) {
  return `DE-${code}`;
}

function yearBounds(year: number) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  return { from, to };
}

const OPEN_HOLIDAYS_ENDPOINT = '/external/openholidaysapi/SchoolHolidays';

type OpenHolidaysName = { language?: string; text?: string };
type OpenHolidaysItem = {
  startDate?: string;
  endDate?: string;
  start?: string;
  end?: string;
  name?: string | OpenHolidaysName[];
  englishName?: string;
};

function parseName(raw: OpenHolidaysItem): string {
  // OpenHolidays typically returns name as an array with { language, text }
  if (raw?.name) {
    if (Array.isArray(raw.name)) {
      const entry =
        (raw.name as OpenHolidaysName[]).find((n) => typeof n?.text === 'string') ||
        (raw.name as OpenHolidaysName[])[0];
      if (entry?.text) return String(entry.text);
    } else if (typeof raw.name === 'string') {
      return raw.name;
    }
  }
  if (typeof raw?.englishName === 'string') return raw.englishName;
  return 'Schulferien';
}

async function fetchYear(
  state: StateCode,
  year: number,
  signal?: AbortSignal,
): Promise<SchoolHolidayRange[]> {
  const subdiv = subdivisionFor(state);
  const cacheKey = `schoolHolidays:${subdiv}:${year}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed as SchoolHolidayRange[];
    }
  } catch {
    /* ignore cache parse */
  }

  const { from, to } = yearBounds(year);
  const url = new URL(OPEN_HOLIDAYS_ENDPOINT, window.location.origin);
  url.searchParams.set('countryIsoCode', 'DE');
  url.searchParams.set('subdivisionCode', subdiv);
  url.searchParams.set('languageIsoCode', 'DE');
  url.searchParams.set('validFrom', from);
  url.searchParams.set('validTo', to);

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' }, signal });
  if (!res.ok) throw new Error(`OpenHolidays ${res.status}`);
  const data: OpenHolidaysItem[] = await res.json();
  const normalized: SchoolHolidayRange[] = (Array.isArray(data) ? data : [])
    .map((h: OpenHolidaysItem) => ({
      start: String(h?.startDate ?? h?.start ?? '').slice(0, 10),
      end: String(h?.endDate ?? h?.end ?? '').slice(0, 10),
      name: parseName(h),
    }))
    .filter((x: SchoolHolidayRange) => x.start && x.end);

  try {
    localStorage.setItem(cacheKey, JSON.stringify(normalized));
  } catch {
    /* ignore storage quota */
  }
  return normalized;
}

export async function getSchoolHolidaysInRange(
  state: StateCode,
  fromISO: string,
  toISO: string,
  signal?: AbortSignal,
) {
  // Aggregate by per-year fetch to leverage cache and minimize requests
  const from = new Date(fromISO + 'T00:00:00');
  const to = new Date(toISO + 'T00:00:00');
  const years: number[] = [];
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) years.push(y);
  const results = await Promise.all(years.map((y) => fetchYear(state, y, signal)));
  return results.flat().filter((r) => {
    // Keep only ranges that intersect [fromISO, toISO]
    return !(r.end < fromISO || r.start > toISO);
  });
}
