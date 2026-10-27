'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * Browser client. The admin signs in with Supabase Auth (email + password); row level security
 * lets an `admin` profile read everything, and every change goes through admin_* database
 * functions that check the role and write the audit log. No service key ever reaches the browser.
 */
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'baatein-admin-auth' },
});

/** Calls a database function and throws its short error code (e.g. 'not_admin') on failure. */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message.match(/^[a-z_]+$/)?.[0] ?? 'unknown');
  return data as T;
}
