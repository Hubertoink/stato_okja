import type { LogbookEntryStatus, LogbookEntryType } from './logbook';
import { autoT } from '@/i18n/auto';

export const logbookTypeLabels: Record<LogbookEntryType, string> = {
  observation: 'Beobachtung',
  incident: 'Besonderes Vorkommnis',
  success: 'Erfolg',
  handover: autoT('ui_b1d6928a7eb9'),
  debrief: 'Debriefing',
  other: 'Sonstiges',
};

export const logbookStatusLabels: Record<LogbookEntryStatus, string> = {
  open: 'Offen',
  follow_up: 'Nachverfolgung',
  discussed: 'Besprochen',
  archived: autoT('ui_7d6b45e9c890'),
};
