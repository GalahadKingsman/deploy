import { Module, Global, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Pool } from 'pg';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import { runMigrations } from './migrations.js';

// Allow DATABASE_URL to be optional when SKIP_DB=1
const skipDb = process.env.SKIP_DB === '1';
let env;
try {
  env = validateOrThrow(ApiEnvSchema, process.env);
} catch (error) {
  // If validation fails and SKIP_DB=1, allow missing DATABASE_URL
  if (skipDb) {
    env = { ...process.env, DATABASE_URL: undefined } as any;
  } else {
    throw error;
  }
}

// Determine if DB is disabled: SKIP_DB=1 OR DATABASE_URL not set
// Note: env.DATABASE_URL may be undefined even if process.env.DATABASE_URL is set,
// because Zod optional() fields are undefined when not present in input.
// We check both env.DATABASE_URL (from validated schema) and process.env.DATABASE_URL (raw).
const hasDatabaseUrl = !!(env.DATABASE_URL || process.env.DATABASE_URL);
const isDbDisabled = skipDb || !hasDatabaseUrl;

@Global()
@Module({
  providers: [
    {
      provide: Pool,
      useFactory: async (): Promise<Pool | null> => {
        const skip = process.env.SKIP_DB === '1';
        const url = process.env.DATABASE_URL;
        if (skip || !url) return null;
        const pool = new Pool({
          connectionString: url,
          connectionTimeoutMillis: 3000, // Fail-fast: 3 seconds
        });
        try {
          await Promise.race([
            pool.query('SELECT 1'),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Database connection timeout (3s)')), 3000),
            ),
          ]);
        } catch (error) {
          await pool.end();
          console.error('Database init failed:', error);
          throw error;
        }
        return pool;
      },
    },
  ],
  exports: [Pool],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleInit() {
    // Eagerly resolve Pool and run migrations on startup (not when first consumer requests it).
    // Guarantees: "API start" == "migrations applied".
    const pool = this.moduleRef.get(Pool, { strict: false });
    if (!pool) {
      const urlNow = process.env.DATABASE_URL;
      if (!urlNow && process.env.SKIP_DB !== '1') {
        console.warn(
          `⚠️  Database is disabled (DATABASE_URL not set). DB-dependent endpoints will fail.`,
        );
      }
      return;
    }
    try {
      await runMigrations(pool);
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    const pool = this.moduleRef.get(Pool, { strict: false });
    if (pool) {
      await pool.end();
    }
  }
}
