import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { AddBonusDto } from './dto/add-bonus.dto';
import { SettleGameDto } from './dto/settle-game.dto';
import { PriceService } from '../prices/price.service';
import { kstTime } from '../common/date-kst';
import { settleDateOf } from '../common/game-schedule';

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
    const ymd = settleDateOf(game.deadlineAt);
    // 정산일 장 마감(15:35 KST) 전에는 아직 확정 종가가 아니라서 막는다 (장중 가격으로 정산되는 사고 방지)
    if (new Date() < kstTime(ymd, 15, 35)) {
      throw new BadRequestException(`${ymd} 장 마감(15:35) 이후에 정산할 수 있어요`);
    }
    // 최신 봉이 아니라 "정산일의 봉"으로 계산 — 정산이 늦어져도 날짜가 어긋나지 않는다
    const actualPct = await this.priceService.getClosingChangePercentOn(
      { market: game.stock.market, code: game.stock.code },
      ymd,
    );
    return this.gamesService.settle(id, actualPct);
  }
}
