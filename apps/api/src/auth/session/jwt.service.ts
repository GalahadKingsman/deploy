import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRequire } from 'node:module';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');

const env = validateOrThrow(ApiEnvSchema, process.env);

/**
 * JWT payload structure
 */
export interface JwtPayload {
  sub: string; // userId (UUID)
  tg: string; // telegramUserId
  iat: number;
  exp: number;
}

/**
 * JWT service for signing and verifying access tokens
 */
@Injectable()
export class JwtService {
  private readonly secret: string;
  private readonly ttlSeconds: number;

  constructor() {
    this.secret = env.JWT_ACCESS_SECRET;
    this.ttlSeconds = env.JWT_ACCESS_TTL_SECONDS;
  }

  /**
   * Sign an access token
   *
   * @param payload - User ID and Telegram user ID
   * @returns JWT token string
   */
  signAccessToken(payload: { userId: string; telegramUserId: string }): string {
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload: JwtPayload = {
      sub: payload.userId,
      tg: payload.telegramUserId,
      iat: now,
      exp: now + this.ttlSeconds,
    };

    return jwt.sign(jwtPayload, this.secret, {
      algorithm: 'HS256',
    });
  }

  /**
   * Verify an access token
   *
   * @param token - JWT token string
   * @returns Decoded payload with userId and telegramUserId
   * @throws {UnauthorizedException} If token is invalid or expired
   */
  verifyAccessToken(token: string): { userId: string; telegramUserId: string } {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
      }) as JwtPayload;

      return {
        userId: decoded.sub,
        telegramUserId: decoded.tg,
      };
    } catch (error) {
      // Always throw UnauthorizedException for any verification error
      // This ensures we never leak raw errors (no 500)
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException({
          message: 'Token expired',
          error: 'Unauthorized',
        });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException({
          message: 'Invalid token',
          error: 'Unauthorized',
        });
      }
      // Catch any other errors (e.g., SyntaxError for malformed tokens)
      // and convert to UnauthorizedException
      throw new UnauthorizedException({
        message: 'Invalid token',
        error: 'Unauthorized',
      });
    }
  }
}
