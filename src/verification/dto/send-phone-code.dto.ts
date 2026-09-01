import { IsString, Matches } from 'class-validator';

export class SendPhoneCodeDto {
  @IsString()
  @Matches(/^[0-9+\-\s]{9,15}$/, { message: '올바른 휴대폰번호를 입력하세요' })
  phone: string;
}
