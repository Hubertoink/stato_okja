import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { resolveOrgScope, type OrgScopedUser } from '../auth/org-scope-access';
import { OrgsService } from '../orgs/orgs.service';
import { CreateProcessDto, UpdateProcessDto } from './dto/process.dto';
import { Process, type ProcessDefinition } from './entities/process.entity';

type ProcessActor = OrgScopedUser & { id?: string; name?: string | null };

const emptyDefinition = (): ProcessDefinition => ({ schemaVersion: 1, nodes: [], edges: [] });

/**
 * Global deployment switch for ProcessO. It is intentionally evaluated at
 * request time so a container restart with a changed environment is enough to
 * disable the workspace regardless of individual organisation settings.
 */
export function isProcessesFeatureEnabled(value = process.env.ENABLE_PROCESSES): boolean {
  return !['0', 'false', 'no', 'off'].includes(value?.trim().toLowerCase() || 'true');
}

@Injectable()
export class ProcessesService {
  constructor(
    @InjectRepository(Process) private readonly processes: Repository<Process>,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  private canWrite(actor: ProcessActor) {
    return actor.role === 'superadmin' || actor.role === 'org_admin' || actor.role === 'editor';
  }

  private async requireEnabledScope(actor: ProcessActor) {
    const orgId = resolveOrgScope(actor);
    if (!isProcessesFeatureEnabled() || !orgId || !(await this.orgs.isProcessesEnabled(orgId))) {
      throw new ForbiddenException('ProzessO ist für diese Organisation nicht freigeschaltet.');
    }
    return orgId;
  }

  private validateDefinition(definition: ProcessDefinition) {
    if (definition.schemaVersion !== 1) {
      throw new BadRequestException('Nicht unterstützte Prozessdefinition.');
    }
    const nodeIds = new Set<string>();
    for (const node of definition.nodes) {
      if (nodeIds.has(node.id)) throw new BadRequestException('Knoten-IDs müssen eindeutig sein.');
      nodeIds.add(node.id);
    }
    const edgeIds = new Set<string>();
    for (const edge of definition.edges) {
      if (edgeIds.has(edge.id)) throw new BadRequestException('Kanten-IDs müssen eindeutig sein.');
      edgeIds.add(edge.id);
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new BadRequestException('Kanten dürfen nur vorhandene Knoten verbinden.');
      }
    }
  }

  async access(actor: ProcessActor) {
    const orgId = resolveOrgScope(actor);
    const enabled = isProcessesFeatureEnabled() && await this.orgs.isProcessesEnabled(orgId);
    return { enabled, canEdit: enabled && this.canWrite(actor), orgId };
  }

  async list(actor: ProcessActor) {
    const orgId = await this.requireEnabledScope(actor);
    return this.processes.find({ where: { orgId }, order: { updatedAt: 'DESC', title: 'ASC' } });
  }

  async create(dto: CreateProcessDto, actor: ProcessActor) {
    if (!this.canWrite(actor)) throw new ForbiddenException('Keine Berechtigung zum Anlegen von Prozessen.');
    const orgId = await this.requireEnabledScope(actor);
    const definition = (dto.definition || emptyDefinition()) as ProcessDefinition;
    this.validateDefinition(definition);
    const created = await this.processes.save(this.processes.create({
      orgId,
      title: dto.title.trim(),
      purpose: dto.purpose?.trim() || null,
      definition,
      createdByUserId: actor.id || null,
    }));
    await this.audit.log({
      action: AuditAction.CREATE,
      entityType: 'process',
      entityId: created.id,
      entityTitle: created.title,
      orgId,
      user: actor,
    });
    return created;
  }

  async update(id: string, dto: UpdateProcessDto, actor: ProcessActor) {
    if (!this.canWrite(actor)) throw new ForbiddenException('Keine Berechtigung zum Bearbeiten von Prozessen.');
    const orgId = await this.requireEnabledScope(actor);
    const process = await this.processes.findOne({ where: { id, orgId } });
    if (!process) throw new NotFoundException('Prozess nicht gefunden.');
    if (typeof dto.title !== 'undefined') process.title = dto.title.trim();
    if (typeof dto.purpose !== 'undefined') process.purpose = dto.purpose?.trim() || null;
    if (dto.definition) {
      this.validateDefinition(dto.definition as ProcessDefinition);
      process.definition = dto.definition as ProcessDefinition;
    }
    const saved = await this.processes.save(process);
    await this.audit.log({
      action: AuditAction.UPDATE,
      entityType: 'process',
      entityId: saved.id,
      entityTitle: saved.title,
      orgId,
      user: actor,
    });
    return saved;
  }

  async remove(id: string, actor: ProcessActor) {
    if (!this.canWrite(actor)) throw new ForbiddenException('Keine Berechtigung zum Löschen von Prozessen.');
    const orgId = await this.requireEnabledScope(actor);
    const process = await this.processes.findOne({ where: { id, orgId } });
    if (!process) throw new NotFoundException('Prozess nicht gefunden.');
    await this.processes.delete(process.id);
    await this.audit.log({
      action: AuditAction.DELETE,
      entityType: 'process',
      entityId: process.id,
      entityTitle: process.title,
      orgId,
      user: actor,
    });
    return { ok: true };
  }
}
