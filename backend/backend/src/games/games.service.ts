import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Tier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { isWin } from '../common/tier-rules';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  findOpen() {
    return this.prisma.game.findMany({
      where: { status: 'OPEN' },
      include: { stock: true, tierPools: true },
      orderBy: { deadlineAt: 'asc' },
    });
  }

  findAllForAdmin() {
    return this.prisma.game.findMany({
      include: { stock: true, tierPools: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: { stock: true, tierPools: true },
    });
    if (!game) throw new NotFoundException('게임을 찾을 수 없습니다');
    return game;
  }

  /**
   * 게임(회차) 생성. 선택한 각 난이도마다 별도의 투자풀을 만들고,
   * 그 난이도에 대기 중인 이월 포인트(carryoverPot)가 있으면 자동으로 시드에 합산한 뒤
   * carryoverPot 은 0으로 비운다.
   */
  async create(dto: CreateGameDto, adminId: string) {
    const stock = await this.prisma.stock.findUnique({ where: { id: dto.stockId } });
    if (!stock) throw new BadRequestException('존재하지 않는 종목입니다');

    // 정산 날짜(YYYY-MM-DD)를 그 날 한국 증시 마감(15:30 KST) + 5분 버퍼 시각으로 변환.
    // 토스증권 API가 그 시각 이후 조회하면 해당 날짜의 확정 종가를 정확히 반환한다.
    const deadlineAt = new Date(`${dto.settleDate}T15:35:00+09:00`);
    if (Number.isNaN(deadlineAt.getTime())) {
      throw new BadRequestException('정산 날짜 형식이 올바르지 않습니다');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const game = await tx.game.create({
        data: {
          stockId: dto.stockId,
          deadlineAt,
          createdBy: adminId,
        },
      });

      for (const tier of dto.tiers) {
        const pot = await tx.carryoverPot.findUnique({ where: { tier } });
        const carried = pot?.points ?? 0;

        await tx.gameTierPool.create({
          data: {
            gameId: game.id,
            tier,
            poolPoints: dto.seedPoints + carried,
            carriedInPoints: carried,
            participants: 0,
          },
        });

        if (carried > 0) {
          await tx.carryoverPot.update({ where: { tier }, data: { points: 0 } });
        }
      }

      return tx.game.findUnique({
        where: { id: game.id },
        include: { stock: true, tierPools: true },
      });
    });
  }

  async addBonus(gameId: string, tier: Tier, amount: number) {
    const pool = await this.prisma.gameTierPool.findUnique({
      where: { gameId_tier: { gameId, tier } },
    });
    if (!pool) throw new NotFoundException('해당 게임에 이 난이도 풀이 없습니다');

    return this.prisma.gameTierPool.update({
      where: { id: pool.id },
      data: { bonusPoints: { increment: amount } },
    });
  }

  /**
   * 정산 핵심 로직.
   * 난이도별로:
   *  - 적중자가 있으면: (pool + bonus) 를 적중자들의 스테이크 비율대로 정확히 분배
   *  - 적중자가 없으면: (pool + bonus) 전액을 carryoverPot 에 이월
   * 모든 포인트 지급은 pointsLedger 에도 함께 기록한다.
   */
  async settle(gameId: string, actualPct: number) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: { tierPools: true },
      });
      if (!game) throw new NotFoundException('게임을 찾을 수 없습니다');
      if (game.status === 'SETTLED') throw new BadRequestException('이미 정산된 게임입니다');

      const tierConfigs = await tx.tierConfig.findMany();
      const configMap = Object.fromEntries(
        tierConfigs.map((c) => [c.tier, { stepPct: Number(c.stepPct), maxPct: Number(c.maxPct) }]),
      );

      const summary: Array<{
        tier: Tier;
        hasWinner: boolean;
        distributed: number;
        carried: number;
        winnerCount: number;
      }> = [];

      for (const pool of game.tierPools) {
        const bounds = configMap[pool.tier];
        const totalDistributable = pool.poolPoints + pool.bonusPoints;

        const pending = await tx.prediction.findMany({
          where: { gameId, tier: pool.tier, status: 'pending' },
        });

        const winners = pending.filter((p) =>
          isWin(pool.tier, Number(p.predictedPct), actualPct, bounds),
        );
        const losers = pending.filter((p) => !winners.includes(p));

        for (const p of losers) {
          await tx.prediction.update({
            where: { id: p.id },
            data: { status: 'lose', payoutPoints: 0, settledAt: new Date() },
          });
        }

        if (winners.length > 0) {
          const totalWinnerStake = winners.reduce((s, p) => s + p.stakePoints, 0);
          let distributed = 0;

          for (const p of winners) {
            const payout = Math.round((p.stakePoints / totalWinnerStake) * totalDistributable);
            distributed += payout;

            await tx.prediction.update({
              where: { id: p.id },
              data: { status: 'win', payoutPoints: payout, settledAt: new Date() },
            });
            await tx.user.update({
              where: { id: p.userId },
              data: { points: { increment: payout } },
            });
            await tx.pointsLedger.create({
              data: {
                userId: p.userId,
                delta: payout,
                reason: 'predict_payout',
                refType: 'prediction',
                refId: p.id,
              },
            });
          }

          summary.push({
            tier: pool.tier,
            hasWinner: true,
            distributed,
            carried: 0,
            winnerCount: winners.length,
          });
        } else {
          await tx.carryoverPot.upsert({
            where: { tier: pool.tier },
            update: { points: { increment: totalDistributable } },
            create: { tier: pool.tier, points: totalDistributable },
          });

          summary.push({
            tier: pool.tier,
            hasWinner: false,
            distributed: 0,
            carried: totalDistributable,
            winnerCount: 0,
          });
        }
      }

      await tx.game.update({
        where: { id: gameId },
        data: { status: 'SETTLED', actualPct, settledAt: new Date() },
      });

      return { gameId, actualPct, tiers: summary };
    });
  }

  getCarryover() {
    return this.prisma.carryoverPot.findMany();
  }

  /** 마감 시각이 지난 OPEN 게임들을 LOCKED 로 전환한다. 스케줄러가 주기적으로 호출한다. */
  async lockExpiredGames() {
    const now = new Date();
    const expired = await this.prisma.game.findMany({
      where: { status: 'OPEN', deadlineAt: { lte: now } },
    });
    for (const g of expired) {
      await this.prisma.game.update({ where: { id: g.id }, data: { status: 'LOCKED' } });
    }
    return expired.map((g) => g.id);
  }

  /** 아직 정산 전(LOCKED)인 게임 목록. 스케줄러가 시세 조회 후 settle() 을 호출할 대상. */
  findLocked() {
    return this.prisma.game.findMany({
      where: { status: 'LOCKED' },
      include: { stock: true },
    });
  }
}
