import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { ReferralAttributionRepository } from '../../users/referral-attribution.repository.js';
import { buildReferralDisplayName } from '../../users/referral-attribution.service.js';

/**
 * Public endpoint for the welcome modal on the marketing landing.
 * Returns only display name + avatar; never email/phone.
 */
@ApiTags('Referral')
@Controller()
export class PublicReferralPreviewController {
  constructor(private readonly repository: ReferralAttributionRepository) {}

  @Get('public/referral/preview')
  @ApiOperation({ summary: 'Resolve a referral code into a public display name (for landing welcome modal)' })
  @ApiResponse({ status: 200, description: 'Inviter display name (null if code unknown)' })
  async preview(@Query('code') code?: string): Promise<ContractsV1.ReferralPublicPreviewResponseV1> {
    const raw = (code ?? '').trim();
    if (!raw) return { displayName: null, avatarUrl: null };
    const row = await this.repository.findPreviewByCode(raw);
    if (!row) return { displayName: null, avatarUrl: null };
    return {
      displayName: buildReferralDisplayName({
        firstName: row.first_name,
        lastName: row.last_name,
        fallbackUserId: row.id,
      }),
      avatarUrl: row.avatar_url ?? null,
    };
  }
}
