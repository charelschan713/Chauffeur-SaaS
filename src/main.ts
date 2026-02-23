import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const allowedOrigins = [
    'https://platform-web-rho.vercel.app',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: string) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin || '*');
      } else {
        callback(null, allowedOrigins[0]);
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,x-api-key',
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Chauffeur Platform API')
    .setDescription(
      `## Authentication

### JWT Bearer Token
Most endpoints require a JWT token obtained from \`POST /auth/login\`.
\`\`\`
Authorization: Bearer <token>
\`\`\`

### API Key (Public API)
Public booking endpoints accept an API key header:
\`\`\`
x-api-key: <your_api_key>
\`\`\`
API keys are managed in the tenant dashboard under Settings → API Keys.

## Rate Limits
- Standard: 100 requests/minute
- Booking creation: 10 requests/minute`,
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'API Key for public booking endpoints',
      },
      'API-key',
    )
    .addServer('https://chauffeur-saas-production.up.railway.app', 'Production')
    .addServer('http://localhost:3000', 'Local')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
    },
    customSiteTitle: 'Chauffeur Platform API Docs',
    customCss: `
      .swagger-ui .topbar { background: #1a1a1a; }
      .swagger-ui .topbar-wrapper img { display: none; }
      .swagger-ui .topbar-wrapper::after {
        content: '🚗 Chauffeur Platform API';
        color: white;
        font-size: 18px;
        font-weight: bold;
      }
    `,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📚 API Docs: http://localhost:${port}/docs`);
}
bootstrap();
