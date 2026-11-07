import { Equals, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다' })
  email: string;

  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다' })
  password: string;

  @IsString()
  @MinLength(1, { message: '이름을 입력해주세요' })
  name: string;

  @IsString()
  @MinLength(2, { message: '닉네임은 2자 이상이어야 합니다' })
  @MaxLength(20, { message: '닉네임은 20자 이하여야 합니다' })
  nickname: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  // 휴대폰 인증(POST /auth/phone/verify-code) 필수 - 가입 시 반드시 제출해야 함
  @IsString()
  phoneVerificationToken: string;

  // 개인정보 수집·이용 동의 (필수) - true 로 명시적으로 보내야만 가입 가능
  @Equals(true, { message: '개인정보 수집·이용에 동의해야 가입할 수 있어요' })
  privacyConsent: boolean;
}
