import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateNotifySettingsDto {
  @IsOptional()
  @IsString()
  telegramToken?: string;

  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @IsOptional()
  @IsBoolean()
  telegramEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  kakaoEnabled?: boolean;
}
