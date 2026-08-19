import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { AlertPriority, AlertUrgency, ScrapedItemCategory } from '@prisma/client';

export class UpdateAlertRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

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
  minUrgency?: AlertUrgency | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  deadlineWithinDays?: number | null;
}
