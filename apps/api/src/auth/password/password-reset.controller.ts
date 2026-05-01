import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { MailerService } from '../../common/mail/mailer.service.js';
import { PasswordResetRequestThrottle } from './password-reset-request-throttle.js';
import { PasswordResetService } from './password-reset.service.js';

@ApiTags('Auth')
@Controller('auth/password/reset')
export class PasswordResetController {
  private readonly logger = new Logger(PasswordResetController.name);

  constructor(
    private readonly passwordResetService: PasswordResetService,
    private readonly mailer: MailerService,
    private readonly resetThrottle: PasswordResetRequestThrottle,
  ) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email (self-service)' })
  @ApiResponse({ status: 200, description: 'Email queued / sent' })
  async requestReset(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ): Promise<ContractsV1.AuthPasswordResetRequestResponseV1> {
    const parsed = ContractsV1.AuthPasswordResetRequestRequestV1Schema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Укажите корректный email.',
      });
    }
    const email = parsed.data.email.trim().toLowerCase();

    if (!this.mailer.isPasswordResetMailConfigured()) {
      throw new ServiceUnavailableException({
        code: ErrorCodes.INTERNAL_ERROR,
        message:
          'Отправка писем с восстановлением пароля временно недоступна. Обратитесь в поддержку или попробуйте позже.',
      });
    }

    const xf = req.headers['x-forwarded-for'];
    const xf0 = typeof xf === 'string' ? xf.split(',')[0]?.trim() : Array.isArray(xf) ? xf[0]?.trim() : '';
    const ip = xf0 || (req as { ip?: string }).ip || 'unknown';
    const throttleKey = `${ip}:${email}`;
    if (!this.resetThrottle.isAllowed(throttleKey)) {
      throw new HttpException(
        { code: ErrorCodes.RATE_LIMITED, message: 'Слишком много запросов. Попробуйте позже.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let token: string | null = null;
    try {
      const out = await this.passwordResetService.createSelfServiceResetToken(email);
      token = out.token;
      await this.mailer.sendPasswordResetEmail({
        to: email,
        resetUrl: out.resetUrl,
        expiresAtIso: out.expiresAt,
      });
      return {
        ok: true,
        message: 'Письмо со ссылкой для восстановления пароля отправлено на указанный адрес.',
      };
    } catch (e) {
      if (token) {
        await this.passwordResetService.revokeResetTokenByRawToken(token).catch(() => undefined);
      }
      if (e instanceof NotFoundException || e instanceof BadRequestException) {
        throw e;
      }
      if (e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw e;
      }
      const err = e instanceof Error ? e : new Error(String(e));
      const smtp =
        typeof (err as { response?: unknown }).response === 'string'
          ? (err as { response: string }).response.trim()
          : '';
      this.logger.warn(
        `Password reset mail failed for ${email}: ${err.message}${smtp ? ` | SMTP: ${smtp}` : ''}`,
      );
      throw new ServiceUnavailableException({
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Не удалось отправить письмо. Попробуйте позже или обратитесь в поддержку.',
      });
    }
  }

  @Get('preview')
  @ApiOperation({ summary: 'Preview password reset token (email + expiry)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async preview(@Query('token') token: string | undefined): Promise<ContractsV1.AuthPasswordResetPreviewResponseV1> {
    return await this.passwordResetService.previewReset(token ?? '');
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm password reset by one-time token' })
  @ApiResponse({ status: 200, description: 'OK' })
  async confirm(@Body() body: unknown): Promise<ContractsV1.AuthPasswordResetConfirmResponseV1> {
    const parsed = ContractsV1.AuthPasswordResetConfirmRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
      });
    }
    return await this.passwordResetService.confirmReset(parsed.data);
  }
}
