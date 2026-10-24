'use server';

import { redirect } from 'next/navigation';

import { createSession, deleteSession } from '@/lib/auth/session';

/** `error` is a code; the form shows it in the admin's language. */
export type LoginError = 'email' | 'password';
export type LoginState = { error?: LoginError; email?: string } | undefined;

/**
 * Prototype: any email and password signs in (the dashboard only holds demo data).
 * Before real data is connected, bring back a credential check here.
 */
export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if (!email) return { error: 'email', email };
  if (!password) return { error: 'password', email };

  await createSession(email);
  redirect('/');
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}
