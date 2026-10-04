import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(private prisma: PrismaService) {}

  private async hasRecentUnresolvedAlert(type: string, userId: string | null) {
    const since = new Date(Date.now() - ONE_DAY_MS);
    const found = await this.prisma.fraudAlert.findFirst({
      where: { type, userId: userId ?? undefined, resolved: false, createdAt: { gte: since } },
    });
    return !!found;
  }

  /** users.points(캐시) 와 points_ledger 합계가 일치하는지 전수 검사 */
  async checkPointsIntegrity() {
    const users = await this.prisma.user.findMany({ select: { id: true, points: true } });

    for (const u of users) {
      const sum = await this.prisma.pointsLedger.aggregate({
        where: { userId: u.id },
        _sum: { delta: true },
      });
      const ledgerTotal = sum._sum.delta ?? 0;

      if (ledgerTotal !== u.points) {
        if (await this.hasRecentUnresolvedAlert('points_mismatch', u.id)) continue;
        await this.prisma.fraudAlert.create({
          data: {
            type: 'points_mismatch',
            severity: 'critical',
            userId: u.id,
            detail: `캐시된 포인트(${u.points})와 원장 합계(${ledgerTotal})가 일치하지 않습니다`,
          },
        });
        this.logger.warn(`🚨 포인트 불일치: user=${u.id} cached=${u.points} ledger=${ledgerTotal}`);
      }
    }
  }

  /** 예측 10건 이상 참여한 유저 중 적중률이 비정상적으로(80% 이상) 높은 경우 */
  async checkHighWinRate() {
    const grouped = await this.prisma.prediction.groupBy({
      by: ['userId'],
      where: { status: { in: ['win', 'lose'] } },
      _count: { _all: true },
    });

    for (const g of grouped) {
      const total = g._count._all;
      if (total < 10) continue;

      const wins = await this.prisma.prediction.count({
        where: { userId: g.userId, status: 'win' },
      });
      const rate = wins / total;

      if (rate >= 0.8) {
        if (await this.hasRecentUnresolvedAlert('high_win_rate', g.userId)) continue;
        await this.prisma.fraudAlert.create({
          data: {
            type: 'high_win_rate',
            severity: 'warn',
            userId: g.userId,
            detail: `최근 ${total}건 중 적중률 ${(rate * 100).toFixed(0)}% — 비정상적으로 높음, 수동 검토 권장`,
          },
        });
      }
    }
  }

  /** 특정 추천인 코드로 24시간 내 5명 이상 가입 — 어뷰징(포인트 파밍) 의심 */
  async checkReferralBurst() {
    const since = new Date(Date.now() - ONE_DAY_MS);
    const recent = await this.prisma.user.findMany({
      where: { referredBy: { not: null }, createdAt: { gte: since } },
      select: { referredBy: true },
    });

    const counts = new Map<string, number>();
    for (const r of recent) {
      if (!r.referredBy) continue;
      counts.set(r.referredBy, (counts.get(r.referredBy) ?? 0) + 1);
    }

    for (const [referrerId, count] of counts) {
      if (count < 5) continue;
      if (await this.hasRecentUnresolvedAlert('referral_burst', referrerId)) continue;
      await this.prisma.fraudAlert.create({
        data: {
          type: 'referral_burst',
          severity: 'warn',
          userId: referrerId,
          detail: `최근 24시간 동안 이 사람 추천으로 가입한 인원 ${count}명 — 어뷰징 의심, 수동 검토 권장`,
        },
      });
    }
  }

  async runAll() {
    await this.checkPointsIntegrity();
    await this.checkHighWinRate();
    await this.checkReferralBurst();
  }

  findAlerts(resolved?: boolean) {
    return this.prisma.fraudAlert.findMany({
      where: resolved === undefined ? {} : { resolved },
      orderBy: { createdAt: 'desc' },
    });
  }

  resolve(id: string) {
    return this.prisma.fraudAlert.update({ where: { id }, data: { resolved: true } });
  }
}
