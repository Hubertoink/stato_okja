type StaffTime = { staffId: string; minutes: number };

export function activityFormMinutes(form: { start?: string; end?: string }): number | null {
  if (!form.start || !form.end) return null;
  const minutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  const duration = (minutes(form.end) - minutes(form.start) + 1440) % 1440;
  return Number.isFinite(duration) ? duration : null;
}

export function customStaffTimes(times: StaffTime[] | undefined, staffIds: string[] | undefined, duration: number | null | undefined): StaffTime[] {
  return (times || []).filter(entry => staffIds?.includes(entry.staffId) && entry.minutes !== duration);
}
