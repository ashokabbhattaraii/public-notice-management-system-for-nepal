import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  // multipart fields arrive as strings ("true"/"false"); only admins can
  // actually set this — enforced in the controller, not here.
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isSystem?: boolean;
}
