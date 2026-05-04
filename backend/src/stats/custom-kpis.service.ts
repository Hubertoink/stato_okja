import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityExecutionStatus, ActivityType } from '../common/enums';
import {
  CUSTOM_KPI_DATE_MODES,
  CUSTOM_KPI_METRICS,
  CUSTOM_KPI_SURFACES,
  CreateCustomKpiDto,
  UpdateCustomKpiDto,
} from './dto/custom-kpi.dto';
import {
  CustomKpi,
  CustomKpiDateMode,
  CustomKpiFilters,
  CustomKpiMetric,
  CustomKpiSurface,
} from './entities/custom-kpi.entity';
import { StatsService } from './stats.service';

type OrgFilter = { orgId: string | null | undefined; orgIds: string[] | undefined };
type ResultParams = {
  surface?: CustomKpiSurface;
  from?: string;
  to?: string;
};

const VALID_ACTIVITY_TYPES = new Set<string>(Object.values(ActivityType));
const VALID_EXECUTION_STATUSES = new Set<string>(Object.values(ActivityExecutionStatus));

@Injectable()
export class CustomKpisService {
  constructor(
    @InjectRepository(CustomKpi)
    private readonly customKpis: Repository<CustomKpi>,
    private readonly stats: StatsService,
  ) {}

  async list(userId: string) {
    return this.customKpis.find({
      where: { userId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(userId: string, dto: CreateCustomKpiDto) {
    const nextPosition =
      typeof dto.position === 'number'
        ? dto.position
        : await this.customKpis.count({ where: { userId } });
    const entity = this.customKpis.create({
      userId,
      title: this.normalizeTitle(dto.title),
      surface: this.normalizeSurface(dto.surface),
      metric: this.normalizeMetric(dto.metric),
      dateMode: this.normalizeDateMode(dto.dateMode),
      rollingWeeks: this.normalizeRollingWeeks(dto.dateMode, dto.rollingWeeks),
      enabled: dto.enabled !== false,
      backgroundColor: this.normalizeBackgroundColor(dto.backgroundColor),
      position: nextPosition,
      filters: this.normalizeFilters(dto.filters),
    });
    return this.customKpis.save(entity);
  }

  async update(userId: string, id: string, dto: UpdateCustomKpiDto) {
    const entity = await this.customKpis.findOne({ where: { id, userId } });
    if (!entity) throw new NotFoundException('Custom KPI not found');

    if (typeof dto.title === 'string') entity.title = this.normalizeTitle(dto.title);
    if (typeof dto.surface === 'string') entity.surface = this.normalizeSurface(dto.surface);
    if (typeof dto.metric === 'string') entity.metric = this.normalizeMetric(dto.metric);
    if (typeof dto.dateMode === 'string') entity.dateMode = this.normalizeDateMode(dto.dateMode);
    if (typeof dto.rollingWeeks !== 'undefined') {
      entity.rollingWeeks = this.normalizeRollingWeeks(
        dto.dateMode ?? entity.dateMode,
        dto.rollingWeeks,
      );
    }
    if (typeof dto.enabled === 'boolean') entity.enabled = dto.enabled;
    if (typeof dto.backgroundColor === 'string') {
      entity.backgroundColor = this.normalizeBackgroundColor(dto.backgroundColor);
    }
    if (typeof dto.position === 'number') entity.position = dto.position;
    if (typeof dto.filters !== 'undefined') entity.filters = this.normalizeFilters(dto.filters);

    return this.customKpis.save(entity);
  }

  async remove(userId: string, id: string) {
    const result = await this.customKpis.delete({ id, userId });
    if (!result.affected) throw new NotFoundException('Custom KPI not found');
    return { ok: true };
  }

  async getResults(userId: string, orgFilter: OrgFilter, params: ResultParams) {
    const surface =
      params.surface && CUSTOM_KPI_SURFACES.includes(params.surface) ? params.surface : undefined;
    const definitions = (await this.list(userId)).filter((definition) => {
      if (!definition.enabled) return false;
      if (!surface) return true;
      return definition.surface === 'both' || definition.surface === surface;
    });

    const items = await Promise.all(
      definitions.map(async (definition) => {
        const range = this.resolveDateRange(definition, params.from, params.to);
        const filters = this.normalizeFilters(definition.filters);
        const result = await this.stats.calculateCustomKpi({
          metric: definition.metric,
          from: range.from,
          to: range.to,
          orgId: orgFilter.orgId,
          orgIds: orgFilter.orgIds,
          projectId: filters?.projectId,
          type: filters?.type,
          executionStatuses: filters?.executionStatuses,
          weekdays: filters?.weekdays,
        });

        return {
          definition,
          value: result.value,
          unit: result.unit,
          precision: result.precision,
          range,
        };
      }),
    );

    return items;
  }

  private normalizeTitle(value: string) {
    const title = String(value || '').trim();
    if (!title) throw new BadRequestException('KPI title is required');
    return title.slice(0, 120);
  }

  private normalizeSurface(value?: string): CustomKpiSurface {
    if (CUSTOM_KPI_SURFACES.includes(value as CustomKpiSurface)) return value as CustomKpiSurface;
    return 'both';
  }

  private normalizeMetric(value?: string): CustomKpiMetric {
    if (CUSTOM_KPI_METRICS.includes(value as CustomKpiMetric)) return value as CustomKpiMetric;
    throw new BadRequestException('Unsupported KPI metric');
  }

  private normalizeDateMode(value?: string): CustomKpiDateMode {
    if (CUSTOM_KPI_DATE_MODES.includes(value as CustomKpiDateMode))
      return value as CustomKpiDateMode;
    return 'inherit';
  }

  private normalizeRollingWeeks(dateMode?: string, value?: number | null) {
    if (dateMode !== 'rolling_weeks') return null;
    const weeks = Number(value || 4);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 104) {
      throw new BadRequestException('Rolling weeks must be between 1 and 104');
    }
    return weeks;
  }

  private normalizeBackgroundColor(value?: string) {
    const color = String(value || '#ffffff').trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return '#ffffff';
    return color.toLowerCase();
  }

  private normalizeFilters(value?: CustomKpiFilters | null): CustomKpiFilters | null {
    if (!value || typeof value !== 'object') return null;
    const filters: CustomKpiFilters = {};

    if (typeof value.projectId === 'string' && value.projectId.trim()) {
      filters.projectId = value.projectId.trim();
    }

    if (typeof value.type === 'string' && VALID_ACTIVITY_TYPES.has(value.type)) {
      filters.type = value.type;
    }

    if (Array.isArray(value.executionStatuses)) {
      const executionStatuses = Array.from(
        new Set(
          value.executionStatuses.filter((status) => VALID_EXECUTION_STATUSES.has(String(status))),
        ),
      );
      if (executionStatuses.length > 0) filters.executionStatuses = executionStatuses;
    }

    if (!filters.executionStatuses) {
      filters.executionStatuses = [ActivityExecutionStatus.COMPLETED];
    }

    if (Array.isArray(value.weekdays)) {
      const weekdays = Array.from(
        new Set(
          value.weekdays
            .map((weekday) => Number(weekday))
            .filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6),
        ),
      ).sort((left, right) => left - right);
      if (weekdays.length > 0) filters.weekdays = weekdays;
    }

    return filters;
  }

  private resolveDateRange(definition: CustomKpi, inheritedFrom?: string, inheritedTo?: string) {
    const today = new Date();
    const toDateString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (definition.dateMode === 'current_month') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toDateString(from), to: toDateString(to) };
    }

    if (definition.dateMode === 'current_year') {
      return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
    }

    if (definition.dateMode === 'rolling_weeks') {
      const weeks = definition.rollingWeeks || 4;
      const from = new Date(today);
      from.setDate(today.getDate() - weeks * 7 + 1);
      return { from: toDateString(from), to: toDateString(today) };
    }

    return { from: inheritedFrom, to: inheritedTo };
  }
}
