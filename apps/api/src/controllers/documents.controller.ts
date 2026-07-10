import {
  Controller,
  Get,
  Post,
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
import { User } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { DocumentsService } from '../services/documents.service';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { ListDocumentsDto } from '../dto/list-documents.dto';

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

    const document = await this.documentsService.create({
      title: dto.title,
      filename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath: file.path,
      uploadedBy: user.id,
    });

    return document;
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
    if (!doc.isSystem && doc.uploadedBy !== user.id) {
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
      throw new ForbiddenException('System documents cannot be unembedded');
    }
    if (doc.uploadedBy !== user.id) {
      throw new ForbiddenException('You can only unembed your own documents');
    }
    return this.documentsService.unembed(id);
  }

  @Get(':id/progress')
  @UseGuards(OptionalJwtAuthGuard)
  async progress(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.getProgress(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const doc = await this.documentsService.findOne(id);
    if (doc.isSystem) {
      throw new ForbiddenException('System documents cannot be deleted');
    }
    if (doc.uploadedBy !== user.id) {
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
