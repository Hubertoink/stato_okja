import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { User } from '../users/entities/user.entity';
import { OrganizationMembership } from '../users/entities/organization-membership.entity';
import { Organization } from '../orgs/entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { EmailService } from '../email/email.service';
import { AuditModule } from '../common/audit.module';
import { getJwtSecret } from '../config/security.config';
import { OrgsModule } from '../orgs/orgs.module';
import { LegalContentOverride } from '../legal/entities/legal-content-override.entity';
import { LegalContentService } from '../legal/legal-content.service';
import { OrgScopeGuard } from './org-scope.guard';
import { RolesGuard } from './roles.guard';

function parseJwtExpirationSeconds(raw: string | undefined, fallbackSeconds: number) {
	const value = String(raw || '').trim().toLowerCase();
	if (!value) return fallbackSeconds;
	const match = value.match(/^(\d+)(s|m|h|d)?$/);
	if (!match) return fallbackSeconds;
	const amount = Number.parseInt(match[1], 10);
	if (!Number.isFinite(amount) || amount < 1) return fallbackSeconds;
	const unit = match[2] || 's';
	if (unit === 's') return amount;
	if (unit === 'm') return amount * 60;
	if (unit === 'h') return amount * 60 * 60;
	return amount * 24 * 60 * 60;
}

@Module({
	imports: [
	TypeOrmModule.forFeature([User, Organization, OrganizationMembership, Location, RefreshSession, LegalContentOverride]),
		PassportModule,
		AuditModule,
		OrgsModule,
		JwtModule.register({
			secret: getJwtSecret(),
			signOptions: { expiresIn: parseJwtExpirationSeconds(process.env.JWT_ACCESS_EXPIRATION, 15 * 60) },
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, JwtStrategy, EmailService, LegalContentService, OrgScopeGuard, RolesGuard],
	exports: [JwtModule, AuthService, EmailService],
})
export class AuthModule implements OnModuleInit {
	constructor(private readonly auth: AuthService) {}
	async onModuleInit() {
		// Dev-only seeding: ensure a superadmin exists
		await this.auth.ensureSeed();
	}
}
