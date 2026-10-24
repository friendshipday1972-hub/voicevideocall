import { jwtVerify } from 'jose';

/** Shared by the proxy (edge-safe) and the server session helpers. */
export const SESSION_COOKIE = 'admin_session';

export type AdminSession = { email: string; role: 'admin' };

export function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters). See .env.example.');
  return new TextEncoder().encode(secret);
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, sessionKey(), { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}
