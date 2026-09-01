import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { UpdateNotifySettingsDto } from './dto/update-notify-settings.dto';

const SETTINGS_ID = 'singleton';

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    private prisma: PrismaService,
    private couponsService: CouponsService,
  ) {}

  async getSettings() {
    const settings = await this.prisma.notifySettings.findUnique({ where: { id: SETTINGS_ID } });
    return (
      settings ??
      this.prisma.notifySettings.create({
        data: { id: SETTINGS_ID, telegramEnabled: false, kakaoEnabled: false },
      })
    );
  }

  async updateSettings(dto: UpdateNotifySettingsDto) {
    return this.prisma.notifySettings.upsert({
      where: { id: SETTINGS_ID },
      update: dto,
      create: { id: SETTINGS_ID, ...dto },
    });
  }

  getLogs() {
    return this.prisma.notifyLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /**
   * 텔레그램 Bot API로 실제 메시지를 전송한다.
   * https://core.telegram.org/bots/api#sendmessage
   * 발송 성공/실패 여부와 관계없이 NotifyLog에 결과를 남긴다.
   */
  private async sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      return res.ok;
    } catch (err) {
      this.logger.error('텔레그램 전송 실패', err as Error);
      return false;
    }
  }

  /**
   * 카카오 비즈메시지(알림톡)는 사전 템플릿 심사 + 발송대행사(비즈엠 등) 계약이 필요해서
   * 코드 몇 줄로 끝나지 않습니다. 여기서는 실제 서비스에서 이 지점에 발송대행사 API 호출을
   * 넣으면 된다는 걸 보여주는 자리표시자로 두고, 로그만 남깁니다.
   */
  private async sendKakao(_message: string): Promise<boolean> {
    this.logger.warn('카카오 비즈메시지는 발송대행사 연동이 필요해 아직 미구현 상태입니다 (로그만 기록)');
    return false;
  }

  /**
   * 만료 30일 이내로 남은 쿠폰을 검사해서, 켜져 있는 채널로 알림을 보낸다.
   * 스케줄러(SchedulerService)가 매일 자동으로 호출하고,
   * 관리자가 화면에서 "지금 알림 보내기"를 눌러 수동으로도 호출할 수 있다.
   */
  async checkAndSendExpiryAlerts() {
    const settings = await this.getSettings();
    const expiring = await this.couponsService.findExpiringSoon(30);

    if (expiring.length === 0) {
      return { sent: false, reason: 'no_expiring_coupons', count: 0 };
    }
    if (!settings.telegramEnabled && !settings.kakaoEnabled) {
      return { sent: false, reason: 'notify_disabled', count: expiring.length };
    }

    const lines = expiring.map((c) => {
      const days = Math.round((c.expiryDate.getTime() - Date.now()) / 86400000);
      return `- ${c.name} (${c.code}) D-${days}`;
    });
    const message = `⏰ 만료 임박 쿠폰 ${expiring.length}건\n${lines.join('\n')}`;

    let anySuccess = false;

    if (settings.telegramEnabled && settings.telegramToken && settings.telegramChatId) {
      const ok = await this.sendTelegram(settings.telegramToken, settings.telegramChatId, message);
      anySuccess = anySuccess || ok;
      await this.prisma.notifyLog.create({ data: { channel: 'telegram', message, success: ok } });
    }

    if (settings.kakaoEnabled) {
      const ok = await this.sendKakao(message);
      anySuccess = anySuccess || ok;
      await this.prisma.notifyLog.create({ data: { channel: 'kakao', message, success: ok } });
    }

    return { sent: anySuccess, count: expiring.length };
  }
}
