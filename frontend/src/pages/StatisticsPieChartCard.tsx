import type { CSSProperties, ReactNode } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

type StatisticsPieChartDatum = {
  name: string;
  value: number;
  color: string;
};

export function StatisticsPieChartCard({
  title,
  exportActions,
  cardClassName = 'group/chart-card bg-white rounded-lg shadow p-6',
  bodyClassName,
  chartRef,
  data,
  centerY,
  innerRadius,
  outerRadius,
  showAbsoluteValueLabels,
  createLabelRenderer,
  formatValue,
  separatorColor,
  tooltipContentStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  legendWrapperStyle,
  cellKeyPrefix,
}: {
  title: string;
  exportActions: ReactNode;
  cardClassName?: string;
  bodyClassName: string;
  chartRef?: (node: HTMLDivElement | null) => void;
  data: StatisticsPieChartDatum[];
  centerY?: string | number;
  innerRadius?: number | string;
  outerRadius?: number | string;
  showAbsoluteValueLabels: boolean;
  createLabelRenderer: (showAbsoluteValue: boolean) => React.ComponentProps<typeof Pie>['label'];
  formatValue: (value?: number) => string;
  separatorColor: string;
  tooltipContentStyle?: CSSProperties;
  tooltipLabelStyle?: CSSProperties;
  tooltipItemStyle?: CSSProperties;
  legendWrapperStyle?: CSSProperties;
  cellKeyPrefix: string;
}) {
  return (
    <div className={cardClassName} data-pdf-section ref={chartRef}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-viridian">{title}</h3>
        {exportActions}
      </div>
      <div className={bodyClassName}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 12, right: 20, bottom: 30, left: 20 }}>
            <Pie
              dataKey="value"
              data={data}
              nameKey="name"
              cx="50%"
              cy={centerY}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              isAnimationActive={!showAbsoluteValueLabels}
              animationBegin={80}
              animationDuration={700}
              stroke={separatorColor}
              strokeWidth={1.25}
              label={createLabelRenderer(showAbsoluteValueLabels)}
            >
              {data.map((entry, index) => (
                <Cell key={`${cellKeyPrefix}-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              formatter={(value: number, _name: string, entry?: { payload?: { name?: string } }) => [
                formatValue(value),
                entry?.payload?.name || '',
              ]}
            />
            <Legend verticalAlign="bottom" align="center" iconSize={11} wrapperStyle={legendWrapperStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}