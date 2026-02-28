import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? '*', credentials: true });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
