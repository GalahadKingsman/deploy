import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateTelegramInitData,
  TelegramInitDataValidationError,
  signTelegramInitData,
} from '../telegram-init-data.js';

const TEST_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

describe('TelegramInitDataValidator', () => {
  describe('validateTelegramInitData', () => {
    it('should validate valid initData', () => {
      const authDate = Math.floor(Date.now() / 1000);
      const user = {
        id: 123456789,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        photo_url: 'https://example.com/photo.jpg',
      };

      const params: Record<string, string> = {
        query_id: 'test-query-id',
        user: JSON.stringify(user),
        auth_date: String(authDate),
      };

      const initData = signTelegramInitData(params, TEST_BOT_TOKEN);

      const result = validateTelegramInitData(initData, TEST_BOT_TOKEN, 86400);

      assert.strictEqual(result.telegramUserId, '123456789');
      assert.strictEqual(result.firstName, 'John');
      assert.strictEqual(result.lastName, 'Doe');
      assert.strictEqual(result.username, 'johndoe');
      assert.strictEqual(result.avatarUrl, 'https://example.com/photo.jpg');
      assert.strictEqual(result.authDate, authDate);
    });

    it('should handle initData starting with ?', () => {
      const authDate = Math.floor(Date.now() / 1000);
      const user = { id: 123456789 };
      const params: Record<string, string> = {
        query_id: 'test',
        user: JSON.stringify(user),
        auth_date: String(authDate),
      };
      const initData = signTelegramInitData(params, TEST_BOT_TOKEN);
      const initDataWithQuestion = `?${initData}`;

      const result = validateTelegramInitData(initDataWithQuestion, TEST_BOT_TOKEN, 86400);
      assert.strictEqual(result.telegramUserId, '123456789');
    });

    it('should throw MALFORMED for missing hash', () => {
      const initData = 'query_id=test&user={"id":123}&auth_date=1234567890';

      assert.throws(
        () => validateTelegramInitData(initData, TEST_BOT_TOKEN),
        (error: TelegramInitDataValidationError) => {
          return error.code === 'MALFORMED' && error.message.includes('hash');
        },
      );
    });

    it('should throw MALFORMED for missing auth_date', () => {
      const params: Record<string, string> = {
        query_id: 'test',
        user: '{"id":123}',
      };
      const initData = signTelegramInitData(params, TEST_BOT_TOKEN);

      assert.throws(
        () => validateTelegramInitData(initData, TEST_BOT_TOKEN),
        (error: TelegramInitDataValidationError) => {
          return error.code === 'MALFORMED' && error.message.includes('auth_date');
        },
      );
    });

    it('should throw MALFORMED for missing user', () => {
      const authDate = Math.floor(Date.now() / 1000);
      const params: Record<string, string> = {
        query_id: 'test',
        auth_date: String(authDate),
      };
      const initData = signTelegramInitData(params, TEST_BOT_TOKEN);

      assert.throws(
        () => validateTelegramInitData(initData, TEST_BOT_TOKEN),
        (error: TelegramInitDataValidationError) => {
          return error.code === 'MALFORMED' && error.message.includes('user');
        },
      );
    });

    it('should throw INVALID_SIGNATURE for wrong hash', () => {
      const authDate = Math.floor(Date.now() / 1000);
      const user = { id: 123456789 };
      const params: Record<string, string> = {
        query_id: 'test',
        user: JSON.stringify(user),
        auth_date: String(authDate),
      };
      const initData = signTelegramInitData(params, TEST_BOT_TOKEN);

      // Corrupt hash
      const corruptedInitData = initData.replace(/hash=[^&]+/, 'hash=invalid');

      assert.throws(
        () => validateTelegramInitData(corruptedInitData, TEST_BOT_TOKEN),
        (error: TelegramInitDataValidationError) => {
          return error.code === 'INVALID_SIGNATURE';
        },
      );
    });

    it('should throw EXPIRED for old auth_date', () => {
      const authDate = Math.floor(Date.now() / 1000) - 100000; // 100k seconds ago
      const user = { id: 123456789 };
      const params: Record<string, string> = {
        query_id: 'test',
        user: JSON.stringify(user),
        auth_date: String(authDate),
      };
      const initData = signTelegramInitData(params, TEST_BOT_TOKEN);

      assert.throws(
        () => validateTelegramInitData(initData, TEST_BOT_TOKEN, 86400),
        (error: TelegramInitDataValidationError) => {
          return error.code === 'EXPIRED';
        },
      );
    });
  });
});
