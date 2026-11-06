export type TeamDayRow = { date?: string; staffId: string; status: string; minutes: number };

/** Count each person once per working day, even with several activities/types. */
export function teamTimeSeries(rows: TeamDayRow[]) {
  const personDays = new Map<string, { date: string; minutes: number }>();
  for (const row of rows) {
    if (row.status !== 'completed' || !row.date || row.minutes <= 0) continue;
    const key = `${row.date}/${row.staffId}`;
    const day = personDays.get(key) || { date: row.date, minutes: 0 };
    day.minutes += row.minutes;
    personDays.set(key, day);
  }
  const monthly = new Set([...personDays.values()].map((day) => day.date)).size > 62;
  const periods = new Map<string, { minutes: number; days: number }>();
  const weekdays = Array.from({ length: 7 }, () => ({ minutes: 0, days: 0 }));
  for (const day of personDays.values()) {
    const key = monthly ? day.date.slice(0, 7) : day.date;
    const period = periods.get(key) || { minutes: 0, days: 0 };
    period.minutes += day.minutes;
    period.days++;
    periods.set(key, period);
    const weekday = (new Date(`${day.date}T12:00:00Z`).getUTCDay() + 6) % 7;
    weekdays[weekday].minutes += day.minutes;
    weekdays[weekday].days++;
  }
  const value = (entry: { minutes: number; days: number }) =>
    entry.days ? entry.minutes / entry.days / 60 : 0;
  return {
    monthly,
    timeline: [...periods.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, entry]) => ({ name, hours: value(entry) })),
    weekdays: weekdays.map((entry, index) => ({
      name: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][index],
      hours: value(entry),
    })),
  };
}
