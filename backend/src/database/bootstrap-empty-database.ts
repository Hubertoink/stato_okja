import { DataSource, type DataSourceOptions } from 'typeorm';
import { typeormConfig } from '../config/typeorm.config';

const BOOTSTRAP_LOCK_ID = 481516234;
const SYSTEM_TABLES = new Set(['migrations', 'typeorm_metadata']);

type SchemaState = {
  hasUsersTable: boolean;
  applicationTableCount: number;
};

function parseBoolean(value: string | undefined) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function shouldBootstrapEmptyDatabase() {
  const explicitlyEnabled = parseBoolean(process.env.DB_BOOTSTRAP_ON_EMPTY);
  if (typeof explicitlyEnabled === 'boolean') return explicitlyEnabled;

  const environment = String(process.env.NODE_ENV || '').toLowerCase();
  return environment === 'production' || environment === 'staging';
}

function isPostgresDatabase() {
  return String(typeormConfig.type || '').toLowerCase() === 'postgres';
}

function dataSourceOptions(overrides: Partial<DataSourceOptions>): DataSourceOptions {
  return { ...typeormConfig, ...overrides } as DataSourceOptions;
}

async function getSchemaState(dataSource: DataSource): Promise<SchemaState> {
  const rows = await dataSource.query(
    `SELECT
      to_regclass('public.users') IS NOT NULL AS "hasUsersTable",
      COUNT(*) FILTER (
        WHERE table_name <> ALL($1::text[])
      ) AS "applicationTableCount"
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    [Array.from(SYSTEM_TABLES)],
  );
  const row = rows[0] || {};
  return {
    hasUsersTable: row.hasUsersTable === true || row.hasUsersTable === 't',
    applicationTableCount: Number(row.applicationTableCount || 0),
  };
}

async function initializeCurrentSchema() {
  const schemaDataSource = new DataSource(
    dataSourceOptions({
      synchronize: true,
      migrationsRun: false,
      logging: false,
    }),
  );
  try {
    await schemaDataSource.initialize();
  } finally {
    if (schemaDataSource.isInitialized) await schemaDataSource.destroy();
  }
}

async function runMigrations() {
  const migrationDataSource = new DataSource(
    dataSourceOptions({
      synchronize: false,
      migrationsRun: false,
      logging: false,
    }),
  );
  try {
    await migrationDataSource.initialize();
    await migrationDataSource.runMigrations({ transaction: 'all' });
  } finally {
    if (migrationDataSource.isInitialized) await migrationDataSource.destroy();
  }
}

/**
 * Bootstraps only a truly empty PostgreSQL database. Historical StatO migrations
 * extend a pre-existing schema, so a normal migration run alone cannot create a
 * fresh installation. The session-level advisory lock keeps concurrent backend
 * starts from performing this two-phase operation in parallel.
 */
export async function bootstrapEmptyDatabase() {
  if (!shouldBootstrapEmptyDatabase() || !isPostgresDatabase()) return;
  if (process.env.DB_SYNCHRONIZE === 'true') return;

  const probeDataSource = new DataSource(
    dataSourceOptions({
      synchronize: false,
      migrationsRun: false,
      logging: false,
    }),
  );

  try {
    await probeDataSource.initialize();
    await probeDataSource.query('SELECT pg_advisory_lock($1)', [BOOTSTRAP_LOCK_ID]);

    const state = await getSchemaState(probeDataSource);
    if (state.hasUsersTable) return;

    if (state.applicationTableCount > 0) {
      throw new Error(
        'Die Datenbank ist unvollständig: Die Basistabelle "users" fehlt, es existieren aber bereits Anwendungstabellen. Der automatische First-Run wurde aus Sicherheitsgründen nicht ausgeführt.',
      );
    }

    console.log('Leere PostgreSQL-Datenbank erkannt: StatO-Basisschema wird einmalig erstellt.');
    await initializeCurrentSchema();
    await runMigrations();
    console.log('StatO-Basisschema und Datenbankmigrationen wurden erfolgreich initialisiert.');
  } finally {
    if (probeDataSource.isInitialized) {
      try {
        await probeDataSource.query('SELECT pg_advisory_unlock($1)', [BOOTSTRAP_LOCK_ID]);
      } finally {
        await probeDataSource.destroy();
      }
    }
  }
}
