import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SystemDataService, type SystemDataActor } from './system-data.service';

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

  @Post('purge')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Löscht alle Nicht-Superadmin-Daten inklusive Upload-Dateien' })
  purgeAll(
    @Req() req: { user: SystemDataActor },
    @Body() body: { password?: string; confirmationText?: string },
  ) {
    return this.systemDataService.purgeAllData(req.user, {
      password: String(body?.password || ''),
      confirmationText: String(body?.confirmationText || ''),
    });
  }
}