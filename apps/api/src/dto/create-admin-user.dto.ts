import { IsEmail, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Role, UserStatus } from '@prisma/client';

export class CreateAdminUserDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
