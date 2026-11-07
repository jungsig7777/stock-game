import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { PhoneAuthService } from '../verification/phone-auth.service';

const SIGNUP_BONUS = Number(process.env.SIGNUP_BONUS_POINTS ?? 300);
const REFERRAL_NEW_BONUS = Number(process.env.REFERRAL_NEW_BONUS_POINTS ?? 200);
const REFERRAL_EXISTING_BONUS = Number(process.env.REFERRAL_EXISTING_BONUS_POINTS ?? 300);

function generateReferralCode(): string {
  // 사람이 읽기 쉬운 8자리 코드 (예: 7QK3M9XZ)
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private phoneAuthService: PhoneAuthService,
  ) {}

  private sanitize(user: any) {
    const { passwordHash, refreshTokenHash, ...safe } = user;
    return safe;
  }

  private issueAccessToken(userId: string, role: string) {
    return this.jwt.sign(
      { sub: userId, role },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m',
      },
    );
  }

  private issueRefreshToken(userId: string, role: string) {
    return this.jwt.sign(
      { sub: userId, role },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d',
      },
    );
  }

  private async issueTokenPair(userId: string, role: string) {
    const accessToken = this.issueAccessToken(userId, role);
    const refreshToken = this.issueRefreshToken(userId, role);
    // 탈취 대비: refreshToken 원문은 저장하지 않고 해시만 저장
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash } });
    return { accessToken, refreshToken };
  }

  /**
   * 회원가입.
   * - 휴대폰 인증이 반드시 완료되어 있어야 가입 가능 (어뷰징 방지 핵심 장치)
   * - 기본 가입 보너스 지급
   * - 추천인 코드가 있으면: 신규가입자 추가 보너스 + 추천인 보너스 지급
   * - 위 과정은 전부 하나의 트랜잭션으로 처리해 중간 실패 시 포인트 불일치가 생기지 않도록 한다.
   */
  async signup(dto: SignupDto) {
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('이미 가입된 이메일입니다');

    const existingNickname = await this.prisma.user.findUnique({ where: { nickname: dto.nickname } });
    if (existingNickname) throw new ConflictException('이미 사용 중인 닉네임입니다');

    // 어뷰징 방지: 휴대폰 인증을 반드시 완료해야 가입 가능.
    // 인증된 번호는 unique 제약이 걸려있어, 같은 사람이 여러 계정을 만드는 걸 DB 레벨에서 막는다.
    const verifiedPhone = this.phoneAuthService.verifyToken(dto.phoneVerificationToken);
    const already = await this.prisma.user.findUnique({ where: { phone: verifiedPhone } });
    if (already) throw new ConflictException('이미 이 휴대폰번호로 가입된 계정이 있습니다');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const referralCode = generateReferralCode();

    const user = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let referrer: { id: string } | null = null;
      if (dto.referralCode) {
        referrer = await tx.user.findUnique({ where: { referralCode: dto.referralCode } });
        if (!referrer) throw new BadRequestException('유효하지 않은 추천인 코드입니다');
      }

      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          nickname: dto.nickname,
          phone: verifiedPhone,
          privacyConsentedAt: new Date(),
          referralCode,
          referredBy: referrer?.id ?? null,
          points: SIGNUP_BONUS + (referrer ? REFERRAL_NEW_BONUS : 0),
        },
      });

      await tx.pointsLedger.create({
        data: {
          userId: created.id,
          delta: SIGNUP_BONUS,
          reason: 'signup_bonus',
        },
      });

      if (referrer) {
        await tx.pointsLedger.create({
          data: {
            userId: created.id,
            delta: REFERRAL_NEW_BONUS,
            reason: 'referral_bonus_new',
            refType: 'user',
            refId: referrer.id,
          },
        });
        await tx.user.update({
          where: { id: referrer.id },
          data: { points: { increment: REFERRAL_EXISTING_BONUS } },
        });
        await tx.pointsLedger.create({
          data: {
            userId: referrer.id,
            delta: REFERRAL_EXISTING_BONUS,
            reason: 'referral_bonus_existing',
            refType: 'user',
            refId: created.id,
          },
        });
      }

      return created;
    });

    const tokens = await this.issueTokenPair(user.id, user.role);
    return { user: this.sanitize(user), ...tokens };
  }

  /**
   * 휴대폰 미인증 상태로 만들어진 계정(예: 관리자가 직접 생성한 계정)이
   * 나중에 휴대폰을 연결할 때 사용하는 범용 유틸리티.
   * 연결 시점에 보류돼 있던 추천인 보너스가 있으면 함께 지급한다.
   */
  async linkPhone(userId: string, phoneVerificationToken: string) {
    const phone = this.phoneAuthService.verifyToken(phoneVerificationToken);

    const already = await this.prisma.user.findUnique({ where: { phone } });
    if (already) throw new ConflictException('이미 이 휴대폰번호로 가입된 계정이 있습니다');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
    if (user.phone) throw new BadRequestException('이미 휴대폰 인증이 완료된 계정이에요');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({ where: { id: userId }, data: { phone } });

      let referralGranted = false;
      if (user.referredBy) {
        const alreadyGranted = await tx.pointsLedger.findFirst({
          where: { userId, reason: 'referral_bonus_new' },
        });
        if (!alreadyGranted) {
          await tx.user.update({ where: { id: userId }, data: { points: { increment: REFERRAL_NEW_BONUS } } });
          await tx.pointsLedger.create({
            data: { userId, delta: REFERRAL_NEW_BONUS, reason: 'referral_bonus_new', refType: 'user', refId: user.referredBy },
          });
          await tx.user.update({ where: { id: user.referredBy }, data: { points: { increment: REFERRAL_EXISTING_BONUS } } });
          await tx.pointsLedger.create({
            data: { userId: user.referredBy, delta: REFERRAL_EXISTING_BONUS, reason: 'referral_bonus_existing', refType: 'user', refId: userId },
          });
          referralGranted = true;
        }
      }

      return { ok: true, phone, referralBonusGranted: referralGranted };
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');

    const tokens = await this.issueTokenPair(user.id, user.role);
    return { user: this.sanitize(user), ...tokens };
  }

  /**
   * 액세스 토큰 재발급.
   * refreshToken 자체의 서명/만료를 검증한 뒤, DB에 저장된 해시와 일치하는지 한 번 더 확인한다.
   * (로그아웃/탈취 시 refreshTokenHash 를 지우면 즉시 무효화 가능)
   */
  async refresh(refreshToken: string) {
    let payload: { sub: string; role: string };
    try {
      payload = this.jwt.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('리프레시 토큰이 유효하지 않습니다');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('로그인이 필요합니다');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) throw new UnauthorizedException('리프레시 토큰이 유효하지 않습니다');

    // 토큰 회전(rotation): 재발급할 때마다 refreshToken 자체도 새로 발급
    const tokens = await this.issueTokenPair(user.id, user.role);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { ok: true };
  }
}
