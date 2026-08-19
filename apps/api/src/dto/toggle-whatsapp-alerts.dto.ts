import { IsBoolean } from 'class-validator';

export class ToggleWhatsappAlertsDto {
  @IsBoolean()
  enabled: boolean;
}
