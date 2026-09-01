import { Module } from '@nestjs/common';
import { TierConfigService } from './tier-config.service';
import { TierConfigController, AdminTierConfigController } from './tier-config.controller';

@Module({
  providers: [TierConfigService],
  controllers: [TierConfigController, AdminTierConfigController],
  exports: [TierConfigService],
})
export class TierConfigModule {}
