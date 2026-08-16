import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeormConfig } from './config/typeorm.config';
import { getRateLimitOptions } from './config/rate-limit.config';
import { AuthModule } from './auth/auth.module';
import { ActivitiesModule } from './activities/activities.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { StaffModule } from './staff/staff.module';
import { LocationsModule } from './locations/locations.module';
import { StatsModule } from './stats/stats.module';
import { ProjectsModule } from './projects/projects.module';
import { OrgsModule } from './orgs/orgs.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './common/audit.module';
import { UploadsModule } from './uploads/uploads.module';
import { ProjectTemplatesModule } from './project-templates/project-templates.module';
import { DevToolsModule } from './dev-tools/dev-tools.module';
import { SystemDataModule } from './system-data/system-data.module';
import { ThrottlerBehindProxyGuard } from './common/throttler-behind-proxy.guard';
import { HealthController } from './health.controller';
import { LogbookModule } from './logbook/logbook.module';
import { SurveysModule } from './surveys/surveys.module';
import { ProcessesModule } from './processes/processes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: getRateLimitOptions(process.env.RATE_LIMIT_TTL, process.env.RATE_LIMIT_MAX),
      }),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        // Start from shared DataSourceOptions (used by CLI/migrations)
        ...typeormConfig,
        // In Nest runtime under webpack, avoid file globs and auto-load entity classes from feature modules
        entities: [],
        autoLoadEntities: true,
      }),
    }),
    AuthModule,
    ActivitiesModule,
    TaxonomyModule,
    StaffModule,
    LocationsModule,
    StatsModule,
    ProjectsModule,
    ProjectTemplatesModule,
    OrgsModule,
    UsersModule,
    AuditModule,
    UploadsModule,
    DevToolsModule,
    SystemDataModule,
    LogbookModule,
    SurveysModule,
    ProcessesModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
})
export class AppModule {}
