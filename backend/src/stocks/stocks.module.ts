import { Module } from '@nestjs/common';
import { StocksController, AdminStocksController } from './stocks.controller';
import { PriceModule } from '../prices/price.module';

@Module({
  imports: [PriceModule],
  controllers: [StocksController, AdminStocksController],
})
export class StocksModule {}
