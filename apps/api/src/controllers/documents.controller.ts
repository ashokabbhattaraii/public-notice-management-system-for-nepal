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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { User } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
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
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
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

  @Get()
  async findAll(@Query() dto: ListDocumentsDto) {
    return this.documentsService.findAll(dto);
  }

  // Must be declared before ':id' routes so 'progress' isn't parsed as a UUID.
  @Get('progress/batch')
  async progressBatch(@Query('ids') ids?: string) {
    const docIds = (ids ?? '').split(',').filter(Boolean).slice(0, 50);
    return this.documentsService.getProgressBatch(docIds);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.findOne(id);
  }

  @Post(':id/embed')
  async embed(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.embed(id);
  }

  @Post(':id/unembed')
  async unembed(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.unembed(id);
  }

  @Get(':id/progress')
  async progress(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.getProgress(id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.documentsService.remove(id);
    return { message: 'Document deleted successfully' };
  }

  @Get(':id/download')
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
