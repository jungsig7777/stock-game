import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { GamesModule } from '../games/games.module';
import { PriceModule } from '../prices/price.module';
import { NotifyModule } from '../notify/notify.module';
import { FraudModule } from '../fraud/fraud.module';

@Module({
  imports: [GamesModule, PriceModule, NotifyModule, FraudModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
