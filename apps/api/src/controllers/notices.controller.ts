import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  Res,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { Response } from 'express';
import { NoticesService } from '../services/notices.service';
import { AskNoticeDto } from '../dto/ask-notice.dto';
import { NoticeChatDto } from '../dto/notice-chat.dto';

// Public read-only endpoints for browsing scraped notices/news — no auth
// required. Admin CRUD/trigger endpoints live under /admin/scraping.
@Controller('notices')
export class NoticesController {
  private readonly logger = new Logger(NoticesController.name);

  constructor(
    private readonly noticesService: NoticesService,
    private readonly httpService: HttpService,
  ) {}

  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('sourceId') sourceId?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('urgency') urgency?: string,
    @Query('sortBy') sortBy?: 'publishedAt' | 'views',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.noticesService.findAll({
      category,
      sourceId,
      search,
      tag,
      dateFrom,
      dateTo,
      urgency,
      sortBy,
      sortOrder,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('search')
  async search(@Body() body: NoticeChatDto) {
    if (!body.question?.trim()) {
      return { answer: '', sources: [], model_used: null };
    }
    return this.noticesService.chat(body);
  }

  /**
   * Streaming chatbot endpoint (Server-Sent Events).
   *
   * Routing (open notice vs. corpus vs. exact count) happens in the service;
   * this method only moves bytes. The AI service already emits well-formed
   * SSE, so the upstream body is piped through rather than parsed and
   * re-serialized — that keeps the first token's latency down to the network
   * hop and avoids a second buffering layer.
   */
  @Post('chat/stream')
  async chatStream(@Body() body: NoticeChatDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: Record<string, unknown>) =>
      res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      const plan = await this.noticesService.prepareChatStream(body);

      if (plan.kind === 'immediate') {
        send({ type: 'delta', text: plan.payload.answer });
        send({ type: 'done', ...plan.payload });
        res.end();
        return;
      }

      send({ type: 'scope', scope: plan.scope });

      const upstream = await firstValueFrom(
        // timeout: 0 overrides HttpModule's 30s default, which is a socket
        // timeout — on a long answer it would sever the stream mid-sentence
        // even though data was still flowing. Client disconnect (below) is the
        // correct cancellation signal here.
        this.httpService.post(plan.url, plan.body, {
          responseType: 'stream',
          timeout: 0,
        }),
      );
      const stream = upstream.data as NodeJS.ReadableStream;

      // If the browser disconnects (navigation, stop button), stop pulling
      // from the AI service instead of generating an answer nobody will read.
      res.on('close', () => {
        if (typeof (stream as any).destroy === 'function') (stream as any).destroy();
      });

      stream.pipe(res);
      stream.on('error', (err: Error) => {
        this.logger.warn(`Chat stream upstream error: ${err.message}`);
        send({ type: 'error', error: 'The assistant stopped unexpectedly.' });
        res.end();
      });
    } catch (err: any) {
      this.logger.warn(`Chat stream failed: ${err.message}`);
      // Headers are already sent, so an error must be delivered in-band.
      send({
        type: 'error',
        error: 'Sorry, I could not process that request right now. Please try again.',
      });
      res.end();
    }
  }

  @Get('meta/category-counts')
  async categoryCounts() {
    return this.noticesService.categoryCounts();
  }

  @Get('meta/sources')
  async listSources() {
    return this.noticesService.listSources();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.noticesService.findOne(id);
  }

  @Post(':id/ask')
  async ask(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AskNoticeDto) {
    return this.noticesService.askQuestion(id, dto.question, dto.history);
  }
}
