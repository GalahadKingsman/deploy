import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { UsersRepository } from '../../users/users.repository.js';
import { AuditService } from '../../audit/audit.service.js';

function traceIdFrom(req: FastifyRequest & { traceId?: string }): string | null {
  const h = req.headers?.['x-request-id'];
  return (
    req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null
  );
}

@ApiTags('Expert Team')
@Controller('experts/:expertId/team')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertTeamController {
  constructor(
    private readonly expertMembersRepository: ExpertMembersRepository,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  @Post('members/by-telegram/:telegramUserId')
  @RequireExpertRole('owner')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add team member by Telegram user id (owner only)' })
  @ApiResponse({ status: 201, description: 'Member added' })
  async addByTelegram(
    @Param('expertId') expertId: string,
    @Param('telegramUserId') telegramUserId: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ member: ContractsV1.ExpertMemberV1 }> {
    const parsed = ContractsV1.AddExpertTeamMemberRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    const tg = telegramUserId.trim();
    if (!tg) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'telegramUserId required' });
    }
    const user = await this.usersRepository.findByTelegramUserId(tg);
    if (!user) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found for this Telegram id' });
    }
    const existing = await this.expertMembersRepository.findMember(expertId, user.id);
    if (existing) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'User is already a team member' });
    }
    const member = await this.expertMembersRepository.addMember({
      expertId,
      userId: user.id,
      role: parsed.data.role,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.team.add',
      entityType: 'expert',
      entityId: expertId,
      meta: { expertId, addedUserId: user.id, role: parsed.data.role, telegramUserId: tg },
      traceId: traceIdFrom(req),
    });
    return { member };
  }

  @Patch('members/:userId')
  @RequireExpertRole('owner')
  @ApiOperation({ summary: 'Change team member role (owner only)' })
  @ApiResponse({ status: 200, description: 'Updated' })
  async updateRole(
    @Param('expertId') expertId: string,
    @Param('userId') targetUserId: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ member: ContractsV1.ExpertMemberV1 }> {
    const parsed = ContractsV1.UpdateExpertTeamMemberRoleRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    const current = await this.expertMembersRepository.findMember(expertId, targetUserId);
    if (!current) {
      throw new NotFoundException({ code: ErrorCodes.EXPERT_MEMBER_NOT_FOUND, message: 'Member not found' });
    }
    if (current.role === 'owner' && parsed.data.role !== 'owner') {
      const owners = await this.expertMembersRepository.countOwners(expertId);
      if (owners <= 1) {
        throw new ForbiddenException({
          code: ErrorCodes.CONFLICT,
          message: 'Cannot demote the last owner',
        });
      }
    }
    const member = await this.expertMembersRepository.updateMemberRole(
      expertId,
      targetUserId,
      parsed.data.role,
    );
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.team.role_change',
      entityType: 'expert',
      entityId: expertId,
      meta: { expertId, userId: targetUserId, prevRole: current.role, role: parsed.data.role },
      traceId: traceIdFrom(req),
    });
    return { member };
  }

  @Delete('members/:userId')
  @RequireExpertRole('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove team member (owner only)' })
  @ApiResponse({ status: 200, description: 'Removed' })
  async remove(
    @Param('expertId') expertId: string,
    @Param('userId') targetUserId: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ ok: true }> {
    const current = await this.expertMembersRepository.findMember(expertId, targetUserId);
    if (!current) {
      throw new NotFoundException({ code: ErrorCodes.EXPERT_MEMBER_NOT_FOUND, message: 'Member not found' });
    }
    if (current.role === 'owner') {
      const owners = await this.expertMembersRepository.countOwners(expertId);
      if (owners <= 1) {
        throw new ForbiddenException({
          code: ErrorCodes.CONFLICT,
          message: 'Cannot remove the last owner',
        });
      }
    }
    await this.expertMembersRepository.removeMember(expertId, targetUserId);
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.team.remove',
      entityType: 'expert',
      entityId: expertId,
      meta: { expertId, userId: targetUserId, prevRole: current.role },
      traceId: traceIdFrom(req),
    });
    return { ok: true };
  }
}
