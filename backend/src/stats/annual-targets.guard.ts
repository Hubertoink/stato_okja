import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

/** Runtime switch shared by the API guard and public frontend configuration. */
export function annualTargetsEnabled(): boolean {
  return process.env.ANNUAL_TARGETS_ENABLED?.trim().toLowerCase() === 'true';
}

@Injectable()
export class AnnualTargetsGuard implements CanActivate {
  canActivate(): boolean {
    if (!annualTargetsEnabled())
      throw new NotFoundException('Jahresziele sind in dieser Installation deaktiviert');
    return true;
  }
}
