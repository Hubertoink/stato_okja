import { Body, Controller, Delete, Get, Injectable, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsIn, IsUUID, Matches } from 'class-validator';
import { JwtAuthGuard } from './jwt.guard';
import { LoginDto } from './dto/auth.dto';
import { EmailChangeService, type EmailChangeAction } from './email-change.service';
import { getAuthRateLimitOverride } from '../config/rate-limit.config';

@Injectable()
export class EmailChangeAccountThrottle extends ThrottlerGuard {
  protected async getTracker(req: { user: { id: string } }) {
    return req.user.id;
  }
}

class EmailChangeLinkDto {
  @IsUUID('4')
  requestId!: string;

  @IsIn(['approve', 'verify', 'cancel'])
  action!: EmailChangeAction;

  @Matches(/^[a-f0-9]{64}$/)
  token!: string;
}

@Controller('auth/email-change')
export class EmailChangeController {
  constructor(private readonly changes: EmailChangeService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  status(@Req() req: { user: { id: string } }) {
    return this.changes.status(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, EmailChangeAccountThrottle)
  @Throttle({ default: getAuthRateLimitOverride(process.env.AUTH_RATE_LIMIT_TTL, process.env.AUTH_RATE_LIMIT_MAX) })
  request(@Req() req: { user: { id: string } }, @Body() body: LoginDto) {
    return this.changes.request(req.user.id, body.email, body.password);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  cancel(@Req() req: { user: { id: string } }, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.changes.cancel(req.user.id, id);
  }

  @Post('respond')
  @Throttle({ default: getAuthRateLimitOverride(process.env.AUTH_RATE_LIMIT_TTL, process.env.AUTH_RATE_LIMIT_MAX) })
  respond(@Body() body: EmailChangeLinkDto) {
    return this.changes.respond(body.requestId, body.action, body.token);
  }
}
