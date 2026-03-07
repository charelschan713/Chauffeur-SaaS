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
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Always allow public widget + portal origins
      const allowed = [
        ...(process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000']),
        // ASChauffeured official site
        'https://aschauffeured.com.au',
        'https://www.aschauffeured.com.au',
        // Legacy widget subdomain
        'https://widget.aschauffeured.com.au',
        // SaaS customer portal (all tenant subdomains)
        /^https:\/\/[^.]+\.chauffeurssolution\.com$/,
        // Vercel preview deployments
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/book\.[^.]+\.aschauffeured\.com\.au$/,
        /^https?:\/\/localhost(:\d+)?$/,
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      ];
      if (!origin) return callback(null, true); // server-to-server
      const normalised = origin.replace(/\/+$/, ''); // strip trailing slashes
      const ok = allowed.some((p) =>
        typeof p === 'string' ? p === normalised : p.test(normalised),
      );
      if (!ok) console.error(`[CORS] Blocked origin: "${origin}"`);
      callback(ok ? null : new Error('CORS: origin not allowed'), ok);
    },
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
