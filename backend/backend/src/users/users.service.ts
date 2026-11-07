import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        phone: true,
        role: true,
        points: true,
        referralCode: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
    return user;
  }

  async getPointsLedger(userId: string) {
    return this.prisma.pointsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * 정합성 체크용: 원장(ledger) 합계와 users.points 캐시값이 일치하는지 확인.
   * 2단계 이후 배치 작업(야간 정합성 검사)에서도 재사용한다.
   */
  async verifyPointsIntegrity(userId: string) {
    const [user, sum] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { points: true } }),
      this.prisma.pointsLedger.aggregate({
        where: { userId },
        _sum: { delta: true },
      }),
    ]);
    const ledgerTotal = sum._sum.delta ?? 0;
    return {
      cachedPoints: user?.points ?? 0,
      ledgerTotal,
      isConsistent: (user?.points ?? 0) === ledgerTotal,
    };
  }

  // ---- 관리자용 ----
  findAllForAdmin() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        phone: true,
        role: true,
        points: true,
        referralCode: true,
        referredBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getPointsLedgerFor(userId: string) {
    return this.prisma.pointsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * 관리자가 어뷰징 의심 등의 사유로 특정 사용자의 포인트를 회수(또는 보정 지급)한다.
   * delta 가 음수면 회수, 양수면 지급. 보유 포인트보다 많이 회수할 수는 없고,
   * 그 경우 보유량만큼만 회수하고 실제로 얼마나 회수됐는지 응답으로 알려준다.
   * 모든 조정은 pointsLedger 에 'admin_adjustment' 사유로 남아 감사로그와 별개로 추적 가능하다.
   */
  async adjustPoints(userId: string, delta: number, reason: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');

    let applied = delta;
    if (delta < 0 && user.points + delta < 0) {
      applied = -user.points; // 보유량 이상 회수하지 않도록 클램프
    }
    if (applied === 0) {
      throw new BadRequestException('회수할 포인트가 없습니다 (보유 포인트 0)');
    }

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { points: { increment: applied } },
      });
      await tx.pointsLedger.create({
        data: {
          userId,
          delta: applied,
          reason: 'admin_adjustment',
          note: reason,
          refType: 'admin',
          refId: adminId,
        },
      });
      return u;
    });

    return {
      requested: delta,
      applied,
      clamped: applied !== delta,
      pointsAfter: updated.points,
      reason,
    };
  }
}
