import { DataSource, DataSourceOptions } from 'typeorm';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { getDatabaseTlsPolicy } from './security.config';

dotenvConfig();

const postgresSessionOptions = '-c timezone=UTC';

function buildTypeOrmConfig(): DataSourceOptions {
  const dbType = (process.env.DB_TYPE || 'postgres').toLowerCase();
  const migrationsRunEnv = (process.env.DB_MIGRATIONS_RUN ?? '').toLowerCase();
  const synchronize = process.env.DB_SYNCHRONIZE === 'true';
  const migrationsRun =
    migrationsRunEnv === 'true'
      ? true
      : migrationsRunEnv === 'false'
        ? false
        : (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const base = {
    entities: [path.join(__dirname, '/../**/*.entity{.ts,.js}')],
    migrations: [path.join(__dirname, '/../database/migrations/*{.ts,.js}')],
    // TypeORM 1.x rejects null/undefined WHERE values by default. Keep this
    // explicit so accidental unscoped reads or writes cannot become broad queries.
    invalidWhereValuesBehavior: {
      null: 'throw',
      undefined: 'throw',
    },
    // IMPORTANT: TypeORM runs migrations before synchronize().
    // For fresh/bootstrap environments where DB_SYNCHRONIZE=true we must not run migrations,
    // because many migrations assume base tables already exist.
    migrationsRun: synchronize ? false : migrationsRun,
    synchronize,
    logging: process.env.DB_LOGGING === 'true',
  } as const;

  if (dbType === 'sqlite' || dbType === 'better-sqlite3' || dbType === 'sqljs') {
    const cfg: DataSourceOptions = {
      type: 'sqljs',
      autoSave: true,
      location: process.env.DB_DATABASE || path.resolve(process.cwd(), 'stato_dev.sqlite'),
      entities: [...base.entities],
      migrations: [...base.migrations],
      migrationsRun: base.migrationsRun,
      synchronize: base.synchronize,
      logging: base.logging,
      invalidWhereValuesBehavior: base.invalidWhereValuesBehavior,
    };
    return cfg;
  }

  // Default to Postgres
  const { useSsl, rejectUnauthorized } = getDatabaseTlsPolicy();

  const cfg: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'stato_user',
    password: process.env.DB_PASSWORD || 'stato_dev_password',
    database: process.env.DB_DATABASE || 'stato_dev',
    entities: [...base.entities],
    migrations: [...base.migrations],
    migrationsRun: base.migrationsRun,
    synchronize: base.synchronize,
    logging: base.logging,
    invalidWhereValuesBehavior: base.invalidWhereValuesBehavior,
    // Keep Postgres sessions in UTC so legacy `timestamp without time zone`
    // columns stay aligned with the runtime parser in main.ts.
    extra: { options: postgresSessionOptions },
    ...(useSsl ? { ssl: { rejectUnauthorized } } : {}),
  };
  return cfg;
}

export const typeormConfig: DataSourceOptions = buildTypeOrmConfig();

const dataSource = new DataSource(typeormConfig);
export default dataSource;
