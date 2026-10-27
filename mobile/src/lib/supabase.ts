import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/config/backend';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the login only while the app is in front (Supabase's recommended setup for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Error code raised by our database functions (e.g. 'insufficient_coins'), or 'network'. */
export function errorCode(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const code = message.match(/^[a-z_]+$/)?.[0];
  if (code) return code;
  if (/fetch|network|timeout/i.test(message)) return 'network';
  return 'unknown';
}

/** Calls a database function and throws its error code on failure. */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(errorCode(error));
  return data as T;
}
