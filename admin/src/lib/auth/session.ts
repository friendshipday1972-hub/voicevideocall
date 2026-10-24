import 'server-only';

import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { SESSION_COOKIE, sessionKey, type AdminSession } from './token';

const SESSION_HOURS = 8;

export async function createSession(email: string) {
  const expires = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  const token = await new SignJWT({ email, role: 'admin' } satisfies AdminSession)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(sessionKey());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Data Access Layer: the verified admin for this request, or a redirect to /login. */
export async function getCurrentAdmin(): Promise<AdminSession> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');
  try {
    const { payload } = await jwtVerify<AdminSession>(token, sessionKey(), { algorithms: ['HS256'] });
    return { email: payload.email, role: payload.role };
  } catch {
    redirect('/login');
  }
}
