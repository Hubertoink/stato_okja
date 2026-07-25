import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { getJwtSecret } from '../config/security.config';
import { User } from '../users/entities/user.entity';
import { RefreshSession } from './entities/refresh-session.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshSession) private readonly refreshSessions: Repository<RefreshSession>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: { sub: string; sid?: string }) {
    if (!payload.sid) throw new UnauthorizedException('Sitzung ist nicht mehr gültig');

    const session = await this.refreshSessions.findOne({
      where: { id: payload.sid, userId: payload.sub },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sitzung ist nicht mehr gültig');
    }

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Nicht autorisiert');
    return {
      id: user.id,
      role: user.role,
      orgId: user.orgId ?? null,
      name: user.name ?? null,
    };
  }
}
