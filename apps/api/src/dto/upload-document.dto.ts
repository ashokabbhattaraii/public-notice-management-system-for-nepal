import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;
}
