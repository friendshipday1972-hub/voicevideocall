'use server';

import { redirect } from 'next/navigation';

import { clearFailures, isLocked, recordFailure, verifyPassword } from '@/lib/auth/password';
import { createSession, deleteSession } from '@/lib/auth/session';

/** `error` is a code; the form shows it in the admin's language. */
export type LoginError = 'email' | 'password' | 'locked' | 'wrong';
export type LoginState = { error?: LoginError; email?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');

  if (!EMAIL_RE.test(email)) return { error: 'email', email };
  if (!password) return { error: 'password', email };
  if (isLocked(email)) return { error: 'locked', email };

  const ok = email === process.env.ADMIN_EMAIL?.toLowerCase() && verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  if (!ok) {
    recordFailure(email);
    // Same message for unknown email and wrong password, so accounts can't be probed.
    return { error: 'wrong', email };
  }

  clearFailures(email);
  await createSession(email);
  redirect('/');
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}
