import { createHash, timingSafeEqual } from 'node:crypto';

const EXCLUDED_INIT_KEYS = new Set(['Token', 'Receipt', 'DATA', 'Data']);

/**
 * Token for outgoing Init (and similar): root scalars only, no Receipt/DATA, then Password, sort by key, concat values, SHA-256 hex.
 * @see https://developer.tbank.ru/eacq/intro/developer/token
 */
export function buildTinkoffRequestToken(params: Record<string, unknown>, password: string): string {
  return buildTokenFromEntries(collectScalarEntries(params, EXCLUDED_INIT_KEYS), password);
}

const EXCLUDED_NOTIFICATION_KEYS = new Set(['Token', 'Receipt', 'DATA', 'Data']);

/** Verify notification body: recompute token from payload (excluding Token, nested objects). */
export function verifyTinkoffNotification(params: Record<string, unknown>, password: string, receivedToken: string): boolean {
  const expected = buildTokenFromEntries(
    collectScalarEntries(params, EXCLUDED_NOTIFICATION_KEYS),
    password,
  );
  return timingSafeEqualHex(expected, receivedToken);
}

function collectScalarEntries(
  params: Record<string, unknown>,
  excluded: Set<string>,
): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  for (const [key, val] of Object.entries(params)) {
    if (excluded.has(key) || val === undefined || val === null) continue;
    if (typeof val === 'object') continue;
    out.push({ key, value: stringifyTokenValue(val) });
  }
  return out;
}

function stringifyTokenValue(val: unknown): string {
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

function buildTokenFromEntries(entries: Array<{ key: string; value: string }>, password: string): string {
  const withPassword = [...entries, { key: 'Password', value: password }];
  withPassword.sort((a, b) => a.key.localeCompare(b.key));
  const concat = withPassword.map((p) => p.value).join('');
  return createHash('sha256').update(concat, 'utf8').digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length || ba.length !== 32) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
