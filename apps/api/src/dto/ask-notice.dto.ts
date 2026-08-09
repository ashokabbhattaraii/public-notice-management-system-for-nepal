import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChatTurnDto } from './notice-chat.dto';

export class AskNoticeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;

  /** Prior conversation turns, oldest first — lets follow-ups like "and the
   * fee?" resolve against what was already asked. Trimmed server-side. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}
