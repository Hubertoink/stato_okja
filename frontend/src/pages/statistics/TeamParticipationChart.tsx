import { TeamChartCard } from './TeamChartCard';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { teamParticipation } from './teamParticipation';

const colors = ['#2563eb', '#8b5cf6', '#0d9488', '#f59e0b', '#e11d48', '#0891b2', '#65a30d', '#c026d3'];

export function TeamParticipationChart({ rows }: { rows: Parameters<typeof teamParticipation>[0] }) {
  const data = teamParticipation(rows);
  const total = data.reduce((sum, member) => sum + member.value, 0);
  const percent = (value: number) => `${(value / total * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
  return (
    <TeamChartCard title="Durchgeführte Einsätze nach Teammitglied">
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Beteiligung an den Aktivitäten der aktuellen Auswahl. Pro Aktivität zählt jede zugeordnete
        Person einmal. Gemeinsame Aktivitäten ergeben mehrere Team-Einsätze; geplante und
        ausgefallene Aktivitäten zählen nicht mit.
      </p>
      {!total ? <p className="mt-4 text-sm text-[var(--text-secondary)]">Keine durchgeführten Team-Einsätze für diese Auswahl.</p> : (
        <div className="mt-4 grid min-w-0 items-center gap-6 md:grid-cols-2">
          <div className="relative h-64 min-w-0" role="img" aria-label={`Ringdiagramm: ${total.toLocaleString('de-DE')} durchgeführte Team-Einsätze. Werte je Person in der folgenden Tabelle.`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%"
                  stroke="var(--surface-1)" strokeWidth={2} isAnimationActive={false}>
                  {data.map((member, index) => <Cell key={member.staffId} fill={colors[index % colors.length]} />)}
                </Pie>
                <Tooltip wrapperStyle={{ zIndex: 10 }}
                  contentStyle={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border-subtle)', borderRadius: 12, color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  formatter={(value: number) => [`${value.toLocaleString('de-DE')} Einsätze · ${percent(value)}`, 'Durchgeführt']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
              <strong className="text-3xl tabular-nums">{total.toLocaleString('de-DE')}</strong>
              <span className="text-xs text-[var(--text-secondary)]">Team-Einsätze</span>
            </div>
          </div>
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">Durchgeführte Einsätze und Anteil je Teammitglied</caption>
            <thead><tr className="text-xs text-[var(--text-secondary)]">
              <th scope="col" className="pb-3 text-left font-medium">Teammitglied</th>
              <th scope="col" className="w-16 pb-3 text-right font-medium">Einsätze</th>
              <th scope="col" className="w-20 pb-3 text-right font-medium">Anteil</th>
            </tr></thead>
            <tbody>{data.map((member, index) => (
              <tr key={member.staffId} className="border-t border-[var(--border-subtle)]">
                <th scope="row" className="py-3 pr-3 text-left font-medium">
                  <span className="flex items-start gap-2">
                    <span aria-hidden="true" data-export-preserve-background="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                    <span className="min-w-0 break-words">{member.name}</span>
                  </span>
                </th>
                <td className="py-3 text-right tabular-nums">{member.value.toLocaleString('de-DE')}</td>
                <td className="py-3 text-right tabular-nums text-[var(--text-secondary)]">{percent(member.value)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </TeamChartCard>
  );
}
