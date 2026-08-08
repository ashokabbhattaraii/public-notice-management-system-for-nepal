import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from './documents.service';
import * as fs from 'fs';
import * as path from 'path';

interface SystemDocDef {
  title: string;
  filename: string;
  sourcePath: string;
}

const SYSTEM_DOCUMENTS: SystemDocDef[] = [
  {
    title: 'Budget Speech 2083/84',
    filename: 'Budget speech 2083.pdf',
    sourcePath: '../../docs/Budget speech 2083.pdf',
  },
  {
    title: 'Constitution of Nepal 2072 (English)',
    filename:
      'Constitution-of-Nepal_2072_Eng_www.moljpa.gov_.npDate-72_11_16.pdf',
    sourcePath:
      '../../docs/Constitution-of-Nepal_2072_Eng_www.moljpa.gov_.npDate-72_11_16.pdf',
  },
];

@Injectable()
export class SystemDocumentsService implements OnModuleInit {
  private readonly logger = new Logger(SystemDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const skipSeed = this.config.get<string>('SKIP_SYSTEM_DOCS_SEED');
    if (skipSeed === 'true') return;

    for (const def of SYSTEM_DOCUMENTS) {
      await this.ensureSystemDocument(def);
    }
  }

  private async ensureSystemDocument(def: SystemDocDef): Promise<void> {
    const existing = await this.prisma.document.findFirst({
      where: { filename: def.filename, isSystem: true },
    });

    if (existing) {
      this.logger.log(
        `System document "${def.title}" already exists (status: ${existing.status})`,
      );
      // If it failed previously, retry embedding
      if (existing.status === DocumentStatus.FAILED || existing.status === DocumentStatus.UNEMBEDDED) {
        this.logger.log(`Re-embedding system document "${def.title}"...`);
        this.documentsService.processDocument(existing).catch((err) => {
          this.logger.error(`Failed to re-embed "${def.title}": ${err.message}`);
        });
      }
      return;
    }

    // Resolve from the project root (apps/api/)
    const projectRoot = path.resolve(__dirname, '..', '..');
    const sourcePath = path.resolve(projectRoot, def.sourcePath);
    if (!fs.existsSync(sourcePath)) {
      this.logger.warn(
        `System document source not found: ${sourcePath} — skipping "${def.title}"`,
      );
      return;
    }

    // Copy file to uploads directory
    const uploadsDir = path.resolve(projectRoot, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const destFilename = `system-${Date.now()}-${def.filename}`;
    const destPath = path.join(uploadsDir, destFilename);
    fs.copyFileSync(sourcePath, destPath);

    const stat = fs.statSync(destPath);

    const document = await this.prisma.document.create({
      data: {
        title: def.title,
        filename: def.filename,
        mimeType: 'application/pdf',
        fileSize: stat.size,
        filePath: destPath,
        isSystem: true,
        uploadedBy: null,
      },
    });

    this.logger.log(
      `Created system document "${def.title}" (${document.id}). Starting embedding...`,
    );

    this.documentsService.processDocument(document).catch((err) => {
      this.logger.error(
        `Failed to process system document "${def.title}": ${err.message}`,
      );
    });
  }
}
