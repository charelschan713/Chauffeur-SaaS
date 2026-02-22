import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
  });

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('Chauffeur Platform API')
    .setDescription(
      'Public API for integrating chauffeur booking into your website.\n\n' +
        '## Authentication\n' +
        'All endpoints require an `X-API-Key` header.\n' +
        'Generate your API key in the platform dashboard under Settings → API Keys.\n\n' +
        '## Quick Start\n' +
        '1. Get your API key from the dashboard\n' +
        '2. Call `GET /v1/vehicles` to see available vehicle classes\n' +
        '3. Call `GET /v1/quote` to get a price estimate\n' +
        '4. Call `POST /v1/bookings` to create a booking',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      'X-API-Key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Chauffeur API Docs',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`✅ API running on port ${port}`);
  console.log(`📚 API Docs: http://localhost:${port}/docs`);
}
bootstrap();
