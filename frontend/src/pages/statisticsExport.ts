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
  return [from, to].filter(Boolean).join(' bis ') || 'Gesamter Zeitraum';
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
    sanitizeStatisticsExportSegment(orgName || 'organisation'),
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
    'stato',
    sanitizeStatisticsExportSegment(orgName || 'organisation'),
    'aktivitaeten-gefiltert',
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
    sanitizeStatisticsExportSegment(orgName || 'organisation'),
    'controllingdaten',
    sanitizeStatisticsExportSegment(exportRangeLabel) || 'gesamt',
  ].filter(Boolean);

  return `${parts.join('-')}.xlsx`;
}
