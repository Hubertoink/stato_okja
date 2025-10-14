import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Organization } from '../orgs/entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { EmailService } from '../email/email.service';
import type { UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
  @InjectRepository(Location) private readonly locations: Repository<Location>,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  async ensureSeed() {
    const seedEmail = (process.env.SUPERADMIN_EMAIL || 'Hubertoink@outlook.com').toLowerCase();
    const forcedPassword = process.env.SUPERADMIN_PASSWORD;
    const existing = await this.users.findOne({ where: { role: 'superadmin' } });
    if (!existing) {
      const u = this.users.create({
        email: seedEmail,
        name: 'Super Admin',
        role: 'superadmin',
        passwordHash: await bcrypt.hash(forcedPassword || 'admin', 10),
      });
      await this.users.save(u);
    } else {
      let changed = false;
      if (existing.email.toLowerCase() !== seedEmail) {
        // Overwrite email so you can receive reset mails during testing/production
        existing.email = seedEmail;
        changed = true;
      }
      if (typeof forcedPassword === 'string' && forcedPassword.length >= 6) {
        // Allow resetting the superadmin password via ENV
        existing.passwordHash = await bcrypt.hash(forcedPassword, 10);
        changed = true;
      } else if (!existing.passwordHash) {
        // If somehow no password is set (e.g., invited user), ensure a default
        existing.passwordHash = await bcrypt.hash('admin', 10);
        changed = true;
      }
      if (changed) await this.users.save(existing);
    }
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const u = await this.users.createQueryBuilder('u').where('LOWER(u.email) = LOWER(:email)', { email }).getOne();
    if (!u) return null;
    const ok = await bcrypt.compare(password, u.passwordHash || '');
    return ok ? u : null;
  }

  async login(user: User) {
    const payload = { sub: user.id, role: user.role, orgId: user.orgId, name: user.name || null };
    const token = await this.jwt.signAsync(payload);
    const orgName = user.orgId ? (await this.orgs.findOne({ where: { id: user.orgId } }))?.name ?? null : null;
  const avatarUrl = (user as unknown as { avatarUrl?: string | null }).avatarUrl ?? null;
  const rawTheme = (user as unknown as { theme?: string }).theme;
  // Normalize missing/legacy theme values to the new default so first-visit users see the proper theme
  const theme = (!rawTheme || rawTheme === 'light' || rawTheme === 'Light Steel') ? 'Default Theme' : rawTheme;
  return { access_token: token, user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId, orgName, avatarUrl, theme } };
  }

  async inviteUser(payload: { email: string; name: string; role?: 'org_admin'|'user'|'superadmin'; orgId?: string|null; orgName?: string }) {
    const email = payload.email.toLowerCase();
    let user = await this.users.findOne({ where: { email } });
    // If no orgId but orgName provided by superadmin, create organization automatically
    let resolvedOrgId: string | null | undefined = payload.orgId;
    if (!resolvedOrgId && payload.orgName) {
      const existingOrg = await this.orgs.findOne({ where: { name: payload.orgName } });
      if (existingOrg) resolvedOrgId = existingOrg.id;
      else {
        const newOrg = this.orgs.create({ name: payload.orgName });
        const saved = await this.orgs.save(newOrg);
        // Default Location for org
        const loc = this.locations.create({ name: payload.orgName, active: true, orgId: saved.id });
        await this.locations.save(loc);
        resolvedOrgId = saved.id;
      }
    }
    if (!user) {
      const role: UserRole = (payload.role ?? 'user') as UserRole;
      user = this.users.create({ email, name: payload.name || email, role, orgId: (typeof resolvedOrgId !== 'undefined' ? resolvedOrgId : payload.orgId) ?? null, passwordHash: null });
    } else {
      // reset password and update role/org if provided
      user.name = payload.name || user.name;
      if (payload.role) user.role = payload.role as UserRole;
      if (typeof resolvedOrgId !== 'undefined') user.orgId = resolvedOrgId ?? null;
      user.passwordHash = null; // mark as invited
    }
    await this.users.save(user);
  const token = await this.jwt.signAsync({ sub: user.id, purpose: 'invite' }, { expiresIn: process.env.INVITE_TOKEN_EXPIRATION || '7d' });
  const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
  const link = `${origin}/accept-invite?token=${token}`;
  try { await this.email.sendInviteEmail(user.email, user.name || user.email, link); } catch (e) { /* ignore email errors */ }
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId } };
  }

  async acceptInvite(token: string, password: string) {
    const decoded = await this.jwt.verifyAsync<{ sub: string; purpose?: string }>(token, { secret: process.env.JWT_SECRET || 'dev_secret_change_me' });
    if (!decoded || decoded.purpose !== 'invite') throw new Error('Invalid invite token');
    const user = await this.users.findOne({ where: { id: decoded.sub } });
    if (!user) throw new Error('User not found');
    if (user.passwordHash) throw new Error('Invite already accepted');
    user.passwordHash = await bcrypt.hash(password, 10);
    await this.users.save(user);
    return this.login(user);
  }

  async getProfile(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return null;
    const orgName = user.orgId ? (await this.orgs.findOne({ where: { id: user.orgId } }))?.name ?? null : null;
  const avatarUrl = (user as unknown as { avatarUrl?: string | null }).avatarUrl ?? null;
  const rawTheme = (user as unknown as { theme?: string }).theme;
  // Normalize missing/legacy theme values to the new default so first-visit users see the proper theme
  const theme = (!rawTheme || rawTheme === 'light' || rawTheme === 'Light Steel') ? 'Default Theme' : rawTheme;
  return { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId, orgName, avatarUrl, theme };
  }

  async updateProfile(userId: string, patch: { name?: string; avatarUrl?: string | null; theme?: string }) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (typeof patch.name === 'string') user.name = patch.name;
    if (typeof patch.avatarUrl !== 'undefined') (user as unknown as { avatarUrl?: string | null }).avatarUrl = patch.avatarUrl;
    if (typeof patch.theme === 'string') (user as unknown as { theme?: string }).theme = patch.theme;
    await this.users.save(user);
    return this.getProfile(user.id);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new Error('Passwortänderung nicht möglich');
    }
    const ok = await bcrypt.compare(currentPassword || '', user.passwordHash || '');
    if (!ok) throw new Error('Aktuelles Passwort ist falsch');
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.save(user);
    return { ok: true };
  }

  async requestPasswordReset(emailRaw: string) {
    const email = (emailRaw || '').toLowerCase().trim();
    if (!email) return { ok: true };
    const user = await this.users.findOne({ where: { email } });
    // Do not leak existence of the account
    if (!user) return { ok: true };
    const token = await this.jwt.signAsync({ sub: user.id, purpose: 'reset' }, { expiresIn: process.env.RESET_TOKEN_EXPIRATION || '1h' });
    const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
    const link = `${origin}/reset-password?token=${token}`;
    try { await this.email.sendPasswordResetEmail(user.email, user.name || user.email, link); } catch { /* ignore email errors */ }
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const decoded = await this.jwt.verifyAsync<{ sub: string; purpose?: string }>(token, { secret: process.env.JWT_SECRET || 'dev_secret_change_me' });
    if (!decoded || decoded.purpose !== 'reset') throw new Error('Invalid reset token');
    const user = await this.users.findOne({ where: { id: decoded.sub } });
    if (!user) throw new Error('User not found');
    user.passwordHash = await bcrypt.hash(password, 10);
    await this.users.save(user);
    return { ok: true };
  }

  async adminResetPassword(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const token = await this.jwt.signAsync({ sub: user.id, purpose: 'reset' }, { expiresIn: process.env.RESET_TOKEN_EXPIRATION || '1h' });
    const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
    const link = `${origin}/reset-password?token=${token}`;
    try { await this.email.sendPasswordResetEmail(user.email, user.name || user.email, link); } catch { /* ignore email errors */ }
    return { ok: true };
  }
}
