import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { PlatformRoleGuard } from '../../auth/rbac/platform-role.guard.js';
import { RequirePlatformRole } from '../../auth/rbac/require-platform-role.decorator.js';
import { ReferralWithdrawalService } from '../../payments/referral-withdrawal.service.js';

@ApiTags('Admin')
@Controller('admin/referral-withdrawals')
@UseGuards(JwtAuthGuard, PlatformRoleGuard)
@ApiBearerAuth()
export class AdminReferralWithdrawalsController {
  constructor(private readonly referralWithdrawals: ReferralWithdrawalService) {}

  @Get()
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'List referral withdrawal requests' })
  @ApiResponse({ status: 200, description: 'OK' })
  async list(
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ): Promise<ContractsV1.ListAdminReferralWithdrawalsResponseV1> {
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw ?? '50', 10) || 50));
    const offset = Math.max(0, parseInt(offsetRaw ?? '0', 10) || 0);
    const items = await this.referralWithdrawals.listAdmin(limit, offset);
    return { items };
  }

  @Patch(':id')
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'Approve or reject a pending withdrawal' })
  @ApiResponse({ status: 200, description: 'Updated' })
  async patch(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.PatchAdminReferralWithdrawalResponseV1> {
    const adminUserId = req.user?.userId;
    if (!adminUserId) {
      throw new UnauthorizedException('Unauthorized');
    }
    const parsed = ContractsV1.PatchAdminReferralWithdrawalRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed' });
    }
    const row = await this.referralWithdrawals.adminSetStatus({
      id,
      adminUserId,
      next: parsed.data.status,
    });
    return { ok: true, request: row };
  }
}
