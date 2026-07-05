import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { InternsService } from '../services/interns.service';
import {
  CreateInternDto,
  UpdateInternDto,
  RecordAttendanceDto,
  BulkAttendanceDto,
  SaturdayRosterDto,
  MarkSaturdayPresenceDto,
  ListInternsDto,
} from '../dto/intern.dto';

@Controller('interns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class InternsController {
  constructor(private readonly internsService: InternsService) {}

  @Post()
  create(@Body() dto: CreateInternDto) {
    return this.internsService.create(dto);
  }

  @Get()
  findAll(@Query() dto: ListInternsDto) {
    return this.internsService.findAll(dto);
  }

  @Get('kpi')
  getAllWithKpi() {
    return this.internsService.getAllInternsWithKpi();
  }

  @Get('saturday-roster')
  getSaturdayRoster(@Query('date') date: string) {
    return this.internsService.getSaturdayRoster(date);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.internsService.findOne(id);
  }

  @Get(':id/details')
  getDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.internsService.getInternDetails(id);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInternDto) {
    return this.internsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.internsService.remove(id);
  }

  @Post('attendance')
  recordAttendance(@Body() dto: RecordAttendanceDto) {
    return this.internsService.recordAttendance(dto);
  }

  @Post('attendance/bulk')
  bulkAttendance(@Body() dto: BulkAttendanceDto) {
    return this.internsService.bulkAttendance(dto);
  }

  @Post('saturday-roster')
  createSaturdayRoster(@Body() dto: SaturdayRosterDto) {
    return this.internsService.createSaturdayRoster(dto);
  }

  @Post('saturday-roster/presence')
  markSaturdayPresence(@Body() dto: MarkSaturdayPresenceDto) {
    return this.internsService.markSaturdayPresence(dto);
  }
}
