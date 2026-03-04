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
    origin: (origin, callback) => {
      // Always allow public widget + portal origins
      const allowed = [
        ...(process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000']),
        'https://widget.aschauffeured.com.au',
        /^https:\/\/book\.[^.]+\.aschauffeured\.com\.au$/,
        /^https?:\/\/localhost(:\d+)?$/,
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      ];
      if (!origin) return callback(null, true); // server-to-server
      const ok = allowed.some((p) =>
        typeof p === 'string' ? p === origin : p.test(origin),
      );
      callback(ok ? null : new Error('CORS: origin not allowed'), ok);
    },
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
