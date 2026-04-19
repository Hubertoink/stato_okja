/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { types as pgTypes } from 'pg';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { assertSecureRuntimeConfig, shouldExposeSwaggerDocs } from './config/security.config';
import { shouldTrustProxy } from './config/rate-limit.config';
import { assertTwoFactorRuntimeConfig, isTwoFactorAuthenticationEnabled } from './auth/two-factor.config';
import { EmailService } from './email/email.service';

const PG_TIMESTAMP_OID = 1114;

// Postgres `timestamp without time zone` values are timezone-naive.
// We store and interpret them as UTC so JSON serialization stays stable
// even when the Node process runs with a local TZ like Europe/Berlin.
pgTypes.setTypeParser(PG_TIMESTAMP_OID, (value) => {
  if (!value) return null;
  return new Date(`${value}Z`);
});

async function bootstrap() {
  assertSecureRuntimeConfig();
  assertTwoFactorRuntimeConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const emailService = app.get(EmailService, { strict: false });

  if (emailService) {
    await emailService.verifySmtpConnection({
      failOnError: isTwoFactorAuthenticationEnabled(),
    });
  }

  if (shouldTrustProxy(process.env.TRUST_PROXY)) {
    app.set('trust proxy', true);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Global prefix
  app.setGlobalPrefix(process.env.API_PREFIX || 'api');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173'];
  app.enableCors({ origin: corsOrigins, credentials: true });

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Stato 1.0 API')
    .setDescription('OKJA Statistik- und Dokumentationssystem API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('auth', 'Authentifizierung')
    .addTag('activities', 'Tätigkeiten & Aktivitäten')
    .addTag('taxonomy', 'Kategorien, Tags & Kohorten')
    .addTag('staff', 'Mitarbeitende & Team')
    .addTag('locations', 'Standorte & Räume')
    .addTag('stats', 'Statistiken & Auswertungen')
    .build();

  if (shouldExposeSwaggerDocs()) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Ensure uploads directories exist (volume might start empty)
  const uploadsBase = join(process.cwd(), 'uploads');
  const uploadsImages = join(uploadsBase, 'images');
  try {
    if (!existsSync(uploadsImages)) mkdirSync(uploadsImages, { recursive: true });
  } catch (e) {
    console.warn('Could not ensure uploads directory exists:', e);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`\n🚀 Stato 1.0 Backend running on: http://localhost:${port}`);
  if (shouldExposeSwaggerDocs()) {
    console.log(`📚 API Documentation: http://localhost:${port}/api/docs\n`);
  } else {
    console.log('📚 API Documentation: deaktiviert\n');
  }
}

bootstrap();
