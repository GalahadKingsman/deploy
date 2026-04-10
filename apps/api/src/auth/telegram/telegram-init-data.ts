import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Telegram initData validation result
 */
export interface TelegramInitDataValidationResult {
  telegramUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  authDate: number;
}

/**
 * Telegram initData validation error
 */
export class TelegramInitDataValidationError extends Error {
  constructor(
    message: string,
    public readonly code: 'MALFORMED' | 'INVALID_SIGNATURE' | 'EXPIRED',
  ) {
    super(message);
    this.name = 'TelegramInitDataValidationError';
  }
}

/**
 * Parse and validate Telegram WebApp initData
 *
 * Algorithm (official Telegram spec):
 * 1. Parse initData as query params (remove leading ? if present)
 * 2. Extract hash, collect other pairs as key=value, sort, join with \n
 * 3. secret_key = HMAC_SHA256(bot_token, "WebAppData")
 * 4. computed_hash = hex(HMAC_SHA256(data_check_string, secret_key))
 * 5. Compare computed_hash and hash (timing-safe), then check auth_date TTL
 *
 * @param initData - Raw initData string from Telegram WebApp
 * @param botToken - Telegram bot token
 * @param maxAgeSeconds - Maximum age of auth_date in seconds (default: 86400 = 24h)
 * @returns Validated user data
 * @throws {TelegramInitDataValidationError} On validation failure
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number = 86400,
): TelegramInitDataValidationResult {
  // Remove leading ? if present
  const cleanInitData = initData.startsWith('?') ? initData.substring(1) : initData;

  // Parse initData as query params
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(cleanInitData);
  } catch (error) {
    throw new TelegramInitDataValidationError(
      'Failed to parse initData as query string',
      'MALFORMED',
    );
  }

  // Extract hash
  const hash = params.get('hash');
  if (!hash) {
    throw new TelegramInitDataValidationError('Missing hash in initData', 'MALFORMED');
  }

  // Extract auth_date
  const authDateStr = params.get('auth_date');
  if (!authDateStr) {
    throw new TelegramInitDataValidationError('Missing auth_date in initData', 'MALFORMED');
  }

  const authDate = parseInt(authDateStr, 10);
  if (isNaN(authDate)) {
    throw new TelegramInitDataValidationError('Invalid auth_date format', 'MALFORMED');
  }

  // Check TTL
  const now = Math.floor(Date.now() / 1000);
  const age = now - authDate;
  if (age < 0 || age > maxAgeSeconds) {
    throw new TelegramInitDataValidationError(
      `initData expired (age: ${age}s, max: ${maxAgeSeconds}s)`,
      'EXPIRED',
    );
  }

  // Extract user
  const userStr = params.get('user');
  if (!userStr) {
    throw new TelegramInitDataValidationError('Missing user in initData', 'MALFORMED');
  }

  let user: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
  try {
    user = JSON.parse(userStr);
  } catch (error) {
    throw new TelegramInitDataValidationError('Invalid user JSON in initData', 'MALFORMED');
  }

  if (!user.id || typeof user.id !== 'number') {
    throw new TelegramInitDataValidationError('Invalid user.id in initData', 'MALFORMED');
  }

  // Remove hash and build data_check_string
  params.delete('hash');

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();

  const dataCheckString = pairs.join('\n');

  // Compute secret_key: HMAC_SHA256(bot_token, "WebAppData")
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();

  // Compute computed_hash: hex(HMAC_SHA256(data_check_string, secret_key))
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Timing-safe comparison
  const hashBuffer = Buffer.from(hash, 'hex');
  const computedBuffer = Buffer.from(computedHash, 'hex');

  if (hashBuffer.length !== computedBuffer.length) {
    throw new TelegramInitDataValidationError('Invalid signature', 'INVALID_SIGNATURE');
  }

  if (!timingSafeEqual(hashBuffer, computedBuffer)) {
    throw new TelegramInitDataValidationError('Invalid signature', 'INVALID_SIGNATURE');
  }

  // Return validated data
  return {
    telegramUserId: String(user.id),
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    avatarUrl: user.photo_url ?? null,
    authDate,
  };
}

/**
 * Helper to sign initData for testing
 *
 * @param params - Query parameters (without hash)
 * @param botToken - Telegram bot token
 * @returns Signed initData string with hash
 */
export function signTelegramInitData(params: Record<string, string>, botToken: string): string {
  const urlParams = new URLSearchParams(params);

  // Build data_check_string
  const pairs: string[] = [];
  for (const [key, value] of urlParams.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();

  const dataCheckString = pairs.join('\n');

  // Compute secret_key
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();

  // Compute hash
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Add hash to params
  urlParams.set('hash', hash);

  return urlParams.toString();
}
