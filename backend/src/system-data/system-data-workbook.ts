import * as XLSX from 'xlsx';

type Row = Record<string, unknown>;
type TableRows = Record<string, Row[]>;
type SheetRow = Record<string, string | number | boolean | null>;

type WorkbookInput = {
  generatedAt: string;
  actor: { id: string; name: string | null; role: string };
  tableRows: TableRows;
  tableCounts: Array<{ tableName: string; rowCount: number }>;
  uploads: {
    fileCount: number;
    totalBytes: number;
    files: Array<{ path: string; size: number }>;
    warnings: string[];
  };
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  open_door: 'Offener Treff',
  project_open: 'Offenes Projekt',
  project_closed: 'Geschlossene Gruppe',
  event: 'Veranstaltung',
  outreach: 'Aufsuchende Arbeit',
};

const USER_ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  org_admin: 'Admin',
  user: 'Benutzer',
};

const STAFF_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  lead: 'Leitung',
  employee: 'Mitarbeit',
  volunteer: 'Ehrenamt',
  helper: 'Hilfskraft',
  analyst: 'Analyse',
};

export function buildReadableWorkbook(input: WorkbookInput): {
  buffer: Buffer;
  sheetNames: string[];
} {
  const workbook = XLSX.utils.book_new();
  const sheetNames: string[] = [];

  const organizations = getRows(input.tableRows, 'organizations');
  const users = getRows(input.tableRows, 'users');
  const staff = getRows(input.tableRows, 'staff');
  const locations = getRows(input.tableRows, 'locations');
  const categories = getRows(input.tableRows, 'categories');
  const tags = getRows(input.tableRows, 'tags');
  const cohorts = getRows(input.tableRows, 'cohorts');
  const projects = getRows(input.tableRows, 'projects');
  const activities = getRows(input.tableRows, 'activities');
  const attachments = getRows(input.tableRows, 'attachments');
  const auditLogs = getRows(input.tableRows, 'audit_logs');
  const projectTemplates = getRows(input.tableRows, 'project_templates');
  const activityAcks = getRows(input.tableRows, 'activity_acks');

  const orgById = buildLookup(organizations);
  const userById = buildLookup(users);
  const staffById = buildLookup(staff);
  const locationById = buildLookup(locations);
  const categoryById = buildLookup(categories);
  const tagById = buildLookup(tags);
  const cohortById = buildLookup(cohorts);
  const projectById = buildLookup(projects);
  const activityById = buildLookup(activities);

  const activityCategoryMap = buildJoinMap(getRows(input.tableRows, 'activity_categories'), 'activityId', 'categoryId');
  const activityTagMap = buildJoinMap(getRows(input.tableRows, 'activity_tags'), 'activityId', 'tagId');
  const activityStaffMap = buildJoinMap(getRows(input.tableRows, 'activity_staff'), 'activityId', 'staffId');
  const projectCategoryMap = buildJoinMap(getRows(input.tableRows, 'project_categories'), 'projectId', 'categoryId');

  addSheet(workbook, sheetNames, 'Uebersicht', [
    { Bereich: 'Export', Kennzahl: 'Exportiert am', Wert: formatDateTime(input.generatedAt) },
    { Bereich: 'Export', Kennzahl: 'Exportiert von', Wert: input.actor.name || input.actor.id },
    { Bereich: 'Export', Kennzahl: 'Rolle', Wert: USER_ROLE_LABELS[input.actor.role] || input.actor.role },
    { Bereich: 'Daten', Kennzahl: 'Verwaltete Tabellen', Wert: input.tableCounts.length },
    { Bereich: 'Daten', Kennzahl: 'Gesamte Datenzeilen', Wert: input.tableCounts.reduce((sum, row) => sum + row.rowCount, 0) },
    { Bereich: 'Uploads', Kennzahl: 'Dateien', Wert: input.uploads.fileCount },
    { Bereich: 'Uploads', Kennzahl: 'Speicher', Wert: formatBytes(input.uploads.totalBytes) },
    { Bereich: 'Hinweise', Kennzahl: 'Upload-Warnungen', Wert: input.uploads.warnings.join(' | ') || 'Keine' },
  ]);

  addSheet(
    workbook,
    sheetNames,
    'Tabellen',
    input.tableCounts
      .slice()
      .sort((left, right) => right.rowCount - left.rowCount)
      .map((row) => ({ Tabelle: row.tableName, Zeilen: row.rowCount })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Organisationen',
    organizations.map((row) => ({
      Organisation: valueOrEmpty(row.name),
      Elternorganisation: getName(orgById, row.parentId),
      Oeffnungszeiten: hasValue(row.openingHours) ? 'Ja' : 'Nein',
      'Taxonomie-Regeln': hasValue(row.taxonomySettings) ? 'Ja' : 'Nein',
      'Kind-Defaults': hasValue(row.childTaxonomyDefaults) ? 'Ja' : 'Nein',
    })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Benutzer',
    users.map((row) => ({
      Name: valueOrEmpty(row.name),
      'E-Mail': valueOrEmpty(row.email),
      Rolle: USER_ROLE_LABELS[stringValue(row.role)] || valueOrEmpty(row.role),
      Organisation: getOrganizationLabel(orgById, row.orgId),
      Theme: valueOrEmpty(row.theme),
      Passwortwechsel: booleanLabel(row.mustChangePassword),
      'Login-Sperre': formatDateTime(row.lockoutUntil),
    })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Mitarbeitende',
    staff.map((row) => ({
      Name: valueOrEmpty(row.name),
      'E-Mail': valueOrEmpty(row.email),
      Rolle: STAFF_ROLE_LABELS[stringValue(row.role)] || valueOrEmpty(row.role),
      Aktiv: booleanLabel(row.active),
      Organisation: getOrganizationLabel(orgById, row.orgId),
      Telefon: valueOrEmpty(row.phone),
      Notizen: valueOrEmpty(row.notes),
      'Letzter Login': formatDateTime(row.lastLogin),
    })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Orte',
    locations.map((row) => ({
      Ort: valueOrEmpty(row.name),
      Organisation: getOrganizationLabel(orgById, row.orgId),
      Typ: valueOrEmpty(row.roomType),
      Adresse: valueOrEmpty(row.address),
      Aktiv: booleanLabel(row.active),
      Beschreibung: valueOrEmpty(row.description),
    })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Kategorien',
    categories.map((row) => ({
      Kategorie: valueOrEmpty(row.name),
      Organisation: getOrganizationLabel(orgById, row.orgId),
      Aktiv: booleanLabel(row.active),
      Farbe: valueOrEmpty(row.color),
      Referenz: valueOrEmpty(row.standardRef),
      Beschreibung: valueOrEmpty(row.description),
    })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Tags',
    tags.map((row) => ({
      Tag: valueOrEmpty(row.name),
      Organisation: getOrganizationLabel(orgById, row.orgId),
      Aktiv: booleanLabel(row.active),
      Farbe: valueOrEmpty(row.color),
      Synonyme: arrayToText(row.synonyms),
      Beschreibung: valueOrEmpty(row.description),
    })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Kohorten',
    cohorts.map((row) => ({
      Kohorte: valueOrEmpty(row.name),
      Organisation: getOrganizationLabel(orgById, row.orgId),
      'Alter von': numberOrEmpty(row.minAge),
      'Alter bis': numberOrEmpty(row.maxAge),
      Aktiv: booleanLabel(row.active),
      Sortierung: numberOrEmpty(row.sortOrder),
      'An Kinder vererben': booleanLabel(row.inheritToChildren),
    })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Projekte',
    projects.map((row) => {
      const categoryNames = uniqueText([
        getName(categoryById, row.categoryId),
        ...getNames(projectCategoryMap.get(stringValue(row.id)), categoryById),
      ]);

      return {
        Projekt: valueOrEmpty(row.title),
        Organisation: getOrganizationLabel(orgById, row.orgId),
        Typ: ACTIVITY_TYPE_LABELS[stringValue(row.type)] || valueOrEmpty(row.type),
        Kategorien: categoryNames.join(', '),
        Zielgruppe: valueOrEmpty(row.targetGroup),
        Tag: valueOrEmpty(row.tag),
        Tätigkeitsfeld: valueOrEmpty(row.activityField),
        Farbe: valueOrEmpty(row.color),
        'Von Datum': formatDate(row.dateFrom),
        'Bis Datum': formatDate(row.dateTo),
        'Start Standard': valueOrEmpty(row.defaultStartTime),
        'Ende Standard': valueOrEmpty(row.defaultEndTime),
        Archiviert: booleanLabel(row.archived),
        Bild: booleanLabel(hasValue(row.imageUrl)),
        Beschreibung: valueOrEmpty(row.description),
      };
    }),
  );

  addSheet(
    workbook,
    sheetNames,
    'Aktivitaeten',
    activities.map((row) => ({
      Datum: formatDate(row.date),
      Start: valueOrEmpty(row.startTime),
      Ende: valueOrEmpty(row.endTime),
      'Dauer (Min.)': numberOrEmpty(row.durationMinutes),
      Organisation: getOrganizationLabel(orgById, row.orgId),
      Typ: ACTIVITY_TYPE_LABELS[stringValue(row.type)] || valueOrEmpty(row.type),
      Titel: valueOrEmpty(row.title),
      Projekt: getName(projectById, row.projectId),
      Ort: getName(locationById, row.locationId),
      Kategorien: getNames(activityCategoryMap.get(stringValue(row.id)), categoryById).join(', '),
      Tags: getNames(activityTagMap.get(stringValue(row.id)), tagById).join(', '),
      Mitarbeitende: getNames(activityStaffMap.get(stringValue(row.id)), staffById).join(', '),
      'Teilnehmende gesamt': numberOrEmpty(row.countTotal),
      Männlich: numberOrEmpty(row.countMale),
      Weiblich: numberOrEmpty(row.countFemale),
      Divers: numberOrEmpty(row.countDiverse),
      Kohorten: formatActivityCohorts(row.cohorts, cohortById),
      Notizen: valueOrEmpty(row.notes),
      Dokumentation: valueOrEmpty(row.goals),
      Erledigt: booleanLabel(row.ackDone),
      'Erstellt von': getName(staffById, row.createdById),
      'Aktualisiert von': getName(staffById, row.updatedById),
      Erstellt: formatDateTime(row.createdAt),
      Aktualisiert: formatDateTime(row.updatedAt),
    })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Vorlagen',
    projectTemplates.map((row) => ({
      Vorlage: valueOrEmpty(row.title),
      Organisation: getOrganizationLabel(orgById, row.orgId),
      Typ: ACTIVITY_TYPE_LABELS[stringValue(row.type)] || valueOrEmpty(row.type),
      Zielgruppe: valueOrEmpty(row.targetGroup),
      Kategorie: valueOrEmpty(row.categoryName),
      'Kategorie-Farbe': valueOrEmpty(row.categoryColor),
      Tags: valueOrEmpty(row.tags),
      Farbe: valueOrEmpty(row.color),
      Archiviert: booleanLabel(row.archived),
      Bild: booleanLabel(hasValue(row.imageUrl)),
      Beschreibung: valueOrEmpty(row.description),
      Erstellt: formatDateTime(row.createdAt),
      Aktualisiert: formatDateTime(row.updatedAt),
    })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Bestaetigungen',
    activityAcks.map((row) => {
      const activity = activityById.get(stringValue(row.activityId));
      return {
        Benutzer: getName(userById, row.userId),
        Aktivitaet: activity ? valueOrEmpty(activity.title) || `${formatDate(activity.date)} ${ACTIVITY_TYPE_LABELS[stringValue(activity.type)] || valueOrEmpty(activity.type)}` : '',
        Datum: activity ? formatDate(activity.date) : '',
        Organisation: getOrganizationLabel(orgById, row.orgId ?? activity?.orgId),
        Erledigt: booleanLabel(row.done),
        Erstellt: formatDateTime(row.createdAt),
        Aktualisiert: formatDateTime(row.updatedAt),
      };
    }),
  );

  addSheet(
    workbook,
    sheetNames,
    'Anhaenge',
    attachments.map((row) => {
      const activity = activityById.get(stringValue(row.activityId));
      return {
        Datei: valueOrEmpty(row.filename),
        Aktivitaet: activity ? valueOrEmpty(activity.title) || `${formatDate(activity.date)} ${ACTIVITY_TYPE_LABELS[stringValue(activity.type)] || valueOrEmpty(activity.type)}` : '',
        Datum: activity ? formatDate(activity.date) : '',
        Projekt: activity ? getName(projectById, activity.projectId) : '',
        Organisation: getOrganizationLabel(orgById, activity?.orgId),
        'Mime-Type': valueOrEmpty(row.mimeType),
        'Groesse (KB)': sizeInKb(row.size),
        Speicher: valueOrEmpty(row.storageRef),
        URL: valueOrEmpty(row.url),
        Erstellt: formatDateTime(row.createdAt),
      };
    }),
  );

  addSheet(
    workbook,
    sheetNames,
    'Uploads',
    input.uploads.files.map((file) => ({
      Pfad: file.path,
      'Groesse (KB)': sizeInKb(file.size),
    })),
  );

  addSheet(
    workbook,
    sheetNames,
    'Audit',
    auditLogs.map((row) => ({
      Zeitpunkt: formatDateTime(row.createdAt),
      Aktion: valueOrEmpty(row.action),
      Entitaet: valueOrEmpty(row.entityType),
      Titel: valueOrEmpty(row.entityTitle),
      Benutzer: valueOrEmpty(row.userName),
      Organisation: getOrganizationLabel(orgById, row.orgId),
      Unterschiede: objectToText(row.diff),
      Details: objectToText(row.details),
    })),
  );

  return {
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
    sheetNames,
  };
}

function getRows(tableRows: TableRows, key: string): Row[] {
  return Array.isArray(tableRows[key]) ? tableRows[key] : [];
}

function buildLookup(rows: Row[]) {
  const lookup = new Map<string, Row>();
  for (const row of rows) {
    const id = stringValue(row.id);
    if (id) lookup.set(id, row);
  }
  return lookup;
}

function buildJoinMap(rows: Row[], leftKey: string, rightKey: string) {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const left = stringValue(row[leftKey]);
    const right = stringValue(row[rightKey]);
    if (!left || !right) continue;
    const values = map.get(left) || [];
    values.push(right);
    map.set(left, values);
  }
  return map;
}

function addSheet(
  workbook: XLSX.WorkBook,
  sheetNames: string[],
  sheetName: string,
  rows: SheetRow[],
) {
  const safeName = getSafeSheetName(sheetName, sheetNames);
  const normalizedRows = rows.length > 0 ? rows : [{ Hinweis: 'Keine Daten vorhanden' }];
  const worksheet = XLSX.utils.json_to_sheet(normalizedRows);
  worksheet['!cols'] = computeColumnWidths(normalizedRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  sheetNames.push(safeName);
}

function getSafeSheetName(name: string, existing: string[]) {
  const sanitized = name.replace(/[\\/*?:\[\]]/g, ' ').trim() || 'Tabelle';
  let candidate = sanitized.slice(0, 31);
  let index = 2;
  while (existing.includes(candidate)) {
    const suffix = ` ${index}`;
    candidate = `${sanitized.slice(0, Math.max(0, 31 - suffix.length))}${suffix}`;
    index += 1;
  }
  return candidate;
}

function computeColumnWidths(rows: SheetRow[]) {
  const columns = Array.from(
    rows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>()),
  );

  return columns.map((column) => {
    const contentWidth = Math.max(
      column.length,
      ...rows.map((row) => stringifyCell(row[column]).length),
    );
    return { wch: Math.min(Math.max(contentWidth + 2, 12), 48) };
  });
}

function stringifyCell(value: unknown) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value);
}

function stringValue(value: unknown) {
  return value === null || typeof value === 'undefined' ? '' : String(value);
}

function valueOrEmpty(value: unknown) {
  return stringValue(value);
}

function numberOrEmpty(value: unknown) {
  if (value === null || typeof value === 'undefined' || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : stringValue(value);
}

function booleanLabel(value: unknown) {
  return value === true || String(value).toLowerCase() === 'true' ? 'Ja' : 'Nein';
}

function formatDate(value: unknown) {
  if (!hasValue(value)) return '';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return stringValue(value);
  return parsed.toLocaleDateString('de-DE', { timeZone: 'UTC' });
}

function formatDateTime(value: unknown) {
  if (!hasValue(value)) return '';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return stringValue(value);
  return parsed.toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  });
}

function hasValue(value: unknown) {
  return value !== null && typeof value !== 'undefined' && String(value).trim() !== '';
}

function getName(lookup: Map<string, Row>, idValue: unknown) {
  const entry = lookup.get(stringValue(idValue));
  if (!entry) return '';
  return valueOrEmpty(entry.name || entry.title || entry.email);
}

function getNames(ids: string[] | undefined, lookup: Map<string, Row>) {
  return uniqueText((ids || []).map((id) => getName(lookup, id)));
}

function getOrganizationLabel(lookup: Map<string, Row>, orgId: unknown) {
  if (!hasValue(orgId)) return 'Global / keine Organisation';
  return getName(lookup, orgId);
}

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value || '').trim()).filter(Boolean)));
}

function arrayToText(value: unknown) {
  if (!hasValue(value)) return '';
  if (Array.isArray(value)) return uniqueText(value.map((entry) => stringValue(entry))).join(', ');
  if (typeof value === 'string') {
    return uniqueText(value.split(',').map((entry) => entry.trim())).join(', ');
  }
  return stringValue(value);
}

function objectToText(value: unknown) {
  if (!hasValue(value)) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  const raw = stringValue(value);
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function formatActivityCohorts(value: unknown, cohortById: Map<string, Row>) {
  if (!hasValue(value)) return '';
  const rows = parseCohortRows(value);
  return rows
    .map((row) => {
      const cohortName = getName(cohortById, row.cohortId) || row.cohortId;
      return `${cohortName} (m:${row.m}, w:${row.w}, d:${row.d})`;
    })
    .join(' | ');
}

function parseCohortRows(value: unknown): Array<{ cohortId: string; m: number; w: number; d: number }> {
  if (Array.isArray(value)) {
    return value.map((entry) => ({
      cohortId: stringValue((entry as Record<string, unknown>).cohortId),
      m: Number((entry as Record<string, unknown>).m || 0),
      w: Number((entry as Record<string, unknown>).w || 0),
      d: Number((entry as Record<string, unknown>).d || 0),
    }));
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseCohortRows(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

function sizeInKb(value: unknown) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return Math.round((bytes / 1024) * 10) / 10;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}