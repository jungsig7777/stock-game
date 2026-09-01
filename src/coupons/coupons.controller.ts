import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { CouponsService } from './coupons.service';

@Controller('coupons')
export class CouponsController {
  constructor(private couponsService: CouponsService) {}

  @Get()
  findAll() {
    return this.couponsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/redeem')
  redeem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.couponsService.redeem(user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/redemptions')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.couponsService.findMyRedemptions(user.sub);
  }
}
