import { NextResponse, type NextRequest } from 'next/server';

import { isValidSession, SESSION_COOKIE } from '@/lib/auth/token';

/** Every page except /login needs a valid admin session; signed-in admins skip the login page. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const valid = await isValidSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/login') {
    return valid ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }
  if (!valid) {
    const res = NextResponse.redirect(new URL('/login', request.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
};
