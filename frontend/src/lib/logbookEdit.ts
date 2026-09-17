import type { LogbookEntry, LogbookEntryInput } from './logbook';
import { toLogbookDateTimeInput } from './logbookDate';

export type LogbookDraft = {
  title: string; body: string; occurredAt: string;
  type: LogbookEntry['type']; status: LogbookEntry['status']; visibility: LogbookEntry['visibility'];
  highlights: string; challenges: string; nextSteps: string; projectId: string; activityId: string;
};

export function logbookDraft(entry: LogbookEntry): LogbookDraft {
  return {
    title: entry.title, body: entry.body, occurredAt: toLogbookDateTimeInput(entry.occurredAt),
    type: entry.type, status: entry.status, visibility: entry.visibility,
    highlights: entry.highlights || '', challenges: entry.challenges || '', nextSteps: entry.nextSteps || '',
    projectId: entry.projectId || entry.project?.id || '', activityId: entry.activityId || entry.activity?.id || '',
  };
}

export function logbookDraftPayload(draft: LogbookDraft, isAdmin: boolean): LogbookEntryInput {
  return {
    title: draft.title.trim(), body: draft.body.trim(), occurredAt: new Date(draft.occurredAt).toISOString(),
    type: draft.type, status: draft.status, ...(isAdmin ? { visibility: draft.visibility } : {}),
    highlights: draft.highlights || null, challenges: draft.challenges || null, nextSteps: draft.nextSteps || null,
    projectId: draft.projectId || null, activityId: draft.activityId || null,
  };
}
