import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, Res, StreamableFile, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { basename, extname, join } from 'path';
import { createReadStream, existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { UploadsService } from './uploads.service';
import type sharpFactory from 'sharp';
// sharp is a native dependency; on some dev platforms it may be missing.
// We load it dynamically so the backend can still compile/run (uploads will error gracefully).
type SharpFactory = typeof sharpFactory;

const sharp: SharpFactory | null = (() => {
  try {
    return require('sharp') as SharpFactory;
  } catch {
    return null;
  }
})();

import type { Express } from 'express';
import type { Response } from 'express';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_PROCESS_FILE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 600;
const MAX_ORGANIZATION_BANNER_WIDTH = 1600;
const UPLOAD_RATE_LIMIT = { default: { limit: 10, ttl: 60_000 } };

type UploadRequest = {
  user: { id: string; role: string };
  effectiveOrgId?: string | null;
};

function sanitizeBaseName(originalName: string) {
  const name = (originalName || 'file').toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
  const parts = name.split('.');
  const base = parts.join('.') || 'file';
  return base.replace(/^-+/, '').replace(/-+$/, '') || 'file';
}

function makeFilename(originalName: string, ext: string) {
  const ts = Date.now();
  const rnd = randomUUID();
  const base = sanitizeBaseName(originalName).slice(0, 120);
  const safeExt = (ext || '').startsWith('.') ? ext : `.${ext || ''}`;
  return `${ts}-${rnd}-${base}${safeExt}`;
}

function getImageContentType(filename: string) {
  const ext = extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function getProcessFileContentType(filename: string) {
  const ext = extname(filename).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

@ApiTags('uploads')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('images/:filename')
  @ApiOperation({ summary: 'Bild laden (auth-geschützt)' })
  async getImage(
    @Param('filename') filename: string,
    @Req() req: UploadRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const safeName = basename(filename || '');
    if (!safeName || safeName !== filename || !/^[a-z0-9][a-z0-9_.-]*$/i.test(safeName)) {
      throw new NotFoundException();
    }

    await this.uploadsService.assertCanRead(
      safeName,
      'image',
      req.user,
      req.effectiveOrgId,
    );
    const filePath = join(process.cwd(), 'uploads', 'images', safeName);
    if (!existsSync(filePath)) throw new NotFoundException();

    res.setHeader('Content-Type', getImageContentType(safeName));
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(createReadStream(filePath));
  }

  @Post('images')
  @Throttle(UPLOAD_RATE_LIMIT)
  @ApiOperation({
    summary: 'Bild hochladen',
    description: 'Erwartet ein Multipart-Form-Field "file"',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, fieldSize: 100 },
      fileFilter: (req, file, cb) => {
        // Basic image mimetype allowlist (raster only; we re-encode/resize)
        const ok = /^image\/(png|jpe?g|webp)$/.test(file.mimetype || '');
        cb(ok ? null : new Error('Unsupported file type'), ok);
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: UploadRequest,
    @Body('variant') variant?: string,
  ) {
    if (!file) {
      return { message: 'No file uploaded' };
    }

    if (!sharp) {
      throw new BadRequestException(
        'Image processing is not available (dependency "sharp" is missing).',
      );
    }
    const uploadsDir = join(process.cwd(), 'uploads', 'images');
    await mkdir(uploadsDir, { recursive: true });

    const mime = (file.mimetype || '').toLowerCase();
    const format: 'jpeg' | 'png' | 'webp' = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpeg';
    const ext = format === 'jpeg' ? 'jpg' : format;
    const filename = makeFilename(file.originalname, ext);
    const outPath = join(uploadsDir, filename);

    // Resize and re-encode. rotate() fixes EXIF orientation.
    const maxWidth = variant === 'organization-banner' ? MAX_ORGANIZATION_BANNER_WIDTH : MAX_IMAGE_WIDTH;
    const { data, info } = await sharp(file.buffer)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .toFormat(format, format === 'jpeg' ? { quality: 82 } : format === 'webp' ? { quality: 82 } : { compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });

    if (info.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(`Image too large (max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB)`);
    }

    const scopeKeys = await this.uploadsService.getWriteScopes(
      req.user,
      req.effectiveOrgId,
      variant,
    );
    await this.uploadsService.register(filename, 'image', info.size, scopeKeys);
    try {
      await writeFile(outPath, data, { flag: 'wx' });
    } catch (error) {
      await unlink(outPath).catch(() => undefined);
      await this.uploadsService.unregister(filename, 'image').catch(() => undefined);
      throw error;
    }
    const url = `/uploads/images/${filename}`;
    return { url, size: info.size };
  }

  @Get('files/:filename')
  @ApiOperation({ summary: 'Prozess-Datei laden (auth-geschützt)' })
  async getProcessFile(
    @Param('filename') filename: string,
    @Req() req: UploadRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const safeName = basename(filename || '');
    if (!safeName || safeName !== filename || !/^[a-z0-9][a-z0-9_.-]*$/i.test(safeName)) {
      throw new NotFoundException();
    }
    await this.uploadsService.assertCanRead(
      safeName,
      'process-file',
      req.user,
      req.effectiveOrgId,
    );
    const filePath = join(process.cwd(), 'uploads', 'process-files', safeName);
    if (!existsSync(filePath)) throw new NotFoundException();

    res.setHeader('Content-Type', getProcessFileContentType(safeName));
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(createReadStream(filePath));
  }

  @Post('files')
  @Throttle(UPLOAD_RATE_LIMIT)
  @ApiOperation({ summary: 'Bild oder PDF für ProzessO hochladen' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PROCESS_FILE_BYTES, files: 1, fields: 0 },
      fileFilter: (req, file, cb) => {
        const ok = /^image\/(png|jpe?g|webp)$/.test(file.mimetype || '') || file.mimetype === 'application/pdf';
        cb(ok ? null : new Error('Unsupported file type'), ok);
      },
    }),
  )
  async uploadProcessFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: UploadRequest,
  ) {
    if (!file) throw new BadRequestException('Keine Datei hochgeladen.');
    const mimeType = (file.mimetype || '').toLowerCase();
    const extension = mimeType === 'application/pdf'
      ? '.pdf'
      : mimeType === 'image/png'
        ? '.png'
        : mimeType === 'image/webp'
          ? '.webp'
          : '.jpg';
    const uploadsDir = join(process.cwd(), 'uploads', 'process-files');
    await mkdir(uploadsDir, { recursive: true });
    const filename = makeFilename(file.originalname, extension);
    const outPath = join(uploadsDir, filename);
    const scopeKeys = await this.uploadsService.getWriteScopes(
      req.user,
      req.effectiveOrgId,
    );
    await this.uploadsService.register(filename, 'process-file', file.size, scopeKeys);
    try {
      await writeFile(outPath, file.buffer, { flag: 'wx' });
    } catch (error) {
      await unlink(outPath).catch(() => undefined);
      await this.uploadsService.unregister(filename, 'process-file').catch(() => undefined);
      throw error;
    }
    return {
      url: `/uploads/files/${filename}`,
      filename: file.originalname,
      mimeType,
      size: file.size,
    };
  }
}
