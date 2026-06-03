import { Controller, Post, Body, Get } from '@nestjs/common';

@Controller('rag')
export class RagController {
  @Post('query')
  query(@Body() body: { question: string }) {
    return { message: 'RAG query proxy', question: body.question, answer: '' };
  }

  @Get('documents')
  listDocuments() {
    return { message: 'List documents', data: [] };
  }

  @Post('documents')
  uploadDocument(@Body() body: any) {
    return { message: 'Upload document', data: body };
  }
}
