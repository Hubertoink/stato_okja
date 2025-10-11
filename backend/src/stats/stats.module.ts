import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { Activity } from '../activities/entities/activity.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Category } from '../taxonomy/entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Cohort, Category])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
