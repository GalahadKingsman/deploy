import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiEnvSchema, ErrorCodes, validateOrThrow } from '@tracked/shared';
import { BotTokenGuard } from './bot-token.guard.js';
import { SupportRoutingRepository } from './support-routing.repository.js';

type RegisterRoutingRequest = {
  /** message_id of the bot's post in the support supergroup. */
  outboundMessageId: number | string;
  /** Telegram user ID of the customer who initiated the support chat. */
  customerTelegramId: number | string;
};

function readGroupIdFromEnv(): string {
  const env = validateOrThrow(ApiEnvSchema, process.env);
  const raw = (env.TELEGRAM_SUPPORT_GROUP_ID ?? '').trim();
  if (!raw) {
    throw new ServiceUnavailableException({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Support group is not configured (TELEGRAM_SUPPORT_GROUP_ID)',
    });
  }
  return raw;
}

function asPositiveBigIntString(value: unknown, field: string): string {
  const s = String(value ?? '').trim();
  if (!/^-?\d+$/.test(s) || s === '-' || s === '') {
    throw new BadRequestException({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `${field} must be a numeric ID`,
    });
  }
  return s;
}

@ApiTags('Bot')
@Controller('bot/support')
@UseGuards(BotTokenGuard)
export class BotSupportController {
  constructor(private readonly routing: SupportRoutingRepository) {}

  @Post('routing')
  @ApiOperation({ summary: 'Register routing: bot post in support group → customer Telegram ID' })
  @ApiResponse({ status: 201, description: 'Routing stored' })
  async register(@Body() body: RegisterRoutingRequest): Promise<{ ok: true }> {
    const supportGroupId = readGroupIdFromEnv();
    const outboundMessageId = asPositiveBigIntString(body.outboundMessageId, 'outboundMessageId');
    const customerTelegramId = asPositiveBigIntString(body.customerTelegramId, 'customerTelegramId');
    await this.routing.upsert({ supportGroupId, outboundMessageId, customerTelegramId });
    return { ok: true };
  }

  @Get('routing/:outboundMessageId')
  @ApiOperation({ summary: 'Look up the customer Telegram ID by bot post message ID' })
  @ApiResponse({ status: 200, description: 'Routing entry' })
  async lookup(
    @Param('outboundMessageId') outboundMessageId: string,
  ): Promise<{ customerTelegramId: string }> {
    const supportGroupId = readGroupIdFromEnv();
    const id = asPositiveBigIntString(outboundMessageId, 'outboundMessageId');
    const customerTelegramId = await this.routing.findCustomer({
      supportGroupId,
      outboundMessageId: id,
    });
    if (!customerTelegramId) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Routing not found' });
    }
    return { customerTelegramId };
  }
}
