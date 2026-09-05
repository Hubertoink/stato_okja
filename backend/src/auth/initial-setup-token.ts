import { ForbiddenException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

/** Fail closed for unconfigured installations; never reuse a DB or JWT secret. */
export function assertInitialSetupToken(provided: string | undefined) {
  const expected = process.env.INITIAL_SETUP_TOKEN || '';
  if (expected.length < 32 || /^(GENERATED_BY_INSTALLER|CHANGE_TO_|replace-with-)/i.test(expected) || !provided ||
      !timingSafeEqual(createHash('sha256').update(expected).digest(), createHash('sha256').update(provided).digest())) {
    throw new ForbiddenException('Der Einrichtungscode fehlt oder ist ungültig. Den Code findest du in der Installationskonfiguration (INITIAL_SETUP_TOKEN).');
  }
}
