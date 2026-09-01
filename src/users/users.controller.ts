import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }

  @Get('me/points-ledger')
  getMyLedger(@CurrentUser() user: JwtPayload) {
    return this.usersService.getPointsLedger(user.sub);
  }

  @Get('me/points-integrity')
  checkIntegrity(@CurrentUser() user: JwtPayload) {
    return this.usersService.verifyPointsIntegrity(user.sub);
  }
}
