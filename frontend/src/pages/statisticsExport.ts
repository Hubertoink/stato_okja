import { autoT } from '@/i18n/auto';

function sanitizeStatisticsExportSegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildStatisticsExportRangeLabel(from?: string, to?: string) {
  return [from, to].filter(Boolean).join(' bis ') || autoT('ui_38fc1281b47b');
}

export function buildStatisticsChartFileName({
  orgName,
  chartTitle,
  exportRangeLabel,
  extension,
}: {
  orgName?: string | null;
  chartTitle: string;
  exportRangeLabel: string;
  extension: string;
}) {
  const parts = [
    'stato',
    sanitizeStatisticsExportSegment(orgName || autoT('ui_9bf0ba98625e')),
    sanitizeStatisticsExportSegment(chartTitle) || 'diagramm',
    sanitizeStatisticsExportSegment(exportRangeLabel) || 'gesamt',
  ].filter(Boolean);

  return `${parts.join('-')}.${extension}`;
}

export function buildStatisticsActivitiesFileName({
  orgName,
  exportRangeLabel,
  extension,
}: {
  orgName?: string | null;
  exportRangeLabel: string;
  extension: string;
}) {
  const parts = [
    autoT('ui_d606c1241fc1'),
    sanitizeStatisticsExportSegment(orgName || autoT('ui_9bf0ba98625e')),
    autoT('ui_77f2cf89904b'),
    sanitizeStatisticsExportSegment(exportRangeLabel) || 'gesamt',
  ].filter(Boolean);

  return `${parts.join('-')}.${extension}`;
}

export function buildStatisticsControllingFileName({
  orgName,
  exportRangeLabel,
}: {
  orgName?: string | null;
  exportRangeLabel: string;
}) {
  const parts = [
    'stato',
    sanitizeStatisticsExportSegment(orgName || autoT('ui_9bf0ba98625e')),
    'controllingdaten',
    sanitizeStatisticsExportSegment(exportRangeLabel) || 'gesamt',
  ].filter(Boolean);

  return `${parts.join('-')}.xlsx`;
}
