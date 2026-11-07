import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GamesService } from '../games/games.service';
import { PriceService } from '../prices/price.service';
import { NotifyService } from '../notify/notify.service';
import { FraudService } from '../fraud/fraud.service';
import { SETTLE_CRON, SETTLE_RETRY_CRON, settleAtOf, settleDateOf } from '../common/game-schedule';

// 서버(Render)는 UTC 라서, 시각이 정해진 작업은 반드시 한국 시간대를 명시해야 한다.
const KST = { timeZone: 'Asia/Seoul' } as const;

@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;

  constructor(
    private gamesService: GamesService,
    private priceService: PriceService,
    private notifyService: NotifyService,
    private fraudService: FraudService,
  ) {}

  /**
   * 서버가 (무료 호스팅 슬립에서) 깨어나거나 재시작됐을 때: 정산 시각이 이미 지났는데
   * 아직 정산 안 된 게임이 있으면 따라잡는다. 대상이 없으면 아무것도 하지 않는다.
   */
  onApplicationBootstrap() {
    setTimeout(() => {
      this.settleDueGames('boot').catch((e) => this.logger.error('부팅 시 정산 확인 실패', e as Error));
    }, 15_000);
  }

  /** 매일 18:30(KST) — 하루 1회 정산. 이 시각에 토스증권 확정 종가를 가져온다. */
  @Cron(SETTLE_CRON, KST)
  async handleDailySettlement() {
    await this.settleDueGames('daily 18:30');
  }

  /** 19:30(KST) — 18:30 정산이 실패/누락된 게임만 다시 시도. 대상이 없으면 토스를 호출하지 않는다. */
  @Cron(SETTLE_RETRY_CRON, KST)
  async handleSettlementRetry() {
    await this.settleDueGames('retry 19:30');
  }

  /** 매일 00:00(KST) — 베팅 마감이 지난 게임을 LOCKED 로 전환 (DB 작업만, 외부 API 호출 없음) */
  @Cron('0 0 * * *', KST)
  async handleBettingCutoff() {
    const ids = await this.gamesService.lockExpiredGames();
    if (ids.length) this.logger.log(`🔒 베팅 마감 처리: ${ids.length}건`);
  }

  /** 정산 시각(정산일 18:30 KST)이 지난 미정산 게임을 모두 정산한다. (여러 번 불려도 안전: 이미 정산된 건 건드리지 않음) */
  async settleDueGames(trigger: string) {
    if (this.running) {
      this.logger.warn(`정산 작업이 이미 실행 중이라 건너뜀 (${trigger})`);
      return;
    }
    this.running = true;
    try {
      await this.gamesService.lockExpiredGames();

      const now = new Date();
      const unsettled = await this.gamesService.findUnsettled();
      const due = unsettled.filter((g) => now >= settleAtOf(g.deadlineAt));
      if (due.length === 0) {
        this.logger.log(`🕠 [${trigger}] 정산할 게임 없음`);
        return;
      }
      this.logger.log(`🕠 [${trigger}] 정산 대상 ${due.length}건`);

      // 같은 종목·같은 날짜는 토스 호출을 1번만 한다
      const cache = new Map<string, number | Error>();
      for (const game of due) {
        const ymd = settleDateOf(game.deadlineAt);
        const key = `${game.stock.code}|${ymd}`;
        try {
          let cached = cache.get(key);
          if (cached === undefined) {
            try {
              cached = await this.priceService.getClosingChangePercentOn(
                { market: game.stock.market, code: game.stock.code },
                ymd,
              );
            } catch (e) {
              cached = e as Error;
            }
            cache.set(key, cached);
          }
          if (cached instanceof Error) throw cached;

          const result = await this.gamesService.settle(game.id, cached);
          this.logger.log(`📊 자동 정산 완료: ${game.stock.name} ${ymd} (${cached}%) → ${JSON.stringify(result.tiers)}`);
        } catch (err) {
          this.logger.error(`정산 실패: ${game.stock.name} ${ymd} (gameId=${game.id}) — 다음 확인 때 재시도`, err as Error);
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** 매일 오후 7시(KST): 만료 임박 쿠폰을 검사해서 텔레그램/카카오로 알림 */
  @Cron('0 19 * * *', KST)
  async handleExpiryAlerts() {
    const result = await this.notifyService.checkAndSendExpiryAlerts();
    this.logger.log(`⏰ 만료임박 알림 배치 실행: ${JSON.stringify(result)}`);
  }

  /** 매일 새벽 2시(KST): 포인트 정합성 / 이상 적중률 / 추천인 어뷰징 전수 검사 */
  @Cron('0 2 * * *', KST)
  async handleFraudCheck() {
    this.logger.log('🔎 부정거래·정합성 야간 배치 시작');
    await this.fraudService.runAll();
    this.logger.log('🔎 부정거래·정합성 야간 배치 완료');
  }
}
