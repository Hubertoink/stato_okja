import { describe, expect, it } from 'vitest';
import { sortSurveysByStatus } from './surveySort';
import type { SurveyStatus } from './surveys';

describe('survey status order', () => {
  it('puts active surveys first, then drafts, completed surveys and archived surveys', () => {
    const entries = ['closed', 'draft', 'active', 'archived', 'active', 'closed'].map((status, id) => ({ id, status: status as SurveyStatus, archived: status === 'archived' }));
    const previousOrder = entries.map(entry => entry.id);
    expect(sortSurveysByStatus(entries).map(entry => entry.id)).toEqual([2, 4, 1, 0, 5, 3]);
    expect(entries.map(entry => entry.id)).toEqual(previousOrder);
  });
  it('keeps archived records at the end even when they retain their previous status', () => {
    expect(sortSurveysByStatus([{ id: 'archived', status: 'active', archived: true }, { id: 'closed', status: 'closed', archived: false }]).map(entry => entry.id)).toEqual(['closed', 'archived']);
    expect(sortSurveysByStatus([])).toEqual([]);
  });
});
