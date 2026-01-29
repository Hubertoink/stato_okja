import { BadRequestException, Controller, Post, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
// sharp is a native dependency; on some dev platforms it may be missing.
// We load it dynamically so the backend can still compile/run (uploads will error gracefully).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('sharp');
  } catch {
    return null;
  }
})();

import type { Express } from 'express';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 600;

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

@ApiTags('uploads')
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
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
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
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
    const { data, info } = await sharp(file.buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
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
