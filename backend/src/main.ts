import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import axios from 'axios'; // 1. axios 임포트 추가

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet()); 
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, 
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 2. 서버가 실행될 때 외부 공인 IP를 조회해서 로그에 출력
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    console.log(`🌐 Server Outbound Public IP: ${response.data.ip}`);
  } catch (error) {
    console.error('Failed to fetch outbound IP', error.message);
  }

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 API 서버 실행 중: http://localhost:${port}`);
}
bootstrap();