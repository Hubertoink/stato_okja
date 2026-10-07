import type { StaffMember, StaffRole } from './staff';

export function getSelectableStaff(
  staff: StaffMember[] | undefined,
  selected: readonly string[] = [],
  key: 'id' | 'name' = 'id',
): StaffMember[] {
  const assigned = new Set(selected);
  return (staff || []).filter((person) => person.active !== false || assigned.has(person[key]));
}

export function getProjectStaffOptions(
  staff: StaffMember[] | undefined,
  selectedNames: readonly string[],
  roles: StaffRole[],
): StaffMember[] {
  return getSelectableStaff(staff, selectedNames, 'name').filter((person) => {
    // Keep existing assignments visible even if the person's role has changed.
    if (selectedNames.includes(person.name)) return true;
    const personRoles = Array.isArray(person.roles) ? person.roles : [person.roles ?? person.role];
    return personRoles.some((role) => role !== undefined && roles.includes(role));
  });
}
