import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { ApiEnvSchema, validateOrThrow, ErrorCodes } from '@tracked/shared';

@Injectable()
export class BotTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    const req = context.switchToHttp().getRequest();
    const token = req.headers?.['x-telegram-bot-token'];
    const headerValue =
      typeof token === 'string' ? token : Array.isArray(token) ? token[0] : undefined;

    if (!env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN.trim() === '') {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Bot access is not configured' });
    }
    if (!headerValue || headerValue.trim() !== env.TELEGRAM_BOT_TOKEN.trim()) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Forbidden' });
    }
    return true;
  }
}

