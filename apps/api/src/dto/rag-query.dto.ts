import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, MaxLength, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class RagQueryDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'documentId must be a valid document ID (alphanumeric, dash or underscore)',
  })
  documentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;
}
