import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from './sms-provider';
import { normalizePhone } from '../common/phone';

const CODE_TTL_MS = 5 * 60 * 1000; // 5분
const RESEND_COOLDOWN_MS = 60 * 1000; // 1분

@Injectable()
export class PhoneAuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    @Inject(SMS_PROVIDER) private sms: SmsProvider,
  ) {}

  async sendCode(rawPhone: string) {
    const phone = normalizePhone(rawPhone);

    const recent = await this.prisma.phoneVerification.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new BadRequestException('잠시 후 다시 시도해주세요 (1분에 한 번만 재발송 가능)');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await this.prisma.phoneVerification.create({ data: { phone, code, expiresAt } });
    await this.sms.sendMessage(phone, `[종가예측게임] 인증번호는 ${code} 입니다. 5분 이내에 입력해주세요.`);

    return { ok: true, expiresInSec: CODE_TTL_MS / 1000 };
  }

  async verifyCode(rawPhone: string, code: string) {
    const phone = normalizePhone(rawPhone);

    const record = await this.prisma.phoneVerification.findFirst({
      where: { phone, code, verified: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new BadRequestException('인증번호가 올바르지 않거나 만료됐어요');
    }

    await this.prisma.phoneVerification.update({ where: { id: record.id }, data: { verified: true } });

    // 회원가입 시 제출할, 15분만 유효한 "이 번호를 인증했다"는 증명 토큰
    const verificationToken = this.jwt.sign(
      { phone, purpose: 'phone_verified' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
    return { verificationToken };
  }

  /** 회원가입 시 이 토큰을 검증해서 실제로 인증된 번호를 꺼낸다 */
  verifyToken(token: string): string {
    try {
      const payload = this.jwt.verify<{ phone: string; purpose: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      if (payload.purpose !== 'phone_verified') throw new Error('invalid purpose');
      return payload.phone;
    } catch {
      throw new BadRequestException('휴대폰 인증이 만료됐어요. 다시 인증해주세요');
    }
  }
}
