import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PhoneAuthService } from './phone-auth.service';
import { SendPhoneCodeDto } from './dto/send-phone-code.dto';
import { VerifyPhoneCodeDto } from './dto/verify-phone-code.dto';

@Controller('auth/phone')
export class PhoneAuthController {
  constructor(private phoneAuthService: PhoneAuthService) {}

  @Post('send-code')
  @HttpCode(200)
  sendCode(@Body() dto: SendPhoneCodeDto) {
    return this.phoneAuthService.sendCode(dto.phone);
  }

  @Post('verify-code')
  @HttpCode(200)
  verifyCode(@Body() dto: VerifyPhoneCodeDto) {
    return this.phoneAuthService.verifyCode(dto.phone, dto.code);
  }
}
