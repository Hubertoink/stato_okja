/** Calendar year of a DATE column. The alias must come from the query builder. */
export function activityYearExpression(databaseType: string, alias: 'a' | 'activity'): string {
  const date = `${alias}.date`;
  return databaseType === 'postgres' ? `TO_CHAR(${date}, 'YYYY')` : `strftime('%Y', ${date})`;
}
