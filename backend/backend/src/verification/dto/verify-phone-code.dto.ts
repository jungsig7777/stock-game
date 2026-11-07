import { IsString, Length } from 'class-validator';

export class VerifyPhoneCodeDto {
  @IsString()
  phone: string;

  @IsString()
  @Length(6, 6, { message: '인증번호는 6자리입니다' })
  code: string;
}
