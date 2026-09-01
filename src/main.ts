import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';

import { AppModule } from './app.module';
import { AppConfigShape, appConfig } from './config/app.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // In production force `Secure` cookies on even if the operator forgot to
  // set COOKIE_SECURE — non-secure cookies over HTTPS leak on every request.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_SECURE === undefined
  ) {
    process.env.COOKIE_SECURE = 'true';
  }

  const app = await NestFactory.create(AppModule);

  // Hydrate `req.cookies` for the JWT strategies. Must run before any guard
  // executes — NestJS resolves them at request time, not at boot time.
  app.use(cookieParser());

  // Explicit origins + credentials: cookies + wildcard origins are rejected
  // by Chrome/Safari. The wildcard subdomain entries previously allowed here
  // were never being honored for cookie-bearing requests.
  app.enableCors({
    origin: [
      'http://localhost:5173', // Vite dev (local)
      'http://localhost:4173', // Vite preview
      'https://admin.dev.vivaideapad.com',
      'https://admin.vivaideapad.com',
      'https://creator.dev.vivaideapad.com',
      'https://creator.vivaideapad.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // `Accept` and `Cache-Control` are required by the browser EventSource
    // implementation; `Last-Event-ID` is sent on reconnect (we reserve it
    // for a Phase 2 replay feature).
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Cache-Control',
      'Last-Event-ID',
    ],
    exposedHeaders: ['Last-Event-ID'],
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
    .addCookieAuth(
      'vivaideapad.access',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'vivaideapad.access',
        description:
          'HttpOnly access-token cookie. Set by /auth/sign-in and /auth/refresh; never readable from JavaScript.',
      },
      'access-cookie',
    )
    .addCookieAuth(
      'vivaideapad.refresh',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'vivaideapad.refresh',
        description:
          'HttpOnly refresh-token cookie. Rotated on every /auth/refresh call.',
      },
      'refresh-cookie',
    )
    .addCookieAuth(
      'vivaideapad.session',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'vivaideapad.session',
        description:
          'Non-secret session hint. JS-readable; carries { uid, role, exp } for SPA bootstrap only.',
      },
      'session-cookie',
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
