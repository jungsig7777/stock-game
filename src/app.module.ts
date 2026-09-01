import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { PredictionsModule } from './predictions/predictions.module';
import { TierConfigModule } from './tier-config/tier-config.module';
import { CouponsModule } from './coupons/coupons.module';
import { NotifyModule } from './notify/notify.module';
import { PriceModule } from './prices/price.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AuditModule } from './audit/audit.module';
import { FraudModule } from './fraud/fraud.module';
import { StocksModule } from './stocks/stocks.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AttendanceModule } from './attendance/attendance.module';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // 1분에 IP당 120회 초과 요청은 429로 차단 (포인트/쿠폰이 걸린 API라 기본값보다 보수적으로 설정)
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    GamesModule,
    PredictionsModule,
    TierConfigModule,
    CouponsModule,
    NotifyModule,
    PriceModule,
    SchedulerModule,
    AuditModule,
    FraudModule,
    StocksModule,
    AnnouncementsModule,
    AttendanceModule,
    VerificationModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
