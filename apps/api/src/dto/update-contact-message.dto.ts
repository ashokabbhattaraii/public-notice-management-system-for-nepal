import { IsEnum, IsOptional } from 'class-validator';
import { ContactMessageStatus } from '@prisma/client';

export class UpdateContactMessageDto {
  @IsOptional()
  @IsEnum(ContactMessageStatus)
  status?: ContactMessageStatus;
}
