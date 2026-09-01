import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';

@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('check-in')
  checkIn(@CurrentUser() user: JwtPayload) {
    return this.attendanceService.checkIn(user.sub);
  }

  @Get('me')
  getStatus(@CurrentUser() user: JwtPayload) {
    return this.attendanceService.getStatus(user.sub);
  }
}
