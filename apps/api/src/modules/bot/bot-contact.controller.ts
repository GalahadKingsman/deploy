import { BadRequestException, Body, Controller, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { UsersRepository } from '../../users/users.repository.js';
import { BotInternalGuard } from './bot-internal.guard.js';
import { BotTokenGuard } from './bot-token.guard.js';

type BotUpsertContactRequest = {
  telegramUserId: string;
  email?: string | null;
  phone?: string | null;
};

@ApiTags('Bot')
@Controller('bot')
@UseGuards(BotTokenGuard, BotInternalGuard)
export class BotContactController {
  constructor(private readonly usersRepository: UsersRepository) {}

  @Post('contact')
  @ApiOperation({ summary: 'Upsert contact for user by telegramUserId (internal bot endpoint)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async upsert(
    @Body() body: BotUpsertContactRequest,
  ): Promise<{ ok: true; contact: ContractsV1.MeContactV1 }> {
    const telegramUserId = String(body.telegramUserId ?? '').trim();
    if (!telegramUserId) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'telegramUserId is required' });
    }
    const user = await this.usersRepository.findByTelegramUserId(telegramUserId);
    if (!user) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });

    const parsed = ContractsV1.MeContactV1Schema.safeParse({ email: body.email, phone: body.phone });
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }

    await this.usersRepository.updateContact({
      userId: user.id,
      email: parsed.data.email ?? undefined,
      phone: parsed.data.phone ?? undefined,
    });
    const contact = await this.usersRepository.getContact(user.id);
    return { ok: true, contact };
  }
}

