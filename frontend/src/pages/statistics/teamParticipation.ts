type ParticipationRow = {
  staffId: string;
  name: string;
  status: string;
  assignments: number;
};

export function teamParticipation(rows: ParticipationRow[]) {
  const members = new Map<string, { staffId: string; name: string; value: number }>();
  for (const row of rows) {
    if (row.status !== 'completed' || row.assignments <= 0) continue;
    const member = members.get(row.staffId) || { staffId: row.staffId, name: row.name, value: 0 };
    member.value += row.assignments;
    members.set(row.staffId, member);
  }
  return [...members.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'de'));
}
