/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { assertSecureRuntimeConfig } from './config/security.config';

async function bootstrap() {
  assertSecureRuntimeConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
    .setTitle('Stato 2.0 API')
    .setDescription('OKJA Statistik- und Dokumentationssystem API')
    .setVersion('2.0.0')
    .addBearerAuth()
    .addTag('auth', 'Authentifizierung')
    .addTag('activities', 'Tätigkeiten & Aktivitäten')
    .addTag('taxonomy', 'Kategorien, Tags & Kohorten')
    .addTag('staff', 'Mitarbeitende & Team')
    .addTag('locations', 'Standorte & Räume')
    .addTag('stats', 'Statistiken & Auswertungen')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Ensure uploads directories exist (volume might start empty)
  const uploadsBase = join(process.cwd(), 'uploads');
  const uploadsImages = join(uploadsBase, 'images');
  try {
    if (!existsSync(uploadsImages)) mkdirSync(uploadsImages, { recursive: true });
  } catch (e) {
    console.warn('Could not ensure uploads directory exists:', e);
  }

  // Serve static files for uploads
  app.useStaticAssets(uploadsBase, {
    prefix: '/uploads/',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`\n🚀 Stato 2.0 Backend running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs\n`);
}

bootstrap();
