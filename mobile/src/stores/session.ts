import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { LanguageCode } from '@/data/mock';
import { detectLanguage } from '@/i18n/detect';

import { persistStorage } from './storage';

export type Gender = 'male' | 'female' | 'other';

/** Women join as verified hosts; everyone else joins as a caller. */
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

type SessionState = {
  phone: string | null;
  uiLanguage: LanguageCode;
  profile: Profile | null;
  notifications: { calls: boolean; offers: boolean; favoritesOnline: boolean };
  hydrated: boolean;
  setUiLanguage: (code: LanguageCode) => void;
  signIn: (phone: string) => void;
  completeProfile: (profile: Profile) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setNotification: (key: keyof SessionState['notifications'], value: boolean) => void;
  signOut: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      phone: null,
      // First launch follows the phone's language when supported; the welcome screen can change it.
      uiLanguage: detectLanguage(),
      profile: null,
      notifications: { calls: true, offers: true, favoritesOnline: true },
      hydrated: false,
      setUiLanguage: (uiLanguage) => set({ uiLanguage }),
      signIn: (phone) => set({ phone }),
      completeProfile: (profile) => set({ profile }),
      updateProfile: (patch) => set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : s)),
      setNotification: (key, value) => set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
      signOut: () => set({ phone: null, profile: null }),
    }),
    {
      name: 'session',
      version: 1,
      storage: persistStorage,
      // v0 profiles had no role; derive it from gender.
      migrate: (persisted, version) => {
        const state = persisted as Partial<SessionState>;
        if (version < 1 && state.profile && !state.profile.role) state.profile = { ...state.profile, role: roleForGender(state.profile.gender) };
        return state as SessionState;
      },
      partialize: ({ hydrated: _h, ...rest }) => rest,
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);

export function ageFromDob(dob: string, today: Date = new Date()): number {
  const [y, m, d] = dob.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}
