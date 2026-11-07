import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
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
}
bootstrap();
