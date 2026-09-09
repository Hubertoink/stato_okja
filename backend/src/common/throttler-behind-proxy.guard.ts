import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const directIp = req.ip;
    return typeof directIp === 'string' && directIp.trim() ? directIp : 'unknown';
  }
}