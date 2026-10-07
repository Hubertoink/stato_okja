import { describe, expect, it } from 'vitest';
import type { StaffMember } from './staff';
import { getProjectStaffOptions, getSelectableStaff } from './staffSelection';
import { getStaffGroupMembers, mergeProjectStaffIds } from '@/pages/activityEditorShared';

const staff: StaffMember[] = [
  { id: 'active', name: 'Active', role: 'employee', active: true },
  { id: 'assigned', name: 'Assigned archive', role: 'employee', active: false },
  { id: 'other', name: 'Other archive', role: 'employee', active: false },
  { id: 'volunteer', name: 'Volunteer archive', role: 'volunteer', active: false },
  { id: 'helper', name: 'Helper archive', roles: ['helper'], active: false },
];

describe('archived staff assignments', () => {
  it('shows assigned archived project members until removed', () => {
    expect(getProjectStaffOptions(staff, ['Assigned archive'], ['employee']).map((s) => s.id))
      .toEqual(['active', 'assigned']);
    expect(getProjectStaffOptions(staff, [], ['employee']).map((s) => s.id)).toEqual(['active']);
  });

  it('keeps assigned project members visible after a role change', () => {
    expect(getProjectStaffOptions(staff, ['Volunteer archive'], ['employee']).map((s) => s.id))
      .toEqual(['active', 'volunteer']);
  });

  it.each(['employee', 'volunteer', 'helper'] as const)('keeps assigned archived %s activity members removable', (group) => {
    const id = group === 'employee' ? 'assigned' : group;
    expect(getStaffGroupMembers(staff, group, [id]).some((s) => s.id === id)).toBe(true);
    expect(getStaffGroupMembers(staff, group, []).some((s) => s.id === id)).toBe(false);
  });

  it('preserves existing activity assignments but does not add archived project defaults', () => {
    const project = { id: 'project', title: 'Project', type: 'project_open' as const,
      defaultStaff: 'Active, Assigned archive', defaultVolunteers: 'Volunteer archive' };
    expect(mergeProjectStaffIds([], project, staff)).toEqual(['active']);
    expect(mergeProjectStaffIds(['assigned'], project, staff)).toEqual(['assigned', 'active']);
    expect(getSelectableStaff(undefined, ['assigned'])).toEqual([]);
  });
});
