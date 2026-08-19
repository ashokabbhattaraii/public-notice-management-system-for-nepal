import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { QuotaService } from '../services/quota.service';
import { AlertsService } from '../services/alerts.service';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from '../dto/update-alert-rule.dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly quota: QuotaService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.alertsService.findAllForUser(user.id);
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateAlertRuleDto) {
    // Alert rules are a stock, not a flow: the plan caps how many a user
    // holds, so deleting one frees a slot.
    await this.quota.assertCanAddAlertRule(user.id);
    return this.alertsService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alertsService.update(user.id, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.alertsService.remove(user.id, id);
    return { message: 'Alert rule deleted' };
  }
}
