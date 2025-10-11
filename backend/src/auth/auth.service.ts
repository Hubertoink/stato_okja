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
}
