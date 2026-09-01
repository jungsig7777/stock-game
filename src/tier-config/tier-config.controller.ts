import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Tier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { TierConfigService } from './tier-config.service';
import { UpdateTierConfigDto } from './dto/update-tier-config.dto';

// 사용자도 현재 기준(step/max)을 알아야 예측 화면을 그릴 수 있으므로 조회는 공개
@Controller('tier-config')
export class TierConfigController {
  constructor(private tierConfigService: TierConfigService) {}

  @Get()
  findAll() {
    return this.tierConfigService.findAll();
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/tier-config')
export class AdminTierConfigController {
  constructor(private tierConfigService: TierConfigService) {}

  @Put(':tier')
  update(
    @Param('tier') tier: Tier,
    @Body() dto: UpdateTierConfigDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tierConfigService.update(tier, dto, user.sub);
  }
}
