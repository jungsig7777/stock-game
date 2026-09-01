import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  // Render 서버의 외부 아웃바운드 IP 확인 및 로그 출력
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    console.log(`===========================================`);
    console.log(`🚀 API 서버 실행 중 (Port: ${port})`);
    console.log(`🌐 Render 서버 외부 아웃바운드 IP: ${data.ip}`);
    console.log(`===========================================`);
  } catch (error) {
    console.log(`🚀 API 서버 실행 중 (Port: ${port})`);
    console.error('❌ 외부 IP 조회 실패:', error);
  }
}
bootstrap();