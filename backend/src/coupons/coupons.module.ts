import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { AdminCouponsController } from './admin-coupons.controller';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [VerificationModule],
  providers: [CouponsService],
  controllers: [CouponsController, AdminCouponsController],
  exports: [CouponsService],
})
export class CouponsModule {}
