import type { Survey, SurveyStatus } from './surveys';

const statusOrder: Record<SurveyStatus, number> = { active: 0, draft: 1, closed: 2, archived: 3 };

/** Keep the existing order within each status and leave cached query data untouched. */
export function sortSurveysByStatus<T extends Pick<Survey, 'status' | 'archived'>>(surveys: readonly T[]): T[] {
  const rank = (survey: T) => survey.archived ? statusOrder.archived : statusOrder[survey.status];
  return [...surveys].sort((left, right) => rank(left) - rank(right));
}
