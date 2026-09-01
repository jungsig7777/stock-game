import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GamesService } from '../games/games.service';
import { PriceService } from '../prices/price.service';
import { NotifyService } from '../notify/notify.service';
import { FraudService } from '../fraud/fraud.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private gamesService: GamesService,
    private priceService: PriceService,
    private notifyService: NotifyService,
    private fraudService: FraudService,
  ) {}

  /**
   * 5분마다: 마감시각이 지난 OPEN 게임을 LOCKED 로 전환.
   * (실서비스에서는 이 주기를 종목 특성에 맞춰 더 촘촘하게 잡아도 된다)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleLocking() {
    const lockedIds = await this.gamesService.lockExpiredGames();
    if (lockedIds.length > 0) {
      this.logger.log(`⏱ 마감 처리된 게임 ${lockedIds.length}건: ${lockedIds.join(', ')}`);
    }
  }

  /**
   * 5분마다(락 처리 직후 타이밍): LOCKED 상태인 게임의 종가를 시세 provider로 조회해서 자동 정산.
   * 시세 조회가 실패하면 다음 주기에 재시도되도록 그냥 넘어간다(예외를 삼켜서 배치 전체가 죽지 않게).
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAutoSettle() {
    const lockedGames = await this.gamesService.findLocked();
    for (const game of lockedGames) {
      try {
        const actualPct = await this.priceService.getClosingChangePercent({
          market: game.stock.market,
          code: game.stock.code,
        });
        const result = await this.gamesService.settle(game.id, actualPct);
        this.logger.log(
          `📊 자동 정산 완료: ${game.stock.name} (${actualPct}%) → ${JSON.stringify(result.tiers)}`,
        );
      } catch (err) {
        this.logger.error(`게임 ${game.id} 자동 정산 실패, 다음 주기에 재시도`, err as Error);
      }
    }
  }

  /** 매일 오후 7시: 만료 임박 쿠폰을 검사해서 텔레그램/카카오로 알림 */
  @Cron('0 19 * * *')
  async handleExpiryAlerts() {
    const result = await this.notifyService.checkAndSendExpiryAlerts();
    this.logger.log(`⏰ 만료임박 알림 배치 실행: ${JSON.stringify(result)}`);
  }

  /** 매일 새벽 2시: 포인트 정합성 / 이상 적중률 / 추천인 어뷰징 전수 검사 */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleFraudCheck() {
    this.logger.log('🔎 부정거래·정합성 야간 배치 시작');
    await this.fraudService.runAll();
    this.logger.log('🔎 부정거래·정합성 야간 배치 완료');
  }
}
