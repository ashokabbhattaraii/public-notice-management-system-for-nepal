import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * First line of defence for the SMTP settings form. EmailChannelService
 * re-validates everything it persists (it is also reachable from the alert
 * pipeline), but the global ValidationPipe runs `forbidNonWhitelisted`, so
 * anything not declared here is rejected before it reaches a service.
 *
 * `NO_CONTROL_CHARS` is the header-injection guard: a CR/LF in any of these
 * values would otherwise let an admin-level attacker append arbitrary SMTP
 * headers to every outgoing alert.
 */
const NO_CONTROL_CHARS = /^[^\r\n\0]*$/;

export class UpdateEmailChannelDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  @Matches(/^[a-zA-Z0-9.-]+$/, { message: 'host must be a plain hostname, e.g. smtp.gmail.com' })
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  /** true = implicit TLS (port 465); false = mandatory STARTTLS upgrade. */
  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  @Matches(NO_CONTROL_CHARS, { message: 'username contains illegal control characters' })
  username?: string;

  /** Write-only. Omitted or empty means "keep the stored password". */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(NO_CONTROL_CHARS, { message: 'password contains illegal control characters' })
  password?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  fromAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(NO_CONTROL_CHARS, { message: 'fromName contains illegal control characters' })
  fromName?: string;
}
