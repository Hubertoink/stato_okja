import { getCurrentIntlLocale } from '@/i18n/formatters';
import { useTranslation } from 'react-i18next';

type ExportRow = { name: string; value: number; color?: string };

export function ChartExportData({
  rows,
  valueLabel,
  bars = false,
  percentages = false,
}: {
  rows: ExportRow[];
  valueLabel: string;
  bars?: boolean;
  percentages?: boolean;
}) {
  const { t } = useTranslation();
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  const format = (value: number) =>
    value.toLocaleString(getCurrentIntlLocale(), { maximumFractionDigits: 1 });

  return (
    <div data-export-only="true" style={{ display: 'none', marginTop: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, width: bars ? '42%' : '60%' }}>{t('chartExport.name')}</th>
            {bars && <th style={{ width: '30%', padding: 8 }} aria-label={t('chartExport.bar')} />}
            <th style={{ textAlign: 'right', padding: 8 }}>{valueLabel}</th>
            {percentages && <th style={{ textAlign: 'right', padding: 8 }}> {t('chartExport.share')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td style={{ padding: 8, borderTop: '1px solid #cbd5e1', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
                {percentages && row.color && (
                  <span
                    data-export-preserve-background="true"
                    style={{ display: 'inline-block', width: 10, height: 10, marginRight: 8, backgroundColor: row.color }}
                  />
                )}
                {row.name}
              </td>
              {bars && (
                <td style={{ padding: 8, borderTop: '1px solid #cbd5e1' }}>
                  <div
                    data-export-preserve-background="true"
                    style={{ width: `${Math.max(0, row.value / maximum * 100)}%`, height: 14, backgroundColor: row.color || '#0f766e' }}
                  />
                </td>
              )}
              <td style={{ padding: 8, borderTop: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600, overflowWrap: 'anywhere' }}>
                {format(row.value)}
              </td>
              {percentages && (
                <td style={{ padding: 8, borderTop: '1px solid #cbd5e1', textAlign: 'right' }}>
                  {format(total > 0 ? row.value / total * 100 : 0)} %
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={2 + Number(bars) + Number(percentages)} style={{ padding: 8 }}>{t('chartExport.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
