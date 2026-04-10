import { z } from 'zod';

const SECRET_KEYS = [
  'BOT_TOKEN',
  'S3_SECRET_KEY',
  'S3_ACCESS_KEY',
  'DATABASE_URL',
  'REDIS_URL',
  'POSTGRES_PASSWORD',
  'MINIO_ROOT_PASSWORD',
];

function maskSecret(key: string, value: unknown): string {
  if (SECRET_KEYS.some((secret) => key.includes(secret))) {
    return '***';
  }
  return String(value);
}

export function validateOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  rawEnv: Record<string, unknown>,
): z.infer<T> {
  const result = schema.safeParse(rawEnv);

  if (!result.success) {
    const errors = result.error.errors.map((err: z.ZodIssue) => {
      const path = err.path.join('.');
      const value = rawEnv[path];
      return `  ${path}: ${err.message} (got: ${maskSecret(path, value)})`;
    });

    console.error('❌ Environment validation failed:');
    console.error(errors.join('\n'));
    console.error('\nPlease check your .env file and ensure all required variables are set.');

    throw new Error('Environment validation failed');
  }

  return result.data;
}
