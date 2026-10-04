import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { SMS_PROVIDER, SmsProvider } from '../verification/sms-provider';

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(SMS_PROVIDER) private sms: SmsProvider,
  ) {}

  findAll() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateCouponDto, adminId: string) {
    return this.prisma.coupon.create({
      data: {
        name: dto.name,
        emoji: dto.emoji ?? '🎁',
        costPoints: dto.costPoints,
        code: dto.code,
        expiryDate: new Date(dto.expiryDate),
        stockQty: dto.stockQty,
        createdBy: adminId,
      },
    });
  }

  async delete(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다');
    await this.prisma.coupon.delete({ where: { id } });
    return { ok: true };
  }

  /** 만료까지 withinDays 이내로 남은 쿠폰 목록 (관리자 알림용) */
  async findExpiringSoon(withinDays = 30) {
    const now = new Date();
    const limit = new Date(now.getTime() + withinDays * 86400000);
    return this.prisma.coupon.findMany({
      where: { expiryDate: { gte: now, lte: limit } },
      orderBy: { expiryDate: 'asc' },
    });
  }

  /**
   * 포인트로 쿠폰 교환. 교환 시점의 코드/유효기간을 스냅샷으로 남겨서
   * 이후 관리자가 원본 쿠폰을 수정/삭제해도 이미 지급된 내역은 바뀌지 않게 한다.
   * 사용자는 이 응답으로 즉시 코드+유효기간을 확인할 수 있고,
   * 동시에 인증된 휴대폰번호로 같은 내용을 자동 문자 발송한다.
   */
  async redeem(userId: string, couponId: string) {
    let userPhone = '';

    const redemption = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
      if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다');
      if (coupon.stockQty <= 0) throw new BadRequestException('품절된 쿠폰입니다');

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
      if (!user.phone) {
        throw new BadRequestException('쿠폰 교환은 휴대폰 인증이 완료된 계정만 이용할 수 있어요. MY 탭에서 휴대폰 인증을 완료해주세요.');
      }
      if (user.points < coupon.costPoints) {
        throw new BadRequestException('보유 포인트가 부족합니다');
      }
      userPhone = user.phone;

      await tx.user.update({ where: { id: userId }, data: { points: { decrement: coupon.costPoints } } });
      await tx.pointsLedger.create({
        data: {
          userId,
          delta: -coupon.costPoints,
          reason: 'coupon_redeem',
          refType: 'coupon',
          refId: coupon.id,
        },
      });
      await tx.coupon.update({ where: { id: couponId }, data: { stockQty: { decrement: 1 } } });

      return tx.couponRedemption.create({
        data: {
          userId,
          couponId,
          codeSnapshot: coupon.code,
          expirySnapshot: coupon.expiryDate,
          costPoints: coupon.costPoints,
        },
        include: { coupon: true },
      });
    });

    // SMS 발송은 트랜잭션 밖에서 처리 (네트워크 I/O로 DB 트랜잭션을 오래 붙잡지 않기 위함).
    // 발송이 실패해도 이미 교환은 완료된 상태이므로 API 응답 자체는 그대로 성공 처리하고 로그만 남긴다.
    const expiryText = redemption.expirySnapshot.toISOString().slice(0, 10);
    const message =
      `[종가예측게임] ${redemption.coupon.name} 쿠폰이 발급됐어요.\n` +
      `쿠폰번호: ${redemption.codeSnapshot}\n` +
      `사용 포인트: ${redemption.costPoints.toLocaleString()}P\n` +
      `유효기간: ${expiryText}`;
    this.sms.sendMessage(userPhone, message).catch((err) => {
      this.logger.error(`쿠폰 발급 문자 발송 실패 (redemptionId=${redemption.id})`, err);
    });

    return redemption;
  }

  findMyRedemptions(userId: string) {
    return this.prisma.couponRedemption.findMany({
      where: { userId },
      include: { coupon: true },
      orderBy: { redeemedAt: 'desc' },
    });
  }
}
