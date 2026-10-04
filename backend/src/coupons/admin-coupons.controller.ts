import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private couponsService: CouponsService) {}

  @Get()
  findAll() {
    return this.couponsService.findAll();
  }

  @Get('expiring')
  findExpiring(@Query('days') days?: string) {
    return this.couponsService.findExpiringSoon(days ? Number(days) : 30);
  }

  @Post()
  create(@Body() dto: CreateCouponDto, @CurrentUser() user: JwtPayload) {
    return this.couponsService.create(dto, user.sub);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.couponsService.delete(id);
  }
}
