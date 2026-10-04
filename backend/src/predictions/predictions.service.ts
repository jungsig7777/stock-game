import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Tier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitPredictionDto } from './dto/submit-prediction.dto';

const BET_COOLDOWN_MS = Number(process.env.BET_COOLDOWN_HOURS ?? 8) * 60 * 60 * 1000;
const BET_DAILY_LIMIT = Number(process.env.BET_DAILY_LIMIT ?? 3);
const ALL_TIERS: Tier[] = ['LOW', 'MID', 'HIGH'];

@Injectable()
export class PredictionsService {
  constructor(private prisma: PrismaService) {}

  async submit(userId: string, dto: SubmitPredictionDto) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const game = await tx.game.findUnique({ where: { id: dto.gameId } });
      if (!game) throw new NotFoundException('게임을 찾을 수 없습니다');
      if (game.status !== 'OPEN') {
        throw new BadRequestException('예측을 제출할 수 없는 게임입니다 (마감/정산됨)');
      }
      if (new Date() > game.deadlineAt) {
        throw new BadRequestException('마감 시간이 지난 게임입니다');
      }

      const tierPool = await tx.gameTierPool.findUnique({
        where: { gameId_tier: { gameId: dto.gameId, tier: dto.tier } },
      });
      if (!tierPool) {
        throw new BadRequestException('이 게임에서는 해당 난이도가 비활성화되어 있습니다');
      }

      const cfg = await tx.tierConfig.findUnique({ where: { tier: dto.tier } });
      if (!cfg) throw new BadRequestException('난이도 설정을 찾을 수 없습니다');
      const max = Number(cfg.maxPct);
      if (dto.predictedPct === 0) {
        throw new BadRequestException('0%(보합)은 예측할 수 없어요 — 상승/하락 중 하나를 선택해주세요');
      }
      if (Math.abs(dto.predictedPct) > max + 1e-9) {
        throw new BadRequestException(`예측값은 ±${max}% 범위 안이어야 합니다`);
      }

      // 난이도별 하루 베팅 횟수 제한(최대 3회) + 마지막 베팅 이후 쿨다운(8시간) 검사.
      // "각 난이도(초/중/고)마다 하루 8시간 간격으로 총 3회"를 하나의 규칙으로 함께 구현한다.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await tx.prediction.findMany({
        where: { userId, tier: dto.tier, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
      });
      if (recent.length >= BET_DAILY_LIMIT) {
        throw new BadRequestException(
          `이 난이도는 하루 최대 ${BET_DAILY_LIMIT}회까지만 베팅할 수 있어요. 잠시 후 다시 시도해주세요.`,
        );
      }
      if (recent.length > 0) {
        const nextAvailable = recent[0].createdAt.getTime() + BET_COOLDOWN_MS;
        if (Date.now() < nextAvailable) {
          const remainMin = Math.ceil((nextAvailable - Date.now()) / 60000);
          const h = Math.floor(remainMin / 60);
          const m = remainMin % 60;
          throw new BadRequestException(
            `이 난이도는 마지막 베팅 후 ${BET_COOLDOWN_MS / 3600000}시간이 지나야 다시 베팅할 수 있어요 (앞으로 ${h}시간 ${m}분 남음)`,
          );
        }
      }

      // 투자 포인트는 사용자가 고르는 게 아니라 난이도별로 고정(초급150/중급100/상급50 - 시드에서 설정)
      const stakePoints = cfg.fixedStake;

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
      if (user.points < stakePoints) {
        throw new BadRequestException('보유 포인트보다 많이 투자할 수 없습니다');
      }

      await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: stakePoints } },
      });
      await tx.pointsLedger.create({
        data: {
          userId,
          delta: -stakePoints,
          reason: 'predict_stake',
          refType: 'game',
          refId: dto.gameId,
        },
      });
      await tx.gameTierPool.update({
        where: { id: tierPool.id },
        data: { poolPoints: { increment: stakePoints }, participants: { increment: 1 } },
      });

      return tx.prediction.create({
        data: {
          userId,
          gameId: dto.gameId,
          tier: dto.tier,
          predictedPct: dto.predictedPct,
          stakePoints,
          status: 'pending',
        },
      });
    });
  }

  findMine(userId: string) {
    return this.prisma.prediction.findMany({
      where: { userId },
      include: { game: { include: { stock: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 난이도별 오늘 베팅 현황(횟수/다음 가능 시각)을 한 번에 반환 — 예측 화면에서 안내용으로 사용 */
  async getLimits(userId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result: Record<string, { betsToday: number; dailyLimit: number; canBet: boolean; nextAvailableAt: string | null }> = {};

    for (const tier of ALL_TIERS) {
      const recent = await this.prisma.prediction.findMany({
        where: { userId, tier, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
      });
      const betsToday = recent.length;
      let nextAvailableAt: Date | null = null;
      if (betsToday > 0) {
        nextAvailableAt = new Date(recent[0].createdAt.getTime() + BET_COOLDOWN_MS);
      }
      const cooldownPassed = !nextAvailableAt || Date.now() >= nextAvailableAt.getTime();
      const canBet = betsToday < BET_DAILY_LIMIT && cooldownPassed;

      result[tier] = {
        betsToday,
        dailyLimit: BET_DAILY_LIMIT,
        canBet,
        nextAvailableAt: canBet ? null : nextAvailableAt?.toISOString() ?? null,
      };
    }
    return result;
  }
}
