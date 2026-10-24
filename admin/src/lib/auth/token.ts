import { jwtVerify } from 'jose';

/** Shared by the proxy (edge-safe) and the server session helpers. */
export const SESSION_COOKIE = 'admin_session';

export type AdminSession = { email: string; role: 'admin' };

/** Prototype fallback so the dashboard deploys with no setup; set SESSION_SECRET once real data is connected. */
const DEMO_SECRET = 'baatein-admin-demo-session-secret-not-for-real-data';

export function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  return new TextEncoder().encode(secret && secret.length >= 32 ? secret : DEMO_SECRET);
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
