import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { applyServerConfig, type ServerConfig } from '@/config/appConfig';
import type { LanguageCode } from '@/data/catalog';
import { detectLanguage } from '@/i18n/detect';
import { unregisterPush } from '@/lib/push';
import { rpc, supabase } from '@/lib/supabase';

import { persistStorage } from './storage';

export type Gender = 'male' | 'female' | 'other';

/** Women join as verified hosts; everyone else joins as a caller. The server decides this too. */
export type Role = 'user' | 'host';

export function roleForGender(gender: Gender): Role {
  return gender === 'female' ? 'host' : 'user';
}

export type Profile = {
  displayName: string;
  gender: Gender;
  role: Role;
  dateOfBirth: string; // YYYY-MM-DD
  avatarKey: string;
  languages: LanguageCode[];
  consentAt: number;
  consentVersion: string;
};

export type ProfileInput = Omit<Profile, 'role' | 'consentAt'>;

type Notifications = { calls: boolean; offers: boolean; favoritesOnline: boolean };

type ProfileRow = {
  role: string;
  status: string;
  display_name: string;
  gender: Gender;
  date_of_birth: string;
  avatar_key: string | null;
  languages: LanguageCode[];
  ui_language: string;
  consent_at: string | null;
  consent_version: string | null;
  notify_calls: boolean;
  notify_offers: boolean;
  notify_favorites: boolean;
};

type SessionState = {
  userId: string | null;
  phone: string | null;
  uiLanguage: LanguageCode;
  profile: Profile | null;
  notifications: Notifications;
  /** Login and profile have been checked; the first screen can be chosen. */
  hydrated: boolean;
  /** Set when the account exists but may not use the app (suspended, banned, admin account). */
  blockedReason: 'suspended' | 'banned' | 'notApp' | null;
  setUiLanguage: (code: LanguageCode) => void;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  completeProfile: (input: ProfileInput) => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'displayName' | 'avatarKey' | 'languages'>>) => Promise<void>;
  setNotification: (key: keyof Notifications, value: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};

const toProfile = (r: ProfileRow): Profile => ({
  displayName: r.display_name,
  gender: r.gender,
  role: r.role === 'host' ? 'host' : 'user',
  dateOfBirth: r.date_of_birth,
  avatarKey: r.avatar_key ?? 'sun',
  languages: r.languages,
  consentAt: r.consent_at ? Date.parse(r.consent_at) : 0,
  consentVersion: r.consent_version ?? '',
});

/** Indian mobile number in the E.164 form Supabase Auth expects. */
const e164 = (phone: string) => `+91${phone.replace(/\D/g, '').slice(-10)}`;

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      userId: null,
      phone: null,
      // First launch follows the phone's language when supported; the welcome screen can change it.
      uiLanguage: detectLanguage(),
      profile: null,
      notifications: { calls: true, offers: true, favoritesOnline: true },
      hydrated: false,
      blockedReason: null,
      setUiLanguage: (uiLanguage) => {
        set({ uiLanguage });
        if (get().profile) rpc('update_my_profile', { p_ui_language: uiLanguage }).catch(() => {});
      },
      sendOtp: async (phone) => {
        const { error } = await supabase.auth.signInWithOtp({ phone: e164(phone) });
        if (error) throw new Error(error.status === 429 ? 'too_many' : 'otp_send_failed');
      },
      verifyOtp: async (phone, code) => {
        const { error } = await supabase.auth.verifyOtp({ phone: e164(phone), token: code, type: 'sms' });
        if (error) throw new Error(/expired/i.test(error.message) ? 'otp_expired' : 'otp_wrong');
        // onAuthStateChange loads the profile.
      },
      completeProfile: async (input) => {
        const row = await rpc<ProfileRow>('complete_profile', {
          p_display_name: input.displayName,
          p_gender: input.gender,
          p_dob: input.dateOfBirth,
          p_avatar_key: input.avatarKey,
          p_languages: input.languages,
          p_ui_language: get().uiLanguage,
          p_consent_version: input.consentVersion,
        });
        set({ profile: toProfile(row) });
      },
      updateProfile: async (patch) => {
        const row = await rpc<ProfileRow>('update_my_profile', {
          p_display_name: patch.displayName ?? null,
          p_avatar_key: patch.avatarKey ?? null,
          p_languages: patch.languages ?? null,
        });
        set({ profile: toProfile(row) });
      },
      setNotification: async (key, value) => {
        set((s) => ({ notifications: { ...s.notifications, [key]: value } }));
        const arg = { calls: 'p_notify_calls', offers: 'p_notify_offers', favoritesOnline: 'p_notify_favorites' }[key];
        await rpc('update_my_profile', { [arg]: value }).catch(() => {});
      },
      signOut: async () => {
        await unregisterPush().catch(() => {});
        await supabase.auth.signOut().catch(() => {});
        set({ userId: null, phone: null, profile: null, blockedReason: null });
      },
    }),
    {
      name: 'session',
      version: 2,
      storage: persistStorage,
      // Only preferences live on the phone; the account itself always comes from the server.
      partialize: ({ uiLanguage, notifications }) => ({ uiLanguage, notifications }),
      migrate: (persisted) => {
        const { uiLanguage, notifications } = (persisted ?? {}) as Partial<SessionState>;
        return { uiLanguage, notifications } as SessionState;
      },
      onRehydrateStorage: () => () => {
        supabase.auth.getSession().then(({ data }) => loadAccount(data.session));
      },
    },
  ),
);

let loadedFor: string | null = null;

/** Loads the signed-in person's profile and the live app settings, then marks the session ready. */
async function loadAccount(session: Session | null) {
  const userId = session?.user.id ?? null;
  if (!userId) {
    loadedFor = null;
    useSession.setState({ userId: null, phone: null, profile: null, hydrated: true });
    return;
  }
  if (loadedFor === userId && useSession.getState().hydrated) return;
  loadedFor = userId;
  const [{ data: row }, { data: config }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle<ProfileRow & { status: string }>(),
    supabase.from('app_config').select('*').single<ServerConfig>(),
  ]);
  if (config) applyServerConfig(config);
  if (row && (row.role === 'admin' || row.status === 'suspended' || row.status === 'banned' || row.status === 'deleted')) {
    useSession.setState({ blockedReason: row.role === 'admin' ? 'notApp' : row.status === 'banned' ? 'banned' : 'suspended' });
    await useSession.getState().signOut();
    useSession.setState({ hydrated: true });
    return;
  }
  useSession.setState({
    userId,
    phone: session?.user.phone ?? null,
    profile: row ? toProfile(row) : null,
    notifications: row ? { calls: row.notify_calls, offers: row.notify_offers, favoritesOnline: row.notify_favorites } : useSession.getState().notifications,
    hydrated: true,
  });
  supabase.rpc('ping').then(() => {});
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
    // A new login: hold the first screen until the profile is known (avoids a flash of onboarding).
    if (event === 'SIGNED_IN' && loadedFor !== session?.user.id) useSession.setState({ hydrated: false });
    loadAccount(session);
  }
});

export function ageFromDob(dob: string, today: Date = new Date()): number {
  const [y, m, d] = dob.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}
