export function monthlyActivityCounts(rows: Array<{ date: string; activityCount: number }>, year: string) {
  const counts = Array<number>(12).fill(0);
  for (const row of rows) {
    const month = Number(row.date.slice(5, 7));
    if (row.date.slice(0, 4) === year && month >= 1 && month <= 12) counts[month - 1] += row.activityCount;
  }
  return counts;
}

export function MonthActivityIndicator({ count, max, active }: { count?: number; max: number; active: boolean }) {
  return <span aria-hidden="true" className={`block mt-1 h-1 rounded-full overflow-hidden ${active ? 'bg-white/25' : 'bg-gray-200'}`}>
    {count !== undefined && count > 0 && <span className={`block h-full rounded-full ${active ? 'bg-white' : 'bg-viridian'}`}
      style={{ width: `${Math.max(4, count / Math.max(1, max) * 100)}%` }} />}
  </span>;
}
