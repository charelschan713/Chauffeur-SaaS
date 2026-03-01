import * as express from 'express';
const cookieParser = require('cookie-parser');
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
