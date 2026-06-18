import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleLoginDto {
  // The Google ID token (JWT credential) returned by @react-oauth/google on the client.
  @IsString()
  @IsNotEmpty()
  credential: string;
}
