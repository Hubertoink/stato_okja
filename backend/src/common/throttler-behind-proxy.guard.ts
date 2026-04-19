import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const forwardedIps = req.ips;
    if (Array.isArray(forwardedIps) && typeof forwardedIps[0] === 'string' && forwardedIps[0].trim()) {
      return forwardedIps[0];
    }

    const directIp = req.ip;
    return typeof directIp === 'string' && directIp.trim() ? directIp : 'unknown';
  }
}