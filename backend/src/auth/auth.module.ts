import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { User } from '../users/entities/user.entity';
import { Organization } from '../orgs/entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { EmailService } from '../email/email.service';
import { AuditModule } from '../common/audit.module';
import { getJwtSecret } from '../config/security.config';
import { OrgsModule } from '../orgs/orgs.module';

@Module({
	imports: [
	TypeOrmModule.forFeature([User, Organization, Location]),
		PassportModule,
		AuditModule,
		OrgsModule,
		JwtModule.register({
			secret: getJwtSecret(),
			signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '12h' },
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, JwtStrategy, EmailService],
	exports: [JwtModule, AuthService],
})
export class AuthModule implements OnModuleInit {
	constructor(private readonly auth: AuthService) {}
	async onModuleInit() {
		// Dev-only seeding: ensure a superadmin exists
		await this.auth.ensureSeed();
	}
}
