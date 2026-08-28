import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { AppModule } from './app.module';
import { AppConfigShape, appConfig } from './config/app.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the Vite SPA (dev/preview) and the deployed frontends to call the
  // API from the browser. `credentials: true` is set so future cookie-based
  // auth works without revisiting CORS — current JWT-in-header flow is
  // unaffected.
  app.enableCors({
    origin: [
      'http://localhost:5173', // Vite dev (local)
      'http://localhost:4173', // Vite preview
      /\.dev\.vivaideapad\.com$/, // staging
      /\.vivaideapad\.com$/, // prod
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api/v1', {
    exclude: [],
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ZodValidationPipe());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Viva IdeaPad API')
    .setDescription(
      'Modular REST API for the Viva IdeaPad platform — auth, public portal, contributor workspace, and admin backend.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Health', 'Liveness + readiness probes')
    .addTag('Auth', 'Sign-in, refresh, sign-out, password management')
    .addTag('Public', 'Public browse endpoints')
    .addTag('Contributor', 'Contributor workspace endpoints')
    .addTag('Uploads', 'File attachment upload + serving')
    .addTag('Admin', 'Administration portal endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = (appConfig() as AppConfigShape).port;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  const url = await app.getUrl();
  logger.log(`Application is running on: ${url}/api/v1`);
  logger.log(`Swagger UI:      ${url}/api/docs`);
  logger.log(`OpenAPI JSON:    ${url}/api/docs-json`);
  logger.log(`Health probe:    ${url}/api/v1/health`);
}
void bootstrap();
