import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async ensureSeed() {
    const exists = await this.users.findOne({ where: { role: 'superadmin' } });
    if (!exists) {
      const u = this.users.create({
        email: 'admin@example.com',
        name: 'Super Admin',
        role: 'superadmin',
        passwordHash: await bcrypt.hash('admin', 10),
      });
      await this.users.save(u);
    }
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const u = await this.users.findOne({ where: { email } });
    if (!u) return null;
    const ok = await bcrypt.compare(password, u.passwordHash || '');
    return ok ? u : null;
  }

  async login(user: User) {
    const payload = { sub: user.id, role: user.role, orgId: user.orgId };
    const token = await this.jwt.signAsync(payload);
    return { access_token: token, user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId } };
  }

  async inviteUser(payload: { email: string; name: string; role?: 'org_admin'|'user'|'superadmin'; orgId?: string|null }) {
    const email = payload.email.toLowerCase();
    let user = await this.users.findOne({ where: { email } });
    if (!user) {
      user = this.users.create({ email, name: payload.name || email, role: (payload.role as any) || 'user', orgId: payload.orgId ?? null, passwordHash: null });
    } else {
      // reset password and update role/org if provided
      user.name = payload.name || user.name;
      if (payload.role) user.role = payload.role as any;
      if (typeof payload.orgId !== 'undefined') user.orgId = payload.orgId ?? null;
      user.passwordHash = null; // mark as invited
    }
    await this.users.save(user);
    const token = await this.jwt.signAsync({ sub: user.id, purpose: 'invite' }, { expiresIn: process.env.INVITE_TOKEN_EXPIRATION || '7d' });
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
}
