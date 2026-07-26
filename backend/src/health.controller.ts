import { Controller, Get } from '@nestjs/common';
import backendPackage from '../package.json';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'backend',
      version: backendPackage.version,
      timestamp: new Date().toISOString(),
    };
  }
}
