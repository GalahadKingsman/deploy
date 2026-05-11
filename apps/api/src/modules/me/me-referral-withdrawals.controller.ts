import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ReferralWithdrawalService } from '../../payments/referral-withdrawal.service.js';

@ApiTags('User')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeReferralWithdrawalsController {
  constructor(private readonly referralWithdrawals: ReferralWithdrawalService) {}

  @Post('me/referral/withdrawals')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create referral balance withdrawal request' })
  @ApiResponse({ status: 201, description: 'Created' })
  async postWithdrawal(
    @Body() body: unknown,
    @Request() request: { user?: { userId: string } },
  ): Promise<ContractsV1.PostMeReferralWithdrawalResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({ message: 'User not found in request', error: 'Unauthorized' });
    }
    const parsed = ContractsV1.PostMeReferralWithdrawalRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', errors: parsed.error.flatten() });
    }
    const req = await this.referralWithdrawals.createRequest(userId, parsed.data);
    return { ok: true, request: req };
  }

  @Get('me/referral/withdrawals')
  @ApiOperation({ summary: 'List my referral withdrawal requests' })
  @ApiResponse({ status: 200, description: 'OK' })
  async listMine(
    @Request() request: { user?: { userId: string } },
  ): Promise<ContractsV1.ListMeReferralWithdrawalsResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({ message: 'User not found in request', error: 'Unauthorized' });
    }
    const items = await this.referralWithdrawals.listMine(userId);
    return { items };
  }
}
