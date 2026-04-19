import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  Logger,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../session/jwt-auth.guard.js';
import { SiteBridgeService } from './site-bridge.service.js';

@ApiTags('Auth')
@Controller()
export class SiteBridgeController {
  private readonly logger = new Logger(SiteBridgeController.name);

  constructor(private readonly siteBridgeService: SiteBridgeService) {}

  @Post('auth/site-bridge/issue')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue one-time code to continue session on marketing site' })
  @ApiResponse({ status: 200, description: 'Code issued' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  issue(@Req() req: FastifyRequest & { traceId?: string }): ContractsV1.AuthSiteBridgeIssueResponseV1 {
    const authHeader = req.headers?.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      throw new BadRequestException({ message: 'Missing Authorization' });
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]?.trim()) {
      throw new BadRequestException({ message: 'Invalid Authorization' });
    }
    const token = parts[1].trim();
    const code = this.siteBridgeService.issueCode(token);
    this.logger.log('POST /auth/site-bridge/issue success');
    return { code };
  }

  @Post('auth/site-bridge/claim')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange one-time code for access token (marketing site)' })
  @ApiResponse({ status: 200, description: 'Session restored' })
  @ApiResponse({ status: 401, description: 'Invalid code' })
  async claim(
    @Body() dto: unknown,
    @Req() req: FastifyRequest & { traceId?: string },
  ): Promise<ContractsV1.AuthTelegramResponseV1> {
    const validation = ContractsV1.AuthSiteBridgeClaimRequestV1Schema.safeParse(dto);
    if (!validation.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: validation.error.errors,
      });
    }
    const requestContext = {
      traceId: req.traceId,
      path: req.url ?? '/auth/site-bridge/claim',
      method: req.method ?? 'POST',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
    const result = await this.siteBridgeService.claimAndConsume(validation.data.code, requestContext);
    this.logger.log(`POST /auth/site-bridge/claim success userId=${result.user.id}`);
    return result;
  }
}
