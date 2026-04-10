import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { UnauthorizedException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from '../jwt-auth.guard.js';
import { JwtService } from '../jwt.service.js';
import type { UsersRepository } from '../../../users/users.repository.js';
import type { AuditService } from '../../../audit/audit.service.js';

// Mock env before importing
const originalEnv = process.env;

function mockUsersRepository(overrides?: { bannedAt?: string | null }): UsersRepository {
  const user = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    telegramUserId: '123456789',
    username: 'test',
    firstName: 'Test',
    lastName: 'User',
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    bannedAt: overrides?.bannedAt ?? null,
  };
  return {
    findById: async () => user,
  } as unknown as UsersRepository;
}

function mockAuditService(): AuditService {
  return { write: async () => {} } as unknown as AuditService;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;
  const TEST_SECRET = 'test-secret-key-for-jwt';

  beforeEach(() => {
    // Reset env
    process.env = {
      ...originalEnv,
      JWT_ACCESS_SECRET: TEST_SECRET,
      JWT_ACCESS_TTL_SECONDS: '900',
      NODE_ENV: 'test',
    };
    jwtService = new JwtService();
    guard = new JwtAuthGuard(jwtService, mockUsersRepository(), mockAuditService());
  });

  function createMockContext(headers: Record<string, string>): ExecutionContext {
    const request: {
      headers: Record<string, string>;
      user?: { userId: string; telegramUserId: string };
    } = {
      headers,
      user: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as ExecutionContext;
  }

  describe('canActivate', () => {
    it('should allow request with valid Bearer token', async () => {
      const token = jwtService.signAccessToken({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        telegramUserId: '123456789',
      });

      const context = createMockContext({
        authorization: `Bearer ${token}`,
      });

      const result = await guard.canActivate(context);

      assert.strictEqual(result, true);
      const request = context.switchToHttp().getRequest();
      assert.strictEqual(request.user.userId, '123e4567-e89b-12d3-a456-426614174000');
      assert.strictEqual(request.user.telegramUserId, '123456789');
    });

    it('should throw ForbiddenException when user is banned', async () => {
      const bannedGuard = new JwtAuthGuard(
        jwtService,
        mockUsersRepository({ bannedAt: new Date().toISOString() }),
        mockAuditService(),
      );
      const token = jwtService.signAccessToken({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        telegramUserId: '123456789',
      });
      const context = createMockContext({
        authorization: `Bearer ${token}`,
      });

      await assert.rejects(
        async () => bannedGuard.canActivate(context),
        (error: ForbiddenException) =>
          error instanceof ForbiddenException &&
          (error.getResponse() as { code?: string })?.code === 'USER_BANNED',
      );
    });

    it('should throw UnauthorizedException for missing Authorization header', async () => {
      const context = createMockContext({});

      await assert.rejects(
        async () => guard.canActivate(context),
        (error: UnauthorizedException) =>
          error instanceof UnauthorizedException &&
          error.message.includes('Missing Authorization header'),
      );
    });

    it('should throw UnauthorizedException for invalid Authorization header format', async () => {
      const context = createMockContext({
        authorization: 'InvalidFormat token',
      });

      await assert.rejects(
        async () => guard.canActivate(context),
        (error: UnauthorizedException) =>
          error instanceof UnauthorizedException &&
          error.message.includes('Invalid Authorization header format'),
      );
    });

    it('should throw UnauthorizedException for missing token in Bearer format', async () => {
      const context = createMockContext({
        authorization: 'Bearer ',
      });

      await assert.rejects(
        async () => guard.canActivate(context),
        (error: UnauthorizedException) =>
          error instanceof UnauthorizedException && error.message.includes('Missing token'),
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const context = createMockContext({
        authorization: 'Bearer invalid.token.here',
      });

      await assert.rejects(
        async () => guard.canActivate(context),
        (error: UnauthorizedException) => error instanceof UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const expiredToken = jwt.sign(
        {
          sub: '123e4567-e89b-12d3-a456-426614174000',
          tg: '123456789',
          iat: Math.floor(Date.now() / 1000) - 1000,
          exp: Math.floor(Date.now() / 1000) - 100,
        },
        TEST_SECRET,
        { algorithm: 'HS256' },
      );

      const context = createMockContext({
        authorization: `Bearer ${expiredToken}`,
      });

      await assert.rejects(
        async () => guard.canActivate(context),
        (error: UnauthorizedException) => error instanceof UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const noUserRepo = {
        findById: async () => null,
      } as unknown as UsersRepository;
      const guardNoUser = new JwtAuthGuard(jwtService, noUserRepo, mockAuditService());
      const token = jwtService.signAccessToken({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        telegramUserId: '123456789',
      });
      const context = createMockContext({
        authorization: `Bearer ${token}`,
      });

      await assert.rejects(
        async () => guardNoUser.canActivate(context),
        (error: UnauthorizedException) => error instanceof UnauthorizedException,
      );
    });

    it('should handle Authorization header as array', async () => {
      const token = jwtService.signAccessToken({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        telegramUserId: '123456789',
      });

      const request: {
        headers: { authorization: string[] };
        user?: { userId: string; telegramUserId: string };
      } = {
        headers: {
          authorization: [`Bearer ${token}`],
        },
        user: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
      } as ExecutionContext;

      await assert.rejects(
        async () => guard.canActivate(context),
        (error: UnauthorizedException) => error instanceof UnauthorizedException,
      );
    });
  });
});
