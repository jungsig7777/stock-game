import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { AddBonusDto } from './dto/add-bonus.dto';
import { SettleGameDto } from './dto/settle-game.dto';
import { PriceService } from '../prices/price.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/games')
export class AdminGamesController {
  constructor(
    private gamesService: GamesService,
    private priceService: PriceService,
  ) {}

  @Get()
  findAll() {
    return this.gamesService.findAllForAdmin();
  }

  @Post()
  create(@Body() dto: CreateGameDto, @CurrentUser() user: JwtPayload) {
    return this.gamesService.create(dto, user.sub);
  }

  @Post(':id/bonus')
  addBonus(@Param('id') id: string, @Body() dto: AddBonusDto) {
    return this.gamesService.addBonus(id, dto.tier, dto.amount);
  }

  @Post(':id/settle')
  settle(@Param('id') id: string, @Body() dto: SettleGameDto) {
    return this.gamesService.settle(id, dto.actualPct);
  }

  /**
   * 스케줄러가 (Render 무료 등급 슬립 등으로) 아직 못 돌았을 때, 관리자가 버튼 한 번으로
   * 토스증권 API에서 실제 등락률을 직접 가져와 즉시 정산할 수 있게 하는 엔드포인트.
   * 사람이 등락률을 손으로 입력할 필요가 없어서 오타/빈칸 실수도 원천적으로 막아준다.
   */
  @Post(':id/settle-auto')
  async settleAuto(@Param('id') id: string) {
    const game = await this.gamesService.findOne(id);
    const actualPct = await this.priceService.getClosingChangePercent({
      market: game.stock.market,
      code: game.stock.code,
    });
    return this.gamesService.settle(id, actualPct);
  }
}
