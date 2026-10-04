import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NotifyService } from './notify.service';
import { UpdateNotifySettingsDto } from './dto/update-notify-settings.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/notify')
export class AdminNotifyController {
  constructor(private notifyService: NotifyService) {}

  @Get('settings')
  getSettings() {
    return this.notifyService.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateNotifySettingsDto) {
    return this.notifyService.updateSettings(dto);
  }

  @Get('logs')
  getLogs() {
    return this.notifyService.getLogs();
  }

  // 프로토타입의 "지금 만료임박 알림 보내기" 버튼에 대응
  @Post('send-expiry-alert')
  sendNow() {
    return this.notifyService.checkAndSendExpiryAlerts();
  }
}
