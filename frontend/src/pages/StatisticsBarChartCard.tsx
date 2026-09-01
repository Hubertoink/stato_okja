import { useId } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEmbeddedImageSrc } from '@/components/ProtectedImage';
import { getCurrentIntlLocale } from '@/i18n/formatters';

type StatisticsBarChartDatum = {
  name: string;
};

type ImageBarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  index?: number;
  payload?: StatisticsBarChartDatum;
  getImageUrl?: (item: StatisticsBarChartDatum, index: number) => string | null | undefined;
};

function ImageBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
  index = 0,
  payload,
  getImageUrl,
}: ImageBarShapeProps) {
  const imageUrl = payload ? getImageUrl?.(payload, index) : undefined;
  const embeddedImageUrl = useEmbeddedImageSrc(imageUrl);
  const clipId = useId();

  if (width <= 0 || height <= 0) return null;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
      {embeddedImageUrl ? (
        <image
          x={x}
          y={y}
          width={width}
          height={height}
          href={embeddedImageUrl}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          opacity={0.78}
        />
      ) : null}
    </g>
  );
}

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
  getCellImageUrl,
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
  tooltipFormatter?: (
    value: number,
    name?: string,
    entry?: { payload?: T },
  ) => string | [string, string];
  tooltipLabelFormatter?: (label: string | number, payload?: Array<{ payload?: T }>) => string;
  barDataKey: string;
  labelDataKey: string;
  barName: string;
  barFill?: string;
  valueLabelContent: ReactElement;
  getCellFill?: (item: T, index: number) => string;
  getCellKey?: (item: T, index: number) => string;
  getCellImageUrl?: (item: T, index: number) => string | null | undefined;
}) {
  return (
    <div className={`statistics-chart-card ${cardClassName}`} data-pdf-section ref={chartRef}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="statistics-chart-title text-lg font-semibold text-viridian">{title}</h3>
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
                  : Number(value).toLocaleString(getCurrentIntlLocale())
              }
              labelFormatter={
                tooltipLabelFormatter
                  ? (label, payload) =>
                      tooltipLabelFormatter(label, payload as Array<{ payload?: T }>)
                  : undefined
              }
            />
            <Bar
              dataKey={barDataKey}
              name={barName}
              fill={barFill}
              shape={
                getCellImageUrl ? (
                  <ImageBarShape
                    getImageUrl={getCellImageUrl as ImageBarShapeProps['getImageUrl']}
                  />
                ) : undefined
              }
            >
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
