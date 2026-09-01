import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { AddBonusDto } from './dto/add-bonus.dto';
import { SettleGameDto } from './dto/settle-game.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/games')
export class AdminGamesController {
  constructor(private gamesService: GamesService) {}

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
}
