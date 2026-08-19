import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { AlertPriority, AlertUrgency, ScrapedItemCategory } from '@prisma/client';

export class CreateAlertRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(AlertPriority)
  priority?: AlertPriority;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  excludeKeywords?: string[];

  // Primary basis — at least one of categories/tags is required (enforced in
  // AlertsService.assertHasPrimaryDimension, since it depends on both fields
  // together and class-validator validates fields independently).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsEnum(ScrapedItemCategory, { each: true })
  categories?: ScrapedItemCategory[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  organizations?: string[];

  @IsOptional()
  @IsEnum(AlertUrgency)
  minUrgency?: AlertUrgency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  deadlineWithinDays?: number;
}
