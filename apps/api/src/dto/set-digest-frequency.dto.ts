import { IsEnum } from 'class-validator';
import { DigestFrequency } from '@prisma/client';

export class SetDigestFrequencyDto {
  @IsEnum(DigestFrequency)
  digestFrequency: DigestFrequency;
}
