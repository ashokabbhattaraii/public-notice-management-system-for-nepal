import { IsString, Length } from 'class-validator';

export class VerifyWhatsappOtpDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
