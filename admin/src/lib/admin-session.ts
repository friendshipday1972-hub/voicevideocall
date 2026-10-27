'use client';

import { supabase } from './supabase';

/** The signed-in person's email if they are an admin, otherwise null. */
export async function currentAdminEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', user.id).maybeSingle();
  return profile?.role === 'admin' && profile.status === 'active' ? (user.email ?? 'admin') : null;
}

export async function isAdminSession(): Promise<boolean> {
  return (await currentAdminEmail()) !== null;
}
