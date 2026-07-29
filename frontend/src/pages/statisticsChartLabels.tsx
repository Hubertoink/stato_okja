import { getCurrentIntlLocale } from '@/i18n/formatters';
type BarLabelProps = { x?: number; y?: number; width?: number; value?: number | string };
type LineLabelProps = { x?: number; y?: number; value?: number | string };
type PieLabelProps = {
  cx?: number;
  x?: number;
  y?: number;
  percent?: number;
  value?: number;
  payload?: { color?: string };
};

function formatChartValue(value?: number | string) {
  return typeof value === 'number'
    ? value.toLocaleString(getCurrentIntlLocale(), { maximumFractionDigits: 1 })
    : String(value ?? '');
}

export function createPieValueLabelRenderer({
  showAbsoluteValue,
  fallbackColor,
  strokeColor,
  formatNumber,
}: {
  showAbsoluteValue: boolean;
  fallbackColor: string;
  strokeColor: string;
  formatNumber: (value?: number) => string;
}) {
  return function PieValueLabel(props: PieLabelProps) {
    const { cx, x, y, percent, value, payload } = props;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof percent !== 'number') return null;
    if (percent <= 0) return null;

    const textAnchor = typeof cx === 'number' && x < cx ? 'end' : 'start';
    const labelColor = payload?.color || fallbackColor;
    const percentageText = `${(percent * 100).toLocaleString(getCurrentIntlLocale(), { maximumFractionDigits: 1 })} %`;

    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill={labelColor}
        stroke={strokeColor}
        strokeWidth={2}
        paintOrder="stroke"
        fontWeight={600}
      >
        <tspan x={x} dy="0" fontSize={12}>
          {percentageText}
        </tspan>
        {showAbsoluteValue && (
          <tspan x={x} dy="1.15em" fontSize={10}>
            {formatNumber(value)}
          </tspan>
        )}
      </text>
    );
  };
}

export function createBarValueLabelRenderer({
  fillColor,
  strokeColor,
}: {
  fillColor: string;
  strokeColor: string;
}) {
  return function BarValueLabel(props: BarLabelProps) {
    const { x, y, width, value } = props;
    const text = formatChartValue(value);
    const centerX = (x ?? 0) + (width ?? 0) / 2;
    const centerY = (y ?? 0) - 4;

    return (
      <text
        x={centerX}
        y={centerY}
        textAnchor="middle"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        paintOrder="stroke"
        fontSize={12}
        fontWeight={600}
      >
        {text}
      </text>
    );
  };
}

export function createLineValueLabelRenderer({
  fillColor,
  strokeColor,
}: {
  fillColor: string;
  strokeColor: string;
}) {
  return function LineValueLabel(props: LineLabelProps) {
    const { x, y, value } = props;
    if (typeof x !== 'number' || typeof y !== 'number') return null;

    return (
      <text
        x={x}
        y={y - 12}
        textAnchor="middle"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        paintOrder="stroke"
        fontSize={12}
        fontWeight={600}
      >
        {formatChartValue(value)}
      </text>
    );
  };
}