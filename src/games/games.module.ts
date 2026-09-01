import { Module } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { AdminGamesController } from './admin-games.controller';

@Module({
  providers: [GamesService],
  controllers: [GamesController, AdminGamesController],
  exports: [GamesService],
})
export class GamesModule {}
