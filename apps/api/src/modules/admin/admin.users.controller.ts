import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { PlatformRoleGuard } from '../../auth/rbac/platform-role.guard.js';
import { RequirePlatformRole } from '../../auth/rbac/require-platform-role.decorator.js';
import { UsersRepository } from '../../users/users.repository.js';
import { PasswordResetService } from '../../auth/password/password-reset.service.js';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import type { FastifyRequest } from 'fastify';

@ApiTags('Admin')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PlatformRoleGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Get()
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'List/search users (admin only)' })
  @ApiQuery({ name: 'q', required: false, description: 'Search by uuid / telegramUserId / username / name' })
  @ApiQuery({ name: 'limit', required: false, description: '1..200 (default 50)' })
  @ApiQuery({ name: 'offset', required: false, description: '>=0 (default 0)' })
  @ApiResponse({ status: 200, description: 'Users list' })
  async listUsers(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ items: Array<{ id: string; telegramUserId?: string; username?: string; firstName?: string; lastName?: string; platformRole: string; createdAt: string; updatedAt: string }> }> {
    const parsedLimit = limit != null ? Number(limit) : undefined;
    const parsedOffset = offset != null ? Number(offset) : undefined;

    const res = await this.usersRepository.adminList({
      q: q ?? undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    // Return public-ish shape (without bannedAt/contact fields)
    return {
      items: res.items.map((u) => ({
        id: u.id,
        telegramUserId: u.telegramUserId,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        platformRole: u.platformRole,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
    };
  }

  @Post(':userId/password-reset')
  @RequirePlatformRole('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create one-time password reset token (admin only)' })
  @ApiResponse({ status: 200, description: 'Reset token created' })
  async createPasswordReset(
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest & { user?: { userId?: string } },
  ): Promise<ContractsV1.AdminCreatePasswordResetResponseV1> {
    const adminUserId = (req.user?.userId ?? '').trim();
    if (!adminUserId) {
      throw new BadRequestException({
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Authentication required',
      });
    }
    const parsed = ContractsV1.AdminCreatePasswordResetRequestV1Schema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
      });
    }
    return this.passwordResetService.adminCreateResetLink({
      adminUserId,
      userId,
      ttlSeconds: parsed.data.ttlSeconds,
    });
  }
}

