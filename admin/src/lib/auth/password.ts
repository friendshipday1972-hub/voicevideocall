import 'server-only';

import { scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Verifies against ADMIN_PASSWORD_HASH, formatted `scrypt:<saltHex>:<hashHex>`
 * (generate with `npm run hash-password -- "your password"`). Constant-time compare.
 */
export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [algo, saltHex, hashHex] = stored.split(':');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Simple in-memory brute-force guard: 5 failed attempts per email locks it for 15 minutes. */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;

export function isLocked(email: string): boolean {
  const a = attempts.get(email);
  return !!a && a.count >= MAX_ATTEMPTS && a.until > Date.now();
}

export function recordFailure(email: string) {
  const a = attempts.get(email);
  const fresh = !a || a.until < Date.now();
  attempts.set(email, { count: fresh ? 1 : a.count + 1, until: Date.now() + LOCK_MS });
}

export function clearFailures(email: string) {
  attempts.delete(email);
}
