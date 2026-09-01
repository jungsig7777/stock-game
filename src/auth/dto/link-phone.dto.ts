import { IsString } from 'class-validator';

export class LinkPhoneDto {
  @IsString()
  phoneVerificationToken: string;
}
