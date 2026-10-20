/** First date after the selected period; month grid spillover belongs to the next month. */
export function nextCalendarPeriodStart(cursor: Date, view: 'month' | 'week' | 'three-day' | 'analysis', mobileAnalysis = false): string {
  const date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
  if (view === 'month') {
    date.setMonth(date.getMonth() + 1, 1);
  } else if (view === 'three-day' || mobileAnalysis) {
    date.setDate(date.getDate() + 3);
  } else {
    const weekday = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() + 7 - weekday);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
