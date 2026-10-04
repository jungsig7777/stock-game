import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PhoneAuthService } from './phone-auth.service';
import { PhoneAuthController } from './phone-auth.controller';
import { SMS_PROVIDER, MockSmsProvider } from './sms-provider';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PhoneAuthController],
  providers: [
    PhoneAuthService,
    // 실 SMS API가 준비되면 이 한 줄만 TwilioSmsProvider 등으로 교체하면 된다.
    { provide: SMS_PROVIDER, useClass: MockSmsProvider },
  ],
  exports: [PhoneAuthService, SMS_PROVIDER],
})
export class VerificationModule {}
