import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  ParseUUIDPipe,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { User, Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { DocumentsService } from '../services/documents.service';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { ListDocumentsDto } from '../dto/list-documents.dto';
import * as crypto from 'crypto';
import * as fs from 'fs';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const storage = diskStorage({
  destination: path.resolve(__dirname, '..', '..', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `File type ${file.mimetype} is not allowed. Allowed types: PDF, DOCX, TXT, PNG, JPEG`,
            ),
            false,
          );
        }
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Compute SHA-256 hash for deduplication
    const fileBuffer = fs.readFileSync(file.path);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check for existing document with same hash
    const existing = await this.documentsService.findByHash(fileHash);
    if (existing) {
      return {
        ...existing,
        deduplicated: true,
      };
    }

    // Stable doc_id from content hash (first 32 chars = 128 bits)
    const docId = fileHash.substring(0, 32);

    // Only admins may create system documents (shared, visible to everyone);
    // silently ignored for anyone else rather than erroring the whole upload.
    const isSystem = dto.isSystem === true && user.role === Role.admin;

    const document = await this.documentsService.create({
      id: docId,
      title: dto.title,
      filename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath: file.path,
      uploadedBy: isSystem ? null : user.id,
      fileHash: fileHash,
      isSystem,
    });

    return document;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: User,
  ) {
    const doc = await this.documentsService.findOne(id);
    if (doc.isSystem) {
      if (user.role !== Role.admin) {
        throw new ForbiddenException('Only admins can edit system documents');
      }
    } else if (doc.uploadedBy !== user.id) {
      throw new ForbiddenException('You can only edit your own documents');
    }
    return this.documentsService.update(id, dto);
  }

  // Returns system docs + user's own docs (scoped)
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(
    @Query() dto: ListDocumentsDto,
    @CurrentUser() user: User | null,
  ) {
    return this.documentsService.findAll(dto, user?.id);
  }

  @Get('progress/batch')
  @UseGuards(OptionalJwtAuthGuard)
  async progressBatch(
    @Query('ids') ids?: string,
  ) {
    const docIds = (ids ?? '').split(',').filter(Boolean).slice(0, 50);
    return this.documentsService.getProgressBatch(docIds);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.findOne(id);
  }

  @Post(':id/embed')
  @UseGuards(JwtAuthGuard)
  async embed(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const doc = await this.documentsService.findOne(id);
    if (doc.isSystem) {
      if (user.role !== Role.admin) {
        throw new ForbiddenException('Only admins can (re-)embed system documents');
      }
    } else if (doc.uploadedBy !== user.id) {
      throw new ForbiddenException('You can only embed your own documents');
    }
    return this.documentsService.embed(id);
  }

  @Post(':id/unembed')
  @UseGuards(JwtAuthGuard)
  async unembed(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const doc = await this.documentsService.findOne(id);
    if (doc.isSystem) {
      if (user.role !== Role.admin) {
        throw new ForbiddenException('Only admins can unembed system documents');
      }
    } else if (doc.uploadedBy !== user.id) {
      throw new ForbiddenException('You can only unembed your own documents');
    }
    return this.documentsService.unembed(id);
  }

  @Get(':id/progress')
  @UseGuards(OptionalJwtAuthGuard)
  async progress(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.getProgress(id);
  }

  @Get(':id/progress/stream')
  @UseGuards(OptionalJwtAuthGuard)
  async progressStream(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const sendError = (error: string) => {
      res.write(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
    };

    const sendDone = () => {
      res.write('event: done\ndata: {}\n\n');
      res.end();
    };

    const intervalRef = { current: null as NodeJS.Timeout | null };

    const checkProgress = async () => {
      try {
        const progress = await this.documentsService.getProgress(id);
        sendEvent(progress);
        if (progress.stage === 'done' || progress.stage === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          sendDone();
        }
      } catch (error) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        sendError(error.message || 'Failed to get progress');
        res.end();
      }
    };

    // Initial send
    checkProgress();

    // Poll every second
    intervalRef.current = setInterval(checkProgress, 1000);

    // Cleanup on disconnect
    res.on('close', () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const doc = await this.documentsService.findOne(id);
    if (doc.isSystem) {
      if (user.role !== Role.admin) {
        throw new ForbiddenException('Only admins can delete system documents');
      }
    } else if (doc.uploadedBy !== user.id) {
      throw new ForbiddenException('You can only delete your own documents');
    }
    await this.documentsService.remove(id);
    return { message: 'Document deleted successfully' };
  }

  @Get(':id/download')
  @UseGuards(OptionalJwtAuthGuard)
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const document = await this.documentsService.findOne(id);
    const filePath = this.documentsService.getFilePath(document);

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.filename}"`,
    );
    res.sendFile(filePath);
  }
}
