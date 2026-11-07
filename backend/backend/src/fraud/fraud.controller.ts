import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FraudService } from './fraud.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/fraud-alerts')
export class FraudController {
  constructor(private fraudService: FraudService) {}

  @Get()
  findAll(@Query('resolved') resolved?: string) {
    const parsed = resolved === undefined ? undefined : resolved === 'true';
    return this.fraudService.findAlerts(parsed);
  }

  // 매일 새벽 배치가 자동으로 돌지만, 관리자가 바로 확인하고 싶을 때 수동 트리거
  @Post('run')
  runNow() {
    return this.fraudService.runAll();
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.fraudService.resolve(id);
  }
}
