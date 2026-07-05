import { IsString, IsOptional, IsDateString, IsEmail, IsEnum, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { InternStatus } from '@prisma/client';

export class CreateInternDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateInternDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(InternStatus)
  status?: InternStatus;
}

export class RecordAttendanceDto {
  @IsUUID()
  internId: string;

  @IsDateString()
  date: string;

  @IsEnum(['present', 'absent', 'leave', 'compensation_leave'])
  status: 'present' | 'absent' | 'leave' | 'compensation_leave';

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BulkAttendanceDto {
  @IsDateString()
  date: string;

  records: { internId: string; status: 'present' | 'absent' | 'leave' | 'compensation_leave'; remarks?: string }[];
}

export class SaturdayRosterDto {
  @IsDateString()
  date: string;

  internIds: string[];
}

export class MarkSaturdayPresenceDto {
  @IsUUID()
  internId: string;

  @IsDateString()
  date: string;

  @IsBoolean()
  present: boolean;
}

export class ListInternsDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(InternStatus)
  status?: InternStatus;

  @IsOptional()
  @IsString()
  department?: string;
}
