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

@Module({
	imports: [
	TypeOrmModule.forFeature([User, Organization, Location]),
		PassportModule,
		JwtModule.register({
			secret: process.env.JWT_SECRET || 'dev_secret_change_me',
			signOptions: { expiresIn: '7d' },
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
