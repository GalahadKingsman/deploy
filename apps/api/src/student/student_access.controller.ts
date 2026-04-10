import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyRequest } from 'fastify';
import { InvitesRepository } from './student_invites.repository.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';

@ApiTags('Access')
@Controller()
export class AccessController {
  constructor(
    private readonly invitesRepository: InvitesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
  ) {}

  @Post('invites/activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate invite by code (JWT required)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async activate(
    @Body() body: ContractsV1.ActivateInviteRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.ActivateInviteResponseV1> {
    const parsed = ContractsV1.ActivateInviteRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }
    const code = parsed.data.code.trim();
    const referralCode =
      typeof parsed.data.referralCode === 'string' && parsed.data.referralCode.trim()
        ? parsed.data.referralCode.trim()
        : null;
    const consumed = await this.invitesRepository.consume(code);
    if (!consumed) {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: 'Invite is invalid, expired, revoked, or max uses exceeded',
      });
    }
    const userId = req.user?.userId;
    if (!userId) {
      throw new ForbiddenException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    }
    await this.enrollmentsRepository.upsertActive({
      userId,
      courseId: consumed.course_id,
      accessEnd: consumed.expires_at,
      referralCode,
    });
    return { ok: true, courseId: consumed.course_id };
  }
}

