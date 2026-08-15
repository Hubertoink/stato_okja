import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Res, StreamableFile, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { basename, extname, join } from 'path';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
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
const MAX_IMAGE_WIDTH = 600;
const MAX_ORGANIZATION_BANNER_WIDTH = 1600;

function sanitizeBaseName(originalName: string) {
  const name = (originalName || 'file').toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
  const parts = name.split('.');
  const base = parts.join('.') || 'file';
  return base.replace(/^-+/, '').replace(/-+$/, '') || 'file';
}

function makeFilename(originalName: string, ext: string) {
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  const base = sanitizeBaseName(originalName);
  const safeExt = (ext || '').startsWith('.') ? ext : `.${ext || ''}`;
  return `${ts}-${rnd}-${base}${safeExt}`;
}

function getImageContentType(filename: string) {
  const ext = extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

@ApiTags('uploads')
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  @Get('images/:filename')
  @ApiOperation({ summary: 'Bild laden (auth-geschützt)' })
  getImage(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    const safeName = basename(filename || '');
    if (!safeName || safeName !== filename || !/^[a-z0-9][a-z0-9_.-]*$/i.test(safeName)) {
      throw new NotFoundException();
    }

    const filePath = join(process.cwd(), 'uploads', 'images', safeName);
    if (!existsSync(filePath)) throw new NotFoundException();

    res.setHeader('Content-Type', getImageContentType(safeName));
    res.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(createReadStream(filePath));
  }

  @Post('images')
  @ApiOperation({
    summary: 'Bild hochladen',
    description: 'Erwartet ein Multipart-Form-Field "file"',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // allow larger originals; we enforce the processed max below
      fileFilter: (req, file, cb) => {
        // Basic image mimetype allowlist (raster only; we re-encode/resize)
        const ok = /^image\/(png|jpe?g|webp)$/.test(file.mimetype || '');
        cb(ok ? null : new Error('Unsupported file type'), ok);
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
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
    try {
      mkdirSync(uploadsDir, { recursive: true });
    } catch {
      // ignore
    }

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

    writeFileSync(outPath, data);
    const url = `/uploads/images/${filename}`;
    return { url, size: info.size };
  }
}
