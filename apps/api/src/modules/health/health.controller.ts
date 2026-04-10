import { BadRequestException, Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';

const env = validateOrThrow(ApiEnvSchema, process.env);

@ApiTags('Health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOkResponse({
    description: 'Health check endpoint',
    schema: {
      example: {
        ok: true,
        env: 'development',
        version: '0.0.0',
      },
    },
  })
  getHealth() {
    return {
      ok: true,
      env: env.NODE_ENV,
      version: process.env.npm_package_version || '0.0.0',
    };
  }

  // Test endpoints for error format verification (dev-only, for smoke tests)
  // These endpoints are intentionally exposed in development to allow foundation smoke tests
  // to verify error format consistency. They should NOT be used in production.
  @Get('health/error')
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      example: {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal Server Error',
        requestId: 'a4f0c291-af45-47ca-ae9d-9a54a6e59b93',
      },
    },
  })
  getError() {
    throw new Error('boom');
  }

  // Test endpoint for validation error format (dev-only, for smoke tests)
  // See comment above for health/error endpoint
  @Get('health/400')
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    schema: {
      example: {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        requestId: 'test-123',
        details: ['field1 is required', 'field2 must be a string'],
      },
    },
  })
  get400() {
    throw new BadRequestException({
      message: ['field1 is required', 'field2 must be a string'],
      error: 'Bad Request',
    });
  }
}
