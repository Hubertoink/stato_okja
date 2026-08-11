export type WeeklyProfileDay = {
  weekday: number;
  occurrences: number;
  activityCount: number;
  activityMinutes: number;
  coveredMinutes: number;
  participantTotal: number;
  averageParticipants: number;
};

export type WeeklyProfileSlot = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  activityMinutes: number;
  coveredMinutes: number;
  activityCount: number;
  participantTotal: number;
  averageOffers: number;
  coverageFrequency: number;
  averageParticipants: number;
};

export type WeeklyProfile = {
  slotMinutes: number;
  rangeStart: number;
  rangeEnd: number;
  excludedWithoutTime: number;
  days: WeeklyProfileDay[];
  slots: WeeklyProfileSlot[];
};

export function formatWeeklyProfileTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}
