import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtService } from '../jwt.service.js';

// Mock env before importing
const originalEnv = process.env;

describe('JwtService', () => {
  let jwtService: JwtService;
  const TEST_SECRET = 'test-secret-key-for-jwt';
  const TEST_TTL = 900; // 15 minutes

  beforeEach(() => {
    // Reset env
    process.env = {
      ...originalEnv,
      JWT_ACCESS_SECRET: TEST_SECRET,
      JWT_ACCESS_TTL_SECONDS: String(TEST_TTL),
      NODE_ENV: 'test',
    };
    jwtService = new JwtService();
  });

  describe('signAccessToken', () => {
    it('should sign a valid token', () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        telegramUserId: '123456789',
      };

      const token = jwtService.signAccessToken(payload);

      assert.strictEqual(typeof token, 'string');
      assert(token.length > 0);
      // Token should have 3 parts (header.payload.signature)
      assert.strictEqual(token.split('.').length, 3);
    });

    it('should include correct claims in token', () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const telegramUserId = '123456789';

      const token = jwtService.signAccessToken({ userId, telegramUserId });
      const decoded = jwtService.verifyAccessToken(token);

      assert.strictEqual(decoded.userId, userId);
      assert.strictEqual(decoded.telegramUserId, telegramUserId);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        telegramUserId: '123456789',
      };

      const token = jwtService.signAccessToken(payload);
      const decoded = jwtService.verifyAccessToken(token);

      assert.strictEqual(decoded.userId, payload.userId);
      assert.strictEqual(decoded.telegramUserId, payload.telegramUserId);
    });

    it('should throw UnauthorizedException for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      assert.throws(
        () => jwtService.verifyAccessToken(invalidToken),
        (error: UnauthorizedException) => {
          return error instanceof UnauthorizedException;
        },
      );
    });

    it('should throw UnauthorizedException for token signed with different secret', () => {
      // Create a token with different secret
      const wrongSecretToken = jwt.sign(
        {
          sub: '123e4567-e89b-12d3-a456-426614174000',
          tg: '123456789',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900,
        },
        'wrong-secret',
        { algorithm: 'HS256' },
      );

      assert.throws(
        () => jwtService.verifyAccessToken(wrongSecretToken),
        (error: UnauthorizedException) => {
          return error instanceof UnauthorizedException;
        },
      );
    });

    it('should throw UnauthorizedException for expired token', () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        {
          sub: '123e4567-e89b-12d3-a456-426614174000',
          tg: '123456789',
          iat: Math.floor(Date.now() / 1000) - 1000,
          exp: Math.floor(Date.now() / 1000) - 100, // Expired 100 seconds ago
        },
        TEST_SECRET,
        { algorithm: 'HS256' },
      );

      assert.throws(
        () => jwtService.verifyAccessToken(expiredToken),
        (error: UnauthorizedException) => {
          return error instanceof UnauthorizedException;
        },
      );
    });

    it('should throw UnauthorizedException for empty token', () => {
      assert.throws(
        () => jwtService.verifyAccessToken(''),
        (error: UnauthorizedException) => {
          return error instanceof UnauthorizedException;
        },
      );
    });
  });
});
