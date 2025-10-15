import { Controller, Post, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';

import type { Express } from 'express';

// Create a safe filename: timestamp-random-original.ext (lowercased, spaces -> -)
function sanitizeFilename(originalName: string) {
  const name = (originalName || 'file').toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  const parts = name.split('.');
  const ext = parts.length > 1 ? '.' + parts.pop() : '';
  const base = parts.join('.') || 'file';
  return `${ts}-${rnd}-${base}${ext}`;
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
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'images'),
        filename: (req, file, cb) => cb(null, sanitizeFilename(file.originalname)),
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        // Basic image mimetype allowlist
        const ok = /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml)$/.test(file.mimetype || '');
        cb(ok ? null : new Error('Unsupported file type'), ok);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { message: 'No file uploaded' };
    }
    // Return relative URL that frontend nginx proxies to backend
    const url = `/uploads/images/${file.filename}`;
    return { url };
  }
}
