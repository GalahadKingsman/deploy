import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { validateTelegramInitData, TelegramInitDataValidationError } from './telegram-init-data.js';
import { UsersRepository } from '../../users/users.repository.js';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import { JwtService } from '../session/jwt.service.js';
import { AuditService } from '../../audit/audit.service.js';

const env = validateOrThrow(ApiEnvSchema, process.env);

@Injectable()
export class TelegramAuthService {
  private readonly logger = new Logger(TelegramAuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Verify Telegram initData and upsert user
   *
   * @param initData - Raw initData string from Telegram WebApp
   * @param requestContext - Optional request context for audit (traceId, path, method, etc.)
   * @returns User data and access token
   * @throws {BadRequestException} On malformed initData or missing fields
   * @throws {UnauthorizedException} On invalid signature or expired auth_date
   * @throws {ForbiddenException} When user is banned (USER_BANNED)
   */
  async verifyAndUpsert(
    initData: string,
    requestContext?: {
      traceId?: string;
      path?: string;
      method?: string;
      userAgent?: string;
      ip?: string;
    },
  ): Promise<ContractsV1.AuthTelegramResponseV1> {
    if (!env.TELEGRAM_BOT_TOKEN) {
      throw new ServiceUnavailableException(
        'Telegram auth not configured (TELEGRAM_BOT_TOKEN is empty)',
      );
    }
    try {
      // Validate initData
      const validated = validateTelegramInitData(
        initData,
        env.TELEGRAM_BOT_TOKEN,
        env.TELEGRAM_INITDATA_MAX_AGE_SECONDS,
      );
      this.logger.log(
        `initData validated: telegramUserId=${validated.telegramUserId}, firstName=${validated.firstName ?? '—'}, username=${validated.username ?? '—'}`,
      );

      // Upsert user
      let user = await this.usersRepository.upsertByTelegramUserId({
        telegramUserId: validated.telegramUserId,
        username: validated.username,
        firstName: validated.firstName,
        lastName: validated.lastName,
        avatarUrl: validated.avatarUrl,
      });

      // Ban enforcement: do not issue token (banned always wins, no owner bootstrap for banned)
      if (user.bannedAt != null) {
        await this.auditService.write({
          actorUserId: user.id,
          action: 'auth.blocked.banned',
          entityType: 'user',
          entityId: user.id,
          meta: {
            path: requestContext?.path ?? '/auth/telegram',
            method: requestContext?.method ?? 'POST',
            telegramId: validated.telegramUserId,
            ...(requestContext?.userAgent != null && { userAgent: requestContext.userAgent }),
            ...(requestContext?.ip != null && { ip: requestContext.ip }),
          },
          traceId: requestContext?.traceId ?? null,
        });
        throw new ForbiddenException({
          code: ErrorCodes.USER_BANNED,
          message: 'Access denied: user is banned',
        });
      }

      // Owner bootstrap: if telegram_user_id matches OWNER_TELEGRAM_USER_ID, set platform_role=owner
      const ownerTgId = env.OWNER_TELEGRAM_USER_ID;
      if (ownerTgId && validated.telegramUserId === ownerTgId) {
        user = await this.usersRepository.updatePlatformRole(user.id, 'owner');
      }

      // Generate access token
      // telegramUserId is always present after upsertByTelegramUserId
      if (!user.telegramUserId) {
        throw new Error('telegramUserId is missing after user upsert');
      }
      const accessToken = this.jwtService.signAccessToken({
        userId: user.id,
        telegramUserId: user.telegramUserId,
      });

      return { user, accessToken };
    } catch (error) {
      if (error instanceof TelegramInitDataValidationError) {
        this.logger.warn(
          `initData validation failed: code=${error.code}, message=${error.message}`,
        );
        if (error.code === 'MALFORMED') {
          throw new BadRequestException({
            message: error.message,
            error: 'Bad Request',
          });
        }
        // INVALID_SIGNATURE or EXPIRED
        throw new UnauthorizedException({
          message: error.message,
          error: 'Unauthorized',
        });
      }
      this.logger.error(
        `verifyAndUpsert unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Re-throw unexpected errors
      throw error;
    }
  }
}
