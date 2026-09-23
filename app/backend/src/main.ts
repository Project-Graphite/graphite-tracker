import 'reflect-metadata';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors({
    credentials: true,
    origin: process.env.AUTH_TRUSTED_ORIGINS?.split(',') ?? [],
  });
  const frontendRoot = join(__dirname, '..', '..', 'frontend', 'dist');
  app.useStaticAssets(frontendRoot);
  await app.init();
  app
    .getHttpAdapter()
    .getInstance()
    .get(/^(?!\/api(?:\/|$)).*/, (_request: unknown, response: Response) =>
      response.sendFile(join(frontendRoot, 'index.html')),
    );
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

void bootstrap();
