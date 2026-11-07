import { Controller, Get, Param } from '@nestjs/common';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private gamesService: GamesService) {}

  @Get()
  findOpen() {
    return this.gamesService.findOpen();
  }

  @Get('carryover')
  getCarryover() {
    return this.gamesService.getCarryover();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gamesService.findOne(id);
  }
}
