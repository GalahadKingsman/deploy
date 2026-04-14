import './load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import { AppModule } from './app.module.js';
import { createPinoLogger } from './common/logging/pino.js';
import { requestIdPlugin } from './common/request-id/request-id.plugin.js';
import { RequestIdInterceptor } from './common/request-id/request-id.interceptor.js';
import { ApiExceptionFilter } from './common/errors/api-exception.filter.js';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import Redis from 'ioredis';

async function bootstrap() {
  const env = validateOrThrow(ApiEnvSchema, process.env);

  const logger = createPinoLogger(env.NODE_ENV);

  // Enable ignoreTrailingSlash to handle both /docs and /docs/ routes
  const adapter = new FastifyAdapter({ logger, ignoreTrailingSlash: true });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: false,
  });

  // Security headers (safe defaults for API; do not set CSP here)
  await (app.getHttpAdapter().getInstance() as any).register(helmet as any, {
    global: true,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // Global rate limit (basic abuse protection; tune via env)
  const max = Number.isFinite(env.RATE_LIMIT_MAX as any) ? Number(env.RATE_LIMIT_MAX) : 120;
  const timeWindow = Number.isFinite(env.RATE_LIMIT_WINDOW_MS as any)
    ? Number(env.RATE_LIMIT_WINDOW_MS)
    : 60_000;
  const redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;
  await (app.getHttpAdapter().getInstance() as any).register(rateLimit as any, {
    global: true,
    max,
    timeWindow,
    ...(redis ? { redis } : {}),
    // Payment provider server-to-server callbacks must not consume user rate limits
    skip: (req: { raw?: { url?: string } }) => {
      const u = req.raw?.url ?? '';
      return u.startsWith('/payments/tinkoff/notification');
    },
    // We already have x-request-id; use it to correlate throttles in logs
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });

  // Multipart uploads (used for submission files)
  await (app.getHttpAdapter().getInstance() as any).register(multipart as any, {
    limits: {
      // iPhone photos (jpeg) are often >10MB; keep reasonably high to avoid "Load failed" in WebView.
      fileSize: 25 * 1024 * 1024, // 25MB
      files: 1,
    },
  });

  // Register request-id plugin early (onRequest) so traceId is set before guards
  await app.getHttpAdapter().getInstance().register(requestIdPlugin);

  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  // CORS: dev is permissive; production can be restricted via CORS_ORIGINS
  const isProd = env.NODE_ENV === 'production';
  const allowedOrigins = isProd && env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : null;

  app.enableCors({
    origin: allowedOrigins && allowedOrigins.length ? allowedOrigins : true, // reflect in dev
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'x-expert-id',
      'x-telegram-bot-token',
      'x-bot-internal-token',
    ],
    credentials: true,
  });

  // Swagger enabled only if:
  // 1. NODE_ENV !== 'production' (hard gate - never in production)
  // 2. SWAGGER_ENABLED === true (explicitly enabled)
  const swaggerEnabled = !isProd && env.SWAGGER_ENABLED === true;

  if (swaggerEnabled) {
    // Register static files for Swagger UI (required for Fastify)

    // Find swagger-ui-dist in pnpm structure
    let swaggerUiPath: string | undefined;

    // Try pnpm structure first (most common with pnpm)
    const pnpmPath = join(
      process.cwd(),
      'node_modules/.pnpm/swagger-ui-dist@5.31.0/node_modules/swagger-ui-dist',
    );
    if (existsSync(pnpmPath)) {
      swaggerUiPath = pnpmPath;
    } else {
      // Fallback: try to find any swagger-ui-dist in .pnpm
      const pnpmDir = join(process.cwd(), 'node_modules/.pnpm');
      if (existsSync(pnpmDir)) {
        const dirs = readdirSync(pnpmDir);
        const swaggerDir = dirs.find((d: string) => d.startsWith('swagger-ui-dist@'));
        if (swaggerDir) {
          const foundPath = join(pnpmDir, swaggerDir, 'node_modules/swagger-ui-dist');
          if (existsSync(foundPath)) {
            swaggerUiPath = foundPath;
          }
        }
      }
      // Last fallback: direct node_modules
      if (!swaggerUiPath) {
        swaggerUiPath = join(process.cwd(), 'node_modules/swagger-ui-dist');
      }
    }

    // Register static files if path exists
    // Note: SwaggerModule.setup already handles static files, so we skip manual registration
    // to avoid route conflicts
    if (swaggerUiPath && existsSync(swaggerUiPath)) {
      logger.info('Swagger UI static files path found (handled by SwaggerModule)');
    } else {
      logger.warn('Swagger UI static files path not found');
    }

    const config = new DocumentBuilder()
      .setTitle('tracked-lms API')
      .setDescription('Telegram Mini App backend')
      .setVersion(process.env.npm_package_version || '0.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
        'bearer',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/docs', app, document);
  }

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
