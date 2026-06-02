import { BadRequestException, Controller, Get, Post, Patch, Delete, Param, Body, Query, NotFoundException, UseGuards, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { OrgsService } from '../orgs/orgs.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ArchiveProjectDto } from './dto/archive-project.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { basename, extname, join } from 'path';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import type { Express, Response } from 'express';

const MAX_PROJECT_DOCUMENT_BYTES = 15 * 1024 * 1024;
const PROJECT_DOCUMENT_DIR = join(process.cwd(), 'uploads', 'project-documents');
const ALLOWED_PROJECT_DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.odt',
  '.rtf',
  '.txt',
]);
const ALLOWED_PROJECT_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/plain',
]);

function sanitizeProjectDocumentBaseName(originalName: string) {
  const trimmed = (originalName || 'dokument').trim();
  const extension = extname(trimmed).toLowerCase();
  const baseName = basename(trimmed, extension)
    .replace(/[^a-zA-Z0-9._ -]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return baseName || 'dokument';
}

function makeProjectDocumentStorageName(originalName: string) {
  const extension = extname(originalName || '').toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}-${sanitizeProjectDocumentBaseName(originalName)}${extension}`;
}

function isAllowedProjectDocument(
  file?: { originalname?: string; mimetype?: string } | null,
) {
  if (!file) return false;
  const extension = extname(file.originalname || '').toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();
  return (
    ALLOWED_PROJECT_DOCUMENT_EXTENSIONS.has(extension) &&
    ALLOWED_PROJECT_DOCUMENT_MIME_TYPES.has(mimeType)
  );
}

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService, private readonly orgs: OrgsService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Projekte abrufen' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'archived', required: false })
  async findAll(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }, @Query('search') search?: string, @Query('archived') archived?: string) {
    const archivedBool = archived === 'true' ? true : archived === 'false' ? false : undefined;
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin'
      ? superAdminScoped
      : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    let orgId: string | null | undefined = orgIdRaw;
    let orgIds: string[] | undefined;
    if (typeof orgIdRaw === 'string') {
      orgIds = await this.orgs.getSubtreeOrgIds(orgIdRaw);
      orgId = undefined;
    }
    return this.projectsService.findAll(search, archivedBool, orgId, orgIds);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Projekt per ID abrufen' })
  async findOne(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const p = await this.projectsService.findOneScoped(id, req.user);
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  @Post()
  @ApiOperation({ summary: 'Projekt anlegen' })
  create(@Body() data: CreateProjectDto, @Req() req: { user: { id: string; role: string; orgId?: string|null; name?: string|null }; effectiveOrgId?: string|null|undefined }) {
    // Enforce orgId from scope only; ignore body
    const orgId = req.user.role === 'superadmin'
      ? ((typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId)
      : ((typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId);
    return this.projectsService.create({ ...data, orgId }, { id: req.user.id, name: req.user.name || null, orgId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Projekt bearbeiten' })
  update(@Param('id') id: string, @Body() data: UpdateProjectDto, @Req() req: { user: { role: string; orgId?: string|null } }) {
    // Never allow changing orgId via update
    const rest: UpdateProjectDto = { ...(data as UpdateProjectDto) };
    delete (rest as UpdateProjectDto & { orgId?: string | null }).orgId;
    return this.projectsService.updateScoped(id, rest, req.user);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Projekt-Dokument hochladen' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PROJECT_DOCUMENT_BYTES },
      fileFilter: (_req, file, callback) => {
        callback(
          isAllowedProjectDocument(file)
            ? null
            : new BadRequestException('Unsupported file type'),
          isAllowedProjectDocument(file),
        );
      },
    }),
  )
  async uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: { user: { id?: string; role: string; orgId?: string | null; name?: string | null } },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!isAllowedProjectDocument(file)) {
      throw new BadRequestException('Nur PDF, DOC, DOCX, ODT, RTF oder TXT sind erlaubt.');
    }

    mkdirSync(PROJECT_DOCUMENT_DIR, { recursive: true });
    const storedFilename = makeProjectDocumentStorageName(file.originalname || 'dokument');
    const absolutePath = join(PROJECT_DOCUMENT_DIR, storedFilename);
    writeFileSync(absolutePath, file.buffer);

    try {
      return await this.projectsService.addDocument(
        id,
        {
          filename: file.originalname || storedFilename,
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size,
          storageRef: `project-documents/${storedFilename}`,
        },
        req.user,
      );
    } catch (error) {
      try {
        require('fs').unlinkSync(absolutePath);
      } catch {
        // ignore cleanup failures here; the request already failed.
      }
      throw error;
    }
  }

  @Get(':id/documents/:documentId/download')
  @ApiOperation({ summary: 'Projekt-Dokument herunterladen' })
  async downloadDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: { user: { role: string; orgId?: string | null } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const document = await this.projectsService.getDocumentScoped(id, documentId, req.user);
    const relativeStorageRef = String(document.storageRef || '').replace(/\\/g, '/').trim();
    const absolutePath = join(process.cwd(), 'uploads', relativeStorageRef);
    if (!relativeStorageRef || relativeStorageRef.includes('..') || !existsSync(absolutePath)) {
      throw new NotFoundException('Document not found');
    }

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', document.size);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(document.filename || 'dokument')}`,
    );
    return new StreamableFile(createReadStream(absolutePath));
  }

  @Delete(':id/documents/:documentId')
  @ApiOperation({ summary: 'Projekt-Dokument entfernen' })
  removeDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: { user: { id?: string; role: string; orgId?: string | null; name?: string | null } },
  ) {
    return this.projectsService.removeDocument(id, documentId, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Projekt löschen' })
  remove(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.projectsService.removeScoped(id, req.user);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Projekt archivieren / wiederherstellen' })
  setArchived(@Param('id') id: string, @Body() body: ArchiveProjectDto, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.projectsService.archiveScoped(id, body.archived ?? true, req.user);
  }
}
