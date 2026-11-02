import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StaffTimesButton, activityFormMinutes } from './StaffTimesButton';
import {
  buildActivitySavePayload,
  getActivityFormStateFromActivity,
  getActivityFormSnapshot,
} from '@/pages/activityEditorShared';
import type { Activity } from '@/lib/activities';
vi.mock('./Modal', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
}));
const staff = [{ id: 'anna', name: 'Anna' }];
const form = { start: '11:30', end: '15:30', staffIds: ['anna'] };
describe('staff time editor', () => {
  it('defaults to activity duration and only applies when confirmed', () => {
    const onChange = vi.fn();
    render(<StaffTimesButton form={form} staff={staff} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Einsatzzeiten anpassen' }));
    expect(screen.getByLabelText('Anna: Stunden')).toHaveValue(4);
    fireEvent.change(screen.getByLabelText('Anna: Stunden'), { target: { value: '2' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(onChange).toHaveBeenCalledWith([{ staffId: 'anna', minutes: 120 }]);
  });
  it('blocks longer times and lets the user reset to automatic duration', () => {
    const onChange = vi.fn();
    render(<StaffTimesButton form={form} staff={staff} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Einsatzzeiten anpassen' }));
    fireEvent.change(screen.getByLabelText('Anna: Minuten'), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Aktivitätsdauer übernehmen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
  it('discards modal edits on cancel', () => {
    const onChange = vi.fn();
    render(<StaffTimesButton form={form} staff={staff} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Einsatzzeiten anpassen' }));
    fireEvent.change(screen.getByLabelText('Anna: Stunden'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onChange).not.toHaveBeenCalled();
  });
  it('supports overnight duration and missing times', () => {
    expect(activityFormMinutes({ start: '23:00', end: '01:00' })).toBe(120);
    expect(activityFormMinutes({})).toBeNull();
  });
  it('round trips overrides, detects unsaved changes, and drops deselected people', () => {
    const activity = {
      id: 'a',
      date: '2026-11-02',
      type: 'event',
      staff,
      staffTimes: [{ staffId: 'anna', minutes: 45 }],
    } as Activity;
    const state = getActivityFormStateFromActivity(activity);
    expect(buildActivitySavePayload({ form: state }).staffTimes).toEqual(activity.staffTimes);
    expect(getActivityFormSnapshot(state)).not.toBe(
      getActivityFormSnapshot({ ...state, staffTimes: [] }),
    );
    expect(buildActivitySavePayload({ form: { ...state, staffIds: [] } }).staffTimes).toEqual([]);
  });
});
