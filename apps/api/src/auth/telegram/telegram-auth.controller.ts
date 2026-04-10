import { Controller, Post, Body, BadRequestException, HttpCode, Logger, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { TelegramAuthService } from './telegram-auth.service.js';
import type { FastifyRequest } from 'fastify';

@ApiTags('Auth')
@Controller()
export class TelegramAuthController {
  private readonly logger = new Logger(TelegramAuthController.name);

  constructor(private readonly telegramAuthService: TelegramAuthService) {}

  @Post('auth/telegram')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate with Telegram WebApp initData' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        initData: {
          type: 'string',
          description: 'Telegram WebApp initData string',
          example: 'query_id=...&user=...&auth_date=...&hash=...',
        },
      },
      required: ['initData'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          description: 'User data',
        },
        accessToken: {
          type: 'string',
          description: 'JWT access token',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Malformed initData or missing required fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid signature or expired auth_date',
  })
  @ApiResponse({
    status: 403,
    description: 'User is banned (USER_BANNED)',
  })
  async telegramAuth(
    @Body() dto: ContractsV1.AuthTelegramRequestV1,
    @Req() req: FastifyRequest & { traceId?: string },
  ): Promise<ContractsV1.AuthTelegramResponseV1> {
    const initDataLength = typeof dto?.initData === 'string' ? dto.initData.length : 0;
    this.logger.log(`POST /auth/telegram received, initData length=${initDataLength}`);

    // Validate request body
    const validation = ContractsV1.AuthTelegramRequestV1Schema.safeParse(dto);
    if (!validation.success) {
      this.logger.warn(
        `POST /auth/telegram validation failed: ${JSON.stringify(validation.error.errors)}`,
      );
      throw new BadRequestException({
        message: 'Validation failed',
        errors: validation.error.errors,
      });
    }

    const requestContext = {
      traceId: req.traceId,
      path: req.url ?? '/auth/telegram',
      method: req.method ?? 'POST',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
    const result = await this.telegramAuthService.verifyAndUpsert(
      validation.data.initData,
      requestContext,
    );
    this.logger.log(
      `POST /auth/telegram success, userId=${result.user.id}, telegramUserId=${result.user.telegramUserId}`,
    );
    return result;
  }
}
