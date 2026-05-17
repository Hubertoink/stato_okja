import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SystemDataService, type SystemDataActor } from './system-data.service';
import { ConfirmSystemDataOperationDto, DeleteSystemDataUploadDto, DeleteSystemDataUploadsDto } from './dto/system-data.dto';

const systemDataImportTempDir = join(process.cwd(), '.tmp', 'system-data-imports');

const systemDataImportUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(systemDataImportTempDir, { recursive: true });
      callback(null, systemDataImportTempDir);
    },
    filename: (_req, file, callback) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000_000)}`;
      const extension = extname(file.originalname || '').toLowerCase() || '.zip';
      callback(null, `system-data-import-${suffix}${extension}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const extension = extname(file.originalname || '').toLowerCase();
    if (extension && extension !== '.zip') {
      callback(new BadRequestException('Bitte eine ZIP-Datei hochladen.') as unknown as Error, false);
      return;
    }
    callback(null, true);
  },
};

@ApiTags('system-data')
@Controller('admin/system-data')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemDataController {
  constructor(private readonly systemDataService: SystemDataService) {}

  @Get('summary')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Liefert globale Metadaten für den Superadmin-Datenexport und die Voll-Löschung' })
  summary() {
    return this.systemDataService.getSummary();
  }

  @Get('uploads')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Listet Upload-Dateien mit Referenzanzahl für die Superadmin-Datenverwaltung' })
  uploads(@Req() req: { user: SystemDataActor }) {
    return this.systemDataService.listUploads(req.user);
  }

  @Post('import/inspect')
  @Roles('superadmin')
  @UseInterceptors(FileInterceptor('file', systemDataImportUploadOptions))
  @ApiOperation({ summary: 'Prüft ein Systemdaten-Backup vor dem Restore' })
  inspectImport(
    @Req() req: { user: SystemDataActor },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.path) {
      throw new BadRequestException('ZIP-Datei ist erforderlich.');
    }
    return this.systemDataService.inspectImportArchive(req.user, file.path, file.originalname);
  }

  @Get('export')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Exportiert alle Anwendungsdaten als ZIP-Archiv' })
  async exportAll(
    @Req() req: { user: SystemDataActor },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.systemDataService.exportAllData(req.user);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', String(result.buffer.length));
    return new StreamableFile(result.buffer);
  }

  @Post('import')
  @Roles('superadmin')
  @UseInterceptors(FileInterceptor('file', systemDataImportUploadOptions))
  @ApiOperation({ summary: 'Stellt alle Anwendungsdaten aus einem ZIP-Archiv vollständig wieder her' })
  importAll(
    @Req() req: { user: SystemDataActor },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ConfirmSystemDataOperationDto,
  ) {
    if (!file?.path) {
      throw new BadRequestException('ZIP-Datei ist erforderlich.');
    }
    return this.systemDataService.importAllData(req.user, file.path, {
      originalFilename: file.originalname,
      password: String(body?.password || ''),
      confirmationText: String(body?.confirmationText || ''),
    });
  }

  @Post('purge')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Löscht alle Nicht-Superadmin-Daten inklusive Upload-Dateien' })
  purgeAll(
    @Req() req: { user: SystemDataActor },
    @Body() body: ConfirmSystemDataOperationDto,
  ) {
    return this.systemDataService.purgeAllData(req.user, {
      password: String(body?.password || ''),
      confirmationText: String(body?.confirmationText || ''),
    });
  }

  @Post('uploads/delete')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Löscht eine Upload-Datei und entfernt bekannte Datenbank-Referenzen' })
  deleteUpload(
    @Req() req: { user: SystemDataActor },
    @Body() body: DeleteSystemDataUploadDto,
  ) {
    return this.systemDataService.deleteUpload(req.user, String(body?.relativePath || ''));
  }

  @Post('uploads/delete-many')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Löscht mehrere Upload-Dateien und entfernt bekannte Datenbank-Referenzen' })
  deleteUploads(
    @Req() req: { user: SystemDataActor },
    @Body() body: DeleteSystemDataUploadsDto,
  ) {
    return this.systemDataService.deleteUploads(req.user, Array.isArray(body?.relativePaths) ? body.relativePaths : []);
  }
}