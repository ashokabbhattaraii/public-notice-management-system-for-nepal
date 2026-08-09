import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;
}
