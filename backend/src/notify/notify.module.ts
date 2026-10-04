import { Module } from '@nestjs/common';
import { NotifyService } from './notify.service';
import { AdminNotifyController } from './notify.controller';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [CouponsModule],
  providers: [NotifyService],
  controllers: [AdminNotifyController],
  exports: [NotifyService],
})
export class NotifyModule {}
