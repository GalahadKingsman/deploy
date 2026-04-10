import { Controller, Get, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';

@ApiTags('User')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeExpertMembershipsController {
  constructor(private readonly expertMembersRepository: ExpertMembersRepository) {}

  @Get('me/expert-memberships')
  @ApiOperation({ summary: 'List my expert memberships (for /expert entry)' })
  @ApiResponse({ status: 200, description: 'List of memberships' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(
    @Request() request: { user?: { userId: string } },
  ): Promise<ContractsV1.MeExpertMembershipsResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new BadRequestException({
        code: ErrorCodes.UNAUTHORIZED,
        message: 'User not found in request',
      });
    }
    const items = await this.expertMembersRepository.listMembershipsByUserId(userId);
    return { items };
  }
}

