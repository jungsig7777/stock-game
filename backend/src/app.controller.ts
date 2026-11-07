import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  // GET / 은 원래 아무 화면도 없는 API 서버라 404가 정상이었지만,
  // 외부 핑 서비스(UptimeRobot 등)가 주기적으로 호출할 가벼운 헬스체크가 필요해서 추가.
  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
