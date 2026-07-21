import type { LogbookEntryStatus, LogbookEntryType } from './logbook';

export const logbookTypeLabels: Record<LogbookEntryType, string> = {
  observation: 'Beobachtung',
  incident: 'Besonderes Vorkommnis',
  success: 'Erfolg',
  handover: 'Übergabe',
  debrief: 'Debriefing',
  other: 'Sonstiges',
};

export const logbookStatusLabels: Record<LogbookEntryStatus, string> = {
  open: 'Offen',
  follow_up: 'Nachverfolgung',
  discussed: 'Besprochen',
  archived: 'Archiviert',
};
