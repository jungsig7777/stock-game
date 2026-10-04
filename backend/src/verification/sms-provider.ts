import { Injectable, Logger } from '@nestjs/common';

export interface SmsProvider {
  /** 임의의 문자 메시지를 발송한다 (인증번호, 쿠폰 정보 등 범용) */
  sendMessage(phone: string, message: string): Promise<void>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';

/**
 * 실 SMS API 키가 아직 없는 개발 단계용 목(mock) provider.
 * 실제로 문자를 보내는 대신 서버 로그에 메시지를 출력한다.
 * 실 서비스 배포 전에는 Twilio / 알리고 / NHN Cloud(Toast) 같은 실제 SMS API로 교체해야 한다.
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async sendMessage(phone: string, message: string): Promise<void> {
    this.logger.warn(`[MOCK SMS] ${phone} 로 문자 발송: "${message}" (실 SMS 미연동 - 개발용 콘솔 출력)`);
  }
}

/*
 * 실 API 연동 예시 스켈레톤 (Twilio 기준)
 *
 * @Injectable()
 * export class TwilioSmsProvider implements SmsProvider {
 *   private client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
 *   async sendMessage(phone: string, message: string) {
 *     await this.client.messages.create({
 *       to: phone,
 *       from: process.env.TWILIO_FROM_NUMBER,
 *       body: message,
 *     });
 *   }
 * }
 */
