import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AskNoticeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;
}
