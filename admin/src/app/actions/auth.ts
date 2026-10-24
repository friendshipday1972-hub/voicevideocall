'use server';

import { redirect } from 'next/navigation';

import { clearFailures, isLocked, recordFailure, verifyPassword } from '@/lib/auth/password';
import { createSession, deleteSession } from '@/lib/auth/session';

export type LoginState = { error?: string; email?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');

  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.', email };
  if (!password) return { error: 'Enter your password.', email };
  if (isLocked(email)) return { error: 'Too many failed attempts. Try again in 15 minutes.', email };

  const ok = email === process.env.ADMIN_EMAIL?.toLowerCase() && verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  if (!ok) {
    recordFailure(email);
    // Same message for unknown email and wrong password, so accounts can't be probed.
    return { error: 'Email or password is incorrect.', email };
  }

  clearFailures(email);
  await createSession(email);
  redirect('/');
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}
