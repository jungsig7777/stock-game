import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { AdjustPointsDto } from './dto/adjust-points.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAllForAdmin();
  }

  @Get(':id/points-ledger')
  ledger(@Param('id') id: string) {
    return this.usersService.getPointsLedgerFor(id);
  }

  // 어뷰징 의심 등의 사유로 포인트를 회수(음수)하거나 보정 지급(양수)할 때 사용
  @Post(':id/adjust-points')
  adjustPoints(
    @Param('id') id: string,
    @Body() dto: AdjustPointsDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.adjustPoints(id, dto.delta, dto.reason, admin.sub);
  }
}
