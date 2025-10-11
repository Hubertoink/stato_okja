import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeormConfig } from './config/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { ActivitiesModule } from './activities/activities.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { StaffModule } from './staff/staff.module';
import { LocationsModule } from './locations/locations.module';
import { StatsModule } from './stats/stats.module';
import { ProjectsModule } from './projects/projects.module';
import { UploadsModule } from './uploads/uploads.module';
import { OrgsModule } from './orgs/orgs.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
    UploadsModule,
    OrgsModule,
    UsersModule,
  ],
})
export class AppModule {}
