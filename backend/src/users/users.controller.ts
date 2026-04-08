import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrgsService } from '../orgs/orgs.service';
import { OrgScopeGuard } from '../auth/org-scope.guard';

type ManageableUserRole = 'superadmin' | 'org_admin' | 'user';

@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly service: UsersService, private readonly orgs: OrgsService) {}

  private parseRole(role: unknown, fallback: ManageableUserRole = 'user'): ManageableUserRole {
    if (role === 'superadmin' || role === 'org_admin' || role === 'user') return role;
    if (typeof role === 'undefined' || role === null || role === '') return fallback;
    throw new BadRequestException('Ungültige Rolle');
  }

  private isUserDiagnosticsEnabled() {
    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
    const appEnv = (process.env.APP_ENV || '').toLowerCase();
    return nodeEnv !== 'production' || appEnv === 'development';
  }

  private summarizeUsers(users: Array<{
    id: string;
    email: string;
    name?: string | null;
    role: string;
    orgId?: string | null;
    org?: { id: string; name: string } | null;
  }>) {
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

  @Get()
  async list(@Req() req: { user: { id?: string; role: string; orgId?: string|null; email?: string|null }; effectiveOrgId?: string|null|undefined }) {
    if (req.user.role === 'superadmin') {
      // Superadmin must scope explicitly to see tenant users; global listing is intentionally disabled.
      if (typeof req.effectiveOrgId === 'undefined' || req.effectiveOrgId === null) {
        const visibleUsers = await this.service.findByOrg(null);
        const allUsers = this.isUserDiagnosticsEnabled() ? await this.service.findAll() : null;
        this.logUserListDiagnostics({
          branch: 'superadmin-unscoped',
          requester: {
            id: req.user.id ?? null,
            email: req.user.email ?? null,
            role: req.user.role,
            orgId: req.user.orgId ?? null,
          },
          effectiveOrgId: req.effectiveOrgId ?? null,
          note: 'Ohne ausgewählten Org-Scope werden absichtlich nur Benutzer mit orgId=null zurückgegeben.',
          visibleCount: visibleUsers.length,
          visibleUsers: this.summarizeUsers(visibleUsers),
          totalUsersInDb: allUsers?.length ?? undefined,
          allUsersPreview: allUsers ? this.summarizeUsers(allUsers) : undefined,
        });
        return visibleUsers;
      }
      const subtree = await this.orgs.getSubtreeOrgIds(req.effectiveOrgId);
      const users = await this.service.findByOrgIds(subtree);
      this.logUserListDiagnostics({
        branch: 'superadmin-scoped',
        requester: {
          id: req.user.id ?? null,
          email: req.user.email ?? null,
          role: req.user.role,
          orgId: req.user.orgId ?? null,
        },
        effectiveOrgId: req.effectiveOrgId,
        subtree,
        visibleCount: users.length,
        visibleUsers: this.summarizeUsers(users),
      });
      return users;
    }
    const myOrgId = (typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId;
    if (!myOrgId) {
      const users = await this.service.findByOrg(null);
      this.logUserListDiagnostics({
        branch: 'org-user-no-org',
        requester: {
          id: req.user.id ?? null,
          email: req.user.email ?? null,
          role: req.user.role,
          orgId: req.user.orgId ?? null,
        },
        effectiveOrgId: req.effectiveOrgId ?? null,
        visibleCount: users.length,
        visibleUsers: this.summarizeUsers(users),
      });
      return users;
    }
    const subtree = await this.orgs.getSubtreeOrgIds(myOrgId);
    const users = await this.service.findByOrgIds(subtree);
    this.logUserListDiagnostics({
      branch: 'org-user-scoped',
      requester: {
        id: req.user.id ?? null,
        email: req.user.email ?? null,
        role: req.user.role,
        orgId: req.user.orgId ?? null,
      },
      effectiveOrgId: req.effectiveOrgId ?? null,
      subtree,
      visibleCount: users.length,
      visibleUsers: this.summarizeUsers(users),
    });
    return users;
  }

  @Roles('org_admin','superadmin')
  @Post()
  async create(@Body() body: { email: string; name: string; role?: 'superadmin'|'org_admin'|'user'; orgId?: string|null }, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const requestedRole = this.parseRole(body?.role);
    // Require an organization for all users
    const requestedOrgId = typeof body.orgId === 'undefined' ? (req.user.orgId || null) : (body.orgId ?? null);
    if (!requestedOrgId) {
      throw new BadRequestException('Organisation ist erforderlich');
    }
    // Admins can only create users in their own org subtree
    if (req.user.role !== 'superadmin') {
      const myOrgId = req.user.orgId || null;
      if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
      if (requestedRole === 'superadmin') throw new ForbiddenException('Nicht erlaubt');
      const subtree = await this.orgs.getSubtreeOrgIds(myOrgId);
      if (!(requestedOrgId && subtree.includes(requestedOrgId))) throw new ForbiddenException('Nicht erlaubt');
      return this.service.create({ ...body, role: requestedRole, orgId: requestedOrgId });
    }
    return this.service.create({ ...body, role: requestedRole, orgId: requestedOrgId });
  }

  @Roles('org_admin','superadmin')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() patch: { role?: 'org_admin'|'user'; orgId?: string | null }, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const target = await this.service.findById(id);
    if (!target) throw new BadRequestException('User not found');
    const requestedRole = typeof patch.role === 'undefined' ? undefined : this.parseRole(patch.role, target.role as ManageableUserRole);

    // Admins can only change role within subtree and cannot move users outside subtree
    if (req.user.role !== 'superadmin') {
      const myOrgId = req.user.orgId || null;
      if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
      const subtree = await this.orgs.getSubtreeOrgIds(myOrgId);
      const currentOrgId = target.orgId ?? null;
      const nextOrgId = typeof patch.orgId === 'undefined' ? currentOrgId : (patch.orgId ?? null);

      if (!currentOrgId || !subtree.includes(currentOrgId)) throw new ForbiddenException('Nicht erlaubt');
      if (!nextOrgId || !subtree.includes(nextOrgId)) throw new ForbiddenException('Nicht erlaubt');
      if (requestedRole === 'superadmin') throw new ForbiddenException('Nicht erlaubt');
      if (target.role === 'superadmin') throw new ForbiddenException('Nicht erlaubt');
    }
    await this.service.update(id, { ...patch, role: requestedRole });
    return { ok: true };
  }

  @Roles('org_admin','superadmin')
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { user: { id: string; orgId?: string|null; role: string } }) {
    if (req.user.id === id) throw new BadRequestException('Cannot remove yourself');
    const target = await this.service.findById(id);
    if (!target) throw new BadRequestException('User not found');

    if (req.user.role !== 'superadmin') {
      const myOrgId = req.user.orgId || null;
      if (!myOrgId) throw new ForbiddenException('Nicht erlaubt');
      if (target.role === 'superadmin') throw new ForbiddenException('Nicht erlaubt');
      const subtree = await this.orgs.getSubtreeOrgIds(myOrgId);
      if (!target.orgId || !subtree.includes(target.orgId)) throw new ForbiddenException('Nicht erlaubt');
    }

    // Prevent deleting last superadmin globally
    if (target.role === 'superadmin') {
      const superadmins = await this.service.countSuperadmins();
      if (superadmins <= 1) throw new BadRequestException('Cannot remove the last superadmin');
    }
    // Prevent deleting last org admin in the target's org
    if (target.role === 'org_admin') {
      const adminsInOrg = await this.service.countAdmins(target.orgId ?? null);
      if (adminsInOrg <= 1) throw new BadRequestException('Cannot remove the last org admin');
    }
    await this.service.remove(id);
    return { ok: true };
  }
}
