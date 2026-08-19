import { IsString, Matches } from 'class-validator';

export class RequestWhatsappOtpDto {
  // Digits only, with optional leading "+", 8-15 digits (E.164-ish). Evolution
  // API itself wants bare digits, so this is normalized before sending.
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'Enter a valid phone number with country code, e.g. +9779812345678' })
  phoneNumber: string;
}
