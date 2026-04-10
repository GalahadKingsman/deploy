import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Pool } from 'pg';
import { signTelegramInitData } from '../telegram-init-data.js';
import { UsersRepository } from '../../../users/users.repository.js';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://tracked:tracked_password@localhost:5432/tracked_lms';

describe('TelegramAuth Integration', () => {
  let pool: Pool;
  let repository: UsersRepository;

  before(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    repository = new UsersRepository(pool);

    // Ensure table exists (match migration 001 + 002)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_user_id TEXT NOT NULL UNIQUE,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        banned_at TIMESTAMP WITH TIME ZONE NULL,
        ban_reason TEXT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);
    `);
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT NULL;
    `);
  });

  after(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM users WHERE telegram_user_id LIKE $1', ['test-%']);
    await pool.end();
  });

  describe('UsersRepository.upsertByTelegramUserId', () => {
    it('should create new user', async () => {
      const user = await repository.upsertByTelegramUserId({
        telegramUserId: 'test-123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/photo.jpg',
      });

      assert.strictEqual(user.telegramUserId, 'test-123');
      assert.strictEqual(user.username, 'testuser');
      assert.strictEqual(user.firstName, 'Test');
      assert.strictEqual(user.lastName, 'User');
      assert.strictEqual(user.avatarUrl, 'https://example.com/photo.jpg');
      assert.ok(user.id);
      assert.ok(user.createdAt);
      assert.ok(user.updatedAt);
    });

    it('should update existing user (upsert)', async () => {
      // Create first time
      const user1 = await repository.upsertByTelegramUserId({
        telegramUserId: 'test-456',
        username: 'olduser',
        firstName: 'Old',
      });

      const originalId = user1.id;
      const originalCreatedAt = user1.createdAt;

      // Update
      const user2 = await repository.upsertByTelegramUserId({
        telegramUserId: 'test-456',
        username: 'newuser',
        firstName: 'New',
        lastName: 'Name',
      });

      // Should be same user (same id)
      assert.strictEqual(user2.id, originalId);
      assert.strictEqual(user2.createdAt, originalCreatedAt); // created_at should not change

      // But fields should be updated
      assert.strictEqual(user2.username, 'newuser');
      assert.strictEqual(user2.firstName, 'New');
      assert.strictEqual(user2.lastName, 'Name');
      assert.ok(new Date(user2.updatedAt) >= new Date(user1.updatedAt));
    });
  });
});
