import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlanTier, Prisma, Role } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { PlansService } from '../services/plans.service';
import { UsageService } from '../services/usage.service';
import { QuotaService } from '../services/quota.service';
import { SubscriptionsService } from '../services/subscriptions.service';
import { UpdatePlanDto } from '../dto/update-plan.dto';

/**
 * Admin control surface for membership: edit what each tier *is*, see what
 * every user is consuming, and grant plans by hand.
 */
@ApiTags('admin-billing')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class AdminBillingController {
  constructor(
    private readonly plans: PlansService,
    private readonly usage: UsageService,
    private readonly quota: QuotaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** Full plan definitions, including the Stripe ids hidden from the public. */
  @Get('plans')
  @ApiOperation({ summary: 'All plan definitions with limits and Stripe links' })
  async listPlans() {
    return this.plans.listAll();
  }

  /**
   * Edit a tier. Every limit accepts null for "unlimited"; the DTO
   * distinguishes an omitted field from an explicit null so clearing a limit
   * is possible.
   */
  @Put('plans/:tier')
  @ApiOperation({ summary: 'Update a plan definition' })
  async updatePlan(@Param('tier') tier: string, @Body() dto: UpdatePlanDto) {
    const upper = (tier ?? '').toUpperCase() as PlanTier;
    if (!Object.values(PlanTier).includes(upper)) {
      throw new BadRequestException(`Unknown tier '${tier}'`);
    }

    if (upper === PlanTier.FREE && (dto.priceMonthlyCents ?? 0) > 0) {
      throw new BadRequestException('The Free tier cannot have a price.');
    }

    const data: Prisma.PlanUpdateInput = {};
    const assign = <K extends keyof UpdatePlanDto>(key: K) => {
      if (dto[key] !== undefined) (data as Record<string, unknown>)[key as string] = dto[key];
    };

    (
      [
        'name',
        'tagline',
        'description',
        'priceMonthlyCents',
        'priceYearlyCents',
        'currency',
        'stripeProductId',
        'stripePriceId',
        'stripeYearlyPriceId',
        'maxDocuments',
        'maxAiQuestionsPerMonth',
        'maxAlertRules',
        'maxWhatsappPerMonth',
        'maxUploadMb',
        'allowInstantAlerts',
        'isPublic',
        'sortOrder',
      ] as const
    ).forEach(assign);

    if (dto.features !== undefined) data.features = dto.features as Prisma.InputJsonValue;

    return this.plans.update(upper, data);
  }

  /** Per-user plan + usage table for the current month. */
  @Get('usage')
  @ApiOperation({ summary: 'Usage and plan for every user this month' })
  async usageOverview(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.usage.monthlyOverview(
      limit ? Number(limit) : 100,
      offset ? Number(offset) : 0,
    );
  }

  /** Everything about one user: entitlements, meters and recent activity. */
  @Get('users/:id/usage')
  @ApiOperation({ summary: 'Detailed entitlements and usage history for a user' })
  async userUsage(@Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: string) {
    const [entitlements, events] = await Promise.all([
      this.quota.entitlementsFor(id),
      this.usage.recentEvents(id, limit ? Number(limit) : 100),
    ]);
    return { userId: id, ...entitlements, events };
  }

  /** Grant a plan manually — comped accounts, staff, trials. */
  @Post('users/:id/plan')
  @ApiOperation({ summary: 'Grant a plan to a user without Stripe' })
  async grantPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('tier') tier?: string,
    @Body('note') note?: string,
  ) {
    const upper = (tier ?? '').toUpperCase() as PlanTier;
    if (!Object.values(PlanTier).includes(upper)) {
      throw new BadRequestException("tier must be 'FREE', 'PRO' or 'MAX'");
    }
    return this.subscriptions.grantPlan(id, upper, note);
  }

  /** Remove a manual grant, returning the user to Free. */
  @Delete('users/:id/plan')
  @ApiOperation({ summary: 'Revoke an admin-granted plan' })
  async revokePlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.revokeGrant(id);
  }
}
