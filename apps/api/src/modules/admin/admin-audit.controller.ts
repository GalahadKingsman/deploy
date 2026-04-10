import { Controller, Get, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { PlatformRoleGuard } from '../../auth/rbac/platform-role.guard.js';
import { RequirePlatformRole } from '../../auth/rbac/require-platform-role.decorator.js';
import { AuditRepository } from '../../audit/audit.repository.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Accepts canonical RFC 4122 UUID (8-4-4-4-12 hex, any version e.g. v4/v7). */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates cursor string; throws BadRequestException (400 VALIDATION_ERROR) on invalid base64,
 * malformed JSON, missing createdAt/id, invalid date or id format.
 * All error messages are API-only (not in shared).
 */
function parseAndValidateCursor(cursor: string): { createdAt: string; id: string } {
  let json: string;
  try {
    json = Buffer.from(cursor, 'base64').toString('utf-8');
  } catch {
    throw new BadRequestException({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid cursor (bad encoding)',
    });
  }
  let parsed: { createdAt?: unknown; id?: unknown };
  try {
    parsed = JSON.parse(json) as { createdAt?: unknown; id?: string };
  } catch {
    throw new BadRequestException({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid cursor (bad format)',
    });
  }
  if (typeof parsed?.createdAt !== 'string' || typeof parsed?.id !== 'string') {
    throw new BadRequestException({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid cursor (missing createdAt or id)',
    });
  }
  const createdAt = parsed.createdAt;
  const id = parsed.id;
  const dateMs = Date.parse(createdAt);
  if (!Number.isFinite(dateMs)) {
    throw new BadRequestException({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid cursor (invalid date)',
    });
  }
  if (!UUID_REGEX.test(id)) {
    throw new BadRequestException({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid cursor (invalid id)',
    });
  }
  return { createdAt, id };
}

@ApiTags('Admin')
@Controller('admin/audit')
@UseGuards(JwtAuthGuard, PlatformRoleGuard)
@ApiBearerAuth()
export class AdminAuditController {
  constructor(private readonly auditRepository: AuditRepository) {}

  @Get()
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'List audit log (admin only, cursor pagination)' })
  @ApiResponse({ status: 200, description: 'Audit log list' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PLATFORM_ROLE' })
  async list(
    @Query('actorUserId') actorUserId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('traceId') traceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ContractsV1.AuditLogListResponseV1> {
    let limit = DEFAULT_LIMIT;
    if (limitStr !== undefined && limitStr !== '') {
      const parsed = parseInt(limitStr, 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: `limit must be between 1 and ${MAX_LIMIT}`,
        });
      }
      limit = parsed;
    }

    let cursorDecoded: { createdAt: string; id: string } | undefined;
    if (cursor !== undefined && cursor !== '') {
      cursorDecoded = parseAndValidateCursor(cursor);
    }

    const result = await this.auditRepository.list({
      actorUserId: actorUserId ?? undefined,
      action: action ?? undefined,
      entityType: entityType ?? undefined,
      entityId: entityId ?? undefined,
      traceId: traceId ?? undefined,
      from: from ?? undefined,
      to: to ?? undefined,
      limit,
      cursorDecoded,
    });

    const response: ContractsV1.AuditLogListResponseV1 = {
      items: result.items as ContractsV1.AuditLogEntryV1[],
      ...(result.nextCursor !== undefined && { nextCursor: result.nextCursor }),
    };
    const parsed = ContractsV1.AuditLogListResponseV1Schema.safeParse(response);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid response shape',
        errors: parsed.error.errors,
      });
    }
    return parsed.data as ContractsV1.AuditLogListResponseV1;
  }

  @Get('actions')
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'List distinct audit actions (admin only)' })
  @ApiResponse({ status: 200, description: 'List of action strings' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PLATFORM_ROLE' })
  async listActions(): Promise<{ items: string[] }> {
    const items = await this.auditRepository.listActions(200);
    return { items };
  }
}
