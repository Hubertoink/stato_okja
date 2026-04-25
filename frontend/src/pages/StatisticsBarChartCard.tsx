import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type StatisticsBarChartDatum = {
  name: string;
};

type StatisticsBarChartMargin = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export function StatisticsBarChartCard<T extends StatisticsBarChartDatum>({
  title,
  exportActions,
  chartRef,
  data,
  bodyClassName,
  cardClassName = 'group/chart-card bg-white rounded-lg shadow p-3 md:p-6',
  margin,
  gridStroke,
  axisTick,
  xAxisHeight,
  yAxisAllowDecimals,
  tooltipContentStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  tooltipCursor,
  tooltipFormatter,
  tooltipLabelFormatter,
  barDataKey,
  labelDataKey,
  barName,
  barFill,
  valueLabelContent,
  getCellFill,
  getCellKey,
}: {
  title: string;
  exportActions: ReactNode;
  chartRef?: (node: HTMLDivElement | null) => void;
  data: T[];
  bodyClassName: string;
  cardClassName?: string;
  margin?: StatisticsBarChartMargin;
  gridStroke: string;
  axisTick?: object;
  xAxisHeight: number;
  yAxisAllowDecimals: boolean;
  tooltipContentStyle?: CSSProperties;
  tooltipLabelStyle?: CSSProperties;
  tooltipItemStyle?: CSSProperties;
  tooltipCursor?: object;
  tooltipFormatter?: (value: number, name?: string, entry?: { payload?: T }) => string | [string, string];
  tooltipLabelFormatter?: (label: string | number, payload?: Array<{ payload?: T }>) => string;
  barDataKey: string;
  labelDataKey: string;
  barName: string;
  barFill?: string;
  valueLabelContent: ReactElement;
  getCellFill?: (item: T, index: number) => string;
  getCellKey?: (item: T, index: number) => string;
}) {
  return (
    <div className={cardClassName} data-pdf-section ref={chartRef}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-viridian">{title}</h3>
        {exportActions}
      </div>
      <div className={bodyClassName}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={margin}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={axisTick}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={xAxisHeight}
            />
            <YAxis allowDecimals={yAxisAllowDecimals} tick={axisTick} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              cursor={tooltipCursor}
              formatter={(value, name, entry) =>
                tooltipFormatter
                  ? tooltipFormatter(Number(value), String(name), entry as { payload?: T })
                  : Number(value).toLocaleString('de-DE')
              }
              labelFormatter={
                tooltipLabelFormatter
                  ? (label, payload) => tooltipLabelFormatter(label, payload as Array<{ payload?: T }>)
                  : undefined
              }
            />
            <Bar dataKey={barDataKey} name={barName} fill={barFill}>
              {getCellFill
                ? data.map((item, index) => (
                    <Cell
                      key={getCellKey ? getCellKey(item, index) : `bar-cell-${index}`}
                      fill={getCellFill(item, index)}
                    />
                  ))
                : null}
              <LabelList dataKey={labelDataKey} content={valueLabelContent} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}