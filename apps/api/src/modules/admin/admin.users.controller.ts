import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { PlatformRoleGuard } from '../../auth/rbac/platform-role.guard.js';
import { RequirePlatformRole } from '../../auth/rbac/require-platform-role.decorator.js';
import { UsersRepository } from '../../users/users.repository.js';

@ApiTags('Admin')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PlatformRoleGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly usersRepository: UsersRepository) {}

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
}

