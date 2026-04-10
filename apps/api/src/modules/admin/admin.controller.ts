import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { PlatformRoleGuard } from '../../auth/rbac/platform-role.guard.js';
import { RequirePlatformRole } from '../../auth/rbac/require-platform-role.decorator.js';
import { UsersRepository } from '../../users/users.repository.js';
import { AuditService } from '../../audit/audit.service.js';
import type { FastifyRequest } from 'fastify';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformRoleGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  @Get('ping')
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'Admin ping (admin+ required)' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PLATFORM_ROLE' })
  ping(): { ok: true } {
    return { ok: true };
  }

  @Post('users/:id/platform-role')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformRole('owner')
  @ApiOperation({ summary: 'Set user platform role (owner only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { role: { type: 'string', enum: ['user', 'moderator', 'admin', 'owner'] } },
      required: ['role'],
    },
  })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PLATFORM_ROLE' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async setPlatformRole(
    @Param('id') targetUserId: string,
    @Body() body: { role: string },
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ ok: true }> {
    const validation = ContractsV1.PlatformRoleV1Schema.safeParse(body?.role);
    if (!validation.success) {
      throw new BadRequestException({
        message: 'Invalid role',
        errors: validation.error.errors,
      });
    }

    const targetUser = await this.usersRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    const from = (targetUser as { platformRole?: string }).platformRole ?? 'user';
    const to = validation.data;

    await this.usersRepository.updatePlatformRole(targetUserId, to);

    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.user.platform_role.set',
      entityType: 'user',
      entityId: targetUserId,
      meta: { from, to },
      traceId: req.traceId ?? null,
    });

    return { ok: true };
  }
}
