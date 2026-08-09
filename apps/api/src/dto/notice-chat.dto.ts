import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatTurnDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  // Assistant turns can be long; they are trimmed server-side before reaching
  // the model, but the cap stops a client from posting an unbounded payload.
  @IsString()
  @MaxLength(4000)
  content: string;
}

export class NoticeChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  language?: string;

  /**
   * The notice the user currently has open, if any. Whether the question is
   * actually *about* that notice is decided server-side — see
   * NoticesService.routeChat.
   */
  @IsOptional()
  @IsUUID()
  noticeId?: string;

  /** Prior turns, oldest first. Only the most recent few are used. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}
