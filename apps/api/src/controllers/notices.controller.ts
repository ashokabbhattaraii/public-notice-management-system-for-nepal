import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';

@Controller('notices')
export class NoticesController {
  @Get()
  findAll() {
    return { message: 'List all notices', data: [] };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { message: `Get notice ${id}` };
  }

  @Post()
  create(@Body() body: any) {
    return { message: 'Create notice', data: body };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return { message: `Update notice ${id}`, data: body };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return { message: `Delete notice ${id}` };
  }
}
