import { Module } from '@nestjs/common';
import { PriceService, PRICE_PROVIDER, MockPriceProvider } from './price.service';
import { TossPriceProvider } from './toss-price.provider';

@Module({
  providers: [
    PriceService,
    TossPriceProvider,
    MockPriceProvider,
    {
      provide: PRICE_PROVIDER,
      // TOSS_CLIENT_ID/SECRET 이 .env 에 채워져 있으면 자동으로 실제 토스증권 시세를 쓰고,
      // 없으면 개발용 MockPriceProvider 로 자동 대체된다. price.module.ts 를 다시 손댈 필요 없음.
      useFactory: (toss: TossPriceProvider, mock: MockPriceProvider) => {
        const hasTossKeys = !!process.env.TOSS_CLIENT_ID && !!process.env.TOSS_CLIENT_SECRET;
        return hasTossKeys ? toss : mock;
      },
      inject: [TossPriceProvider, MockPriceProvider],
    },
  ],
  exports: [PriceService],
})
export class PriceModule {}
