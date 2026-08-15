import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrgsService } from '../orgs/orgs.service';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toPublicUser } from '../common/public-response';

type ManageableUserRole = 'superadmin' | 'org_admin' | 'editor' | 'user';

@UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly service: UsersService,
    private readonly orgs: OrgsService,
  ) {}

  private parseRole(role: unknown, fallback: ManageableUserRole = 'user'): ManageableUserRole {
    if (role === 'superadmin' || role === 'org_admin' || role === 'editor' || role === 'user')
      return role;
    if (typeof role === 'undefined' || role === null || role === '') return fallback;
    throw new BadRequestException('Ungültige Rolle');
  }

  private isUserDiagnosticsEnabled() {
    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
    const appEnv = (process.env.APP_ENV || '').toLowerCase();
    return nodeEnv !== 'production' || appEnv === 'development';
  }

  private summarizeUsers(
    users: Array<{
      id: string;
      email: string;
      name?: string | null;
      role: string;
      orgId?: string | null;
      org?: { id: string; name: string } | null;
    }>,
  ) {
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      role: user.role,
      orgId: typeof user.orgId === 'undefined' ? null : user.orgId,
      orgName: user.org?.name ?? null,
    }));
  }

  private logUserListDiagnostics(payload: Record<string, unknown>) {
    if (!this.isUserDiagnosticsEnabled()) return;
    this.logger.log(`[users:list] ${JSON.stringify(payload)}`);
  }

  @Roles('superadmin')
  @Get('directory')
  async directory(
    @Req() req: { user: { role: string }; effectiveOrgId?: string | null | undefined },
  ) {
    // The global directory is deliberately limited to the explicit superadmin area.
    // Keeping this separate from GET /users prevents other scoped data endpoints
    // from accidentally gaining a global mode.
    if (req.user.role !== 'superadmin' || req.effectiveOrgId !== null) {
      throw new ForbiddenException('Globale Benutzerliste nur im Superadmin-Bereich verfügbar');
    }
    // A person with two accesses is intentionally present in both organisation
    // groups. The role and organisation on each row come from that membership,
    // never from the legacy user.orgId field.
    const membershipUsers = await this.service.findAllActiveMembershipUsers();
    const membershipUserIds = new Set(membershipUsers.map((user) => user.id));
    const standaloneUsers = (await this.service.findAll())
      .filter((user) => !membershipUserIds.has(user.id));
    return [...membershipUsers, ...standaloneUsers].map(toPublicUser);
  }

  @Roles('org_admin', 'superadmin')
  @Get()
  async list(
    @Req()
    req: {
      user: { id?: string; role: string; orgId?: string | null; email?: string | null };
      effectiveOrgId?: string | null | undefined;
    },
  ) {
    const orgId = req.effectiveOrgId ?? null;
    if (!orgId) return [];
    const users = await this.service.findByMembershipOrg(orgId);
    this.logUserListDiagnostics({
      branch: 'exact-membership-scope',
      requester: { id: req.user.id ?? null, email: req.user.email ?? null, role: req.user.role, orgId },
      effectiveOrgId: orgId,
      visibleCount: users.length,
    });
    return users.map(toPublicUser);
  }

  /**
   * A superadmin may inspect all active memberships before granting another
   * one. Tenant admins only receive the membership in their current scope.
   */
  @Roles('org_admin', 'superadmin')
  @Get(':id/memberships')
  async memberships(
    @Param('id') id: string,
    @Req() req: { user: { role: string }; effectiveOrgId?: string | null },
  ) {
    const memberships = await this.service.listMemberships(id);
    const visible = req.user.role === 'superadmin'
      ? memberships
      : memberships.filter((membership) => membership.orgId === (req.effectiveOrgId ?? null));
    return visible.map((membership) => ({
      orgId: membership.orgId,
      orgName: membership.organization?.name ?? membership.orgId,
      role: membership.role,
      status: membership.status,
    }));
  }

  @Roles('org_admin', 'superadmin')
  @Post()
  async create(
    @Body() body: CreateUserDto,
    @Req() req: { user: { role: string; orgId?: string | null }; effectiveOrgId?: string | null },
  ) {
    const requestedRole = this.parseRole(body?.role);
    // The active server-validated scope owns the new membership; never trust body.orgId.
    const requestedOrgId = req.effectiveOrgId ?? null;
    if (!requestedOrgId) {
      throw new BadRequestException('Organisation ist erforderlich');
    }
    if (req.user.role !== 'superadmin') {
      if (requestedRole === 'superadmin') throw new ForbiddenException('Nicht erlaubt');
    }
    const result = await this.service.createOrAddMembership({ ...body, role: requestedRole, orgId: requestedOrgId });
    return toPublicUser({
      ...result.user,
      role: result.membership.role,
      orgId: result.membership.orgId,
    });
  }

  @Roles('org_admin', 'superadmin')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() patch: UpdateUserDto,
    @Req() req: { user: { role: string; orgId?: string | null }; effectiveOrgId?: string | null },
  ) {
    const target = await this.service.findById(id);
    if (!target) throw new BadRequestException('User not found');
    const scopeOrgId = req.effectiveOrgId ?? null;
    const requestedOrgId = typeof patch.orgId === 'undefined' ? scopeOrgId : patch.orgId;
    if (!requestedOrgId) throw new ForbiddenException('Organisation ist erforderlich');
    if (req.user.role !== 'superadmin' && requestedOrgId !== scopeOrgId) {
      throw new ForbiddenException('Nicht erlaubt');
    }
    const existingMembership = await this.service.findMembership(id, requestedOrgId);
    const requestedRole =
      typeof patch.role === 'undefined'
        ? undefined
        : this.parseRole(patch.role, 'user');

    if (req.user.role !== 'superadmin') {
      if (requestedRole === 'superadmin') throw new ForbiddenException('Nicht erlaubt');
    }
    if (requestedRole === 'superadmin') throw new ForbiddenException('Organisationsrollen dürfen nicht superadmin sein');
    // Do not allow a role change to remove the final active admin. The same
    // invariant is already enforced when an organisation access is removed.
    if (
      existingMembership?.status === 'active' &&
      existingMembership.role === 'org_admin' &&
      requestedRole !== undefined &&
      requestedRole !== 'org_admin' &&
      (await this.service.countActiveMembershipAdmins(requestedOrgId)) <= 1
    ) {
      throw new BadRequestException('Der letzte Organisationsadmin kann nicht herabgestuft werden');
    }
    const fallbackRole = target.role === 'org_admin' || target.role === 'editor' || target.role === 'user'
      ? target.role
      : 'user';
    await this.service.addMembership(id, requestedOrgId, requestedRole ?? existingMembership?.role ?? fallbackRole);
    return { ok: true };
  }

  /**
   * Removes exactly one organisation access. An organisation admin is limited
   * to the active organisation; superadmins may manage explicit memberships.
   */
  @Roles('org_admin', 'superadmin')
  @Delete(':id/memberships/:orgId')
  async removeMembership(
    @Param('id') id: string,
    @Param('orgId') orgId: string,
    @Req() req: { user: { id: string; role: string }; effectiveOrgId?: string | null },
  ) {
    if (req.user.id === id) throw new BadRequestException('Cannot remove yourself');
    if (req.user.role !== 'superadmin' && orgId !== (req.effectiveOrgId ?? null)) {
      throw new ForbiddenException('Nicht erlaubt');
    }
    const membership = await this.service.findMembership(id, orgId);
    if (!membership) throw new BadRequestException('Mitgliedschaft nicht gefunden');
    if (membership.role === 'org_admin' && (await this.service.countActiveMembershipAdmins(orgId)) <= 1) {
      throw new BadRequestException('Der letzte Organisationsadmin kann nicht entfernt werden');
    }
    await this.service.disableMembership(id, orgId);
    return { ok: true };
  }

  @Roles('org_admin', 'superadmin')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: { user: { id: string; orgId?: string | null; role: string }; effectiveOrgId?: string | null },
  ) {
    if (req.user.id === id) throw new BadRequestException('Cannot remove yourself');
    const orgId = req.effectiveOrgId ?? null;
    if (!orgId) throw new ForbiddenException('Organisation ist erforderlich');
    const membership = await this.service.findMembership(id, orgId);
    if (!membership) throw new BadRequestException('Mitgliedschaft nicht gefunden');
    if (membership.role === 'org_admin' && (await this.service.countActiveMembershipAdmins(orgId)) <= 1) {
      throw new BadRequestException('Der letzte Organisationsadmin kann nicht entfernt werden');
    }
    await this.service.disableMembership(id, orgId);
    return { ok: true };
  }
}
