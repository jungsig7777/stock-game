import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import axios from 'axios'; // 1. axios 임포트 추가
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet()); // 기본 보안 헤더(HSTS, XSS 방지 등) 자동 적용
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 없는 필드는 자동으로 제거 (요청 위조 방지)
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  
  // eslint-disable-next-line no-console
  console.log(`🚀 API 서버 실행 중: http://localhost:${port}`);

  // 2. 외부 IP 출력 로직 추가
  try {
    const ipCheckUrl = process.env.IP_CHECK_URL || 'https://api.ipify.org?format=json';
    const response = await axios.get(ipCheckUrl);
    // eslint-disable-next-line no-console
    console.log(`🌐 Server Outbound Public IP: ${response.data.ip}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('⚠️ IP 주소를 가져오는데 실패했습니다:', error.message);
  }
}
bootstrap();
