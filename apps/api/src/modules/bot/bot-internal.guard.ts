import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { ApiEnvSchema, validateOrThrow, ErrorCodes } from '@tracked/shared';

@Injectable()
export class BotInternalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    const req = context.switchToHttp().getRequest();
    const token = req.headers?.['x-bot-internal-token'];
    const headerValue = typeof token === 'string' ? token : Array.isArray(token) ? token[0] : undefined;

    const expected = env.BOT_INTERNAL_TOKEN?.trim();
    if (!expected) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Internal token not configured' });
    }
    if (!headerValue || headerValue.trim() !== expected) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Forbidden' });
    }
    return true;
  }
}

