import { DataSource, DataSourceOptions } from 'typeorm';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';

dotenvConfig();

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
    };
    return cfg;
  }

  // Default to Postgres
  const sslEnv = (process.env.DB_SSL || '').toLowerCase();
  const useSsl = sslEnv === 'true' || sslEnv === 'require' || sslEnv === '1';
  const rejectUnauthorized = (process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';

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
    ...(useSsl ? { ssl: { rejectUnauthorized } } : {}),
  };
  return cfg;
}

export const typeormConfig: DataSourceOptions = buildTypeOrmConfig();

const dataSource = new DataSource(typeormConfig);
export default dataSource;
