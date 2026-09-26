import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.setGlobalPrefix('api/v1');
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.set({
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      ...(request.secure ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
    });
    next();
  });
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
  app.useStaticAssets(join(frontendRoot, 'assets'), {
    prefix: '/assets',
    immutable: true,
    maxAge: '1y',
  });
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
