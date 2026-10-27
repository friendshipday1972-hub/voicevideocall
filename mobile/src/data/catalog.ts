/**
 * Fixed catalogs the app ships with (languages, avatars, gifts, packs, report reasons) and the
 * Host shape screens use. People and their numbers come from the database.
 */
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import type { QualityInput, QualityResult } from '@/lib/quality';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const LANGUAGES = [
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'en', label: 'English', native: 'English' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export type AvatarPreset = { key: string; icon: IconName; colors: readonly [string, string] };

export const AVATARS: AvatarPreset[] = [
  { key: 'sun', icon: 'sunny', colors: ['#FBBF24', '#F97316'] },
  { key: 'moon', icon: 'moon', colors: ['#818CF8', '#4F46E5'] },
  { key: 'leaf', icon: 'leaf', colors: ['#34D399', '#059669'] },
  { key: 'flame', icon: 'flame', colors: ['#FB7185', '#E11D48'] },
  { key: 'planet', icon: 'planet', colors: ['#A78BFA', '#7C3AED'] },
  { key: 'water', icon: 'water', colors: ['#38BDF8', '#0284C7'] },
  { key: 'music', icon: 'musical-notes', colors: ['#F472B6', '#DB2777'] },
  { key: 'star', icon: 'star', colors: ['#FCD34D', '#D97706'] },
  { key: 'paw', icon: 'paw', colors: ['#FDBA74', '#EA580C'] },
  { key: 'rocket', icon: 'rocket', colors: ['#94A3B8', '#334155'] },
  { key: 'flower', icon: 'flower', colors: ['#F9A8D4', '#BE185D'] },
  { key: 'bolt', icon: 'flash', colors: ['#5EEAD4', '#0D9488'] },
];

export function avatarByKey(key: string | null | undefined): AvatarPreset {
  return AVATARS.find((a) => a.key === key) ?? AVATARS[0];
}

export type Presence = 'online' | 'busy' | 'offline';

export type Host = {
  id: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  languages: LanguageCode[];
  rating: number;
  ratingCount: number;
  totalCalls: number;
  level: 1 | 2 | 3 | 4;
  presence: Presence;
  audioRate: number;
  videoRate: number;
  colors: readonly [string, string];
  avatarKey: string | null;
  interests: string[];
  /** Share of rings she answered in the last 30 days, 0–100. */
  responseRate: number;
  /** Trailing-30-day behaviour that feeds the Spotlight Score. */
  stats: QualityInput;
  quality: QualityResult;
  /** Set by admins to boost a host in Spotlight. */
  featured: boolean;
};

export type Review = { id: string; author: string; avatarKey: string; stars: number; tags: string[]; text: string; createdAt: number };

const HOST_GRADIENTS: (readonly [string, string])[] = [
  ['#F472B6', '#7C3AED'],
  ['#FB923C', '#E11D48'],
  ['#34D399', '#0EA5E9'],
  ['#A78BFA', '#DB2777'],
  ['#FBBF24', '#F43F5E'],
  ['#2DD4BF', '#6366F1'],
  ['#F87171', '#9333EA'],
  ['#60A5FA', '#E11D48'],
  ['#FCA5A5', '#F59E0B'],
  ['#F0ABFC', '#BE123C'],
  ['#86EFAC', '#7C3AED'],
  ['#FDE68A', '#DB2777'],
];

/** A stable card gradient per host, picked from her id. */
export function hostColors(id: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return HOST_GRADIENTS[h % HOST_GRADIENTS.length];
}

export type CoinPack = { id: string; name: 'Starter' | 'Basic' | 'Plus' | 'Max'; pricePaise: number; coins: number; bonus: number; tag?: string };

export const COIN_PACKS: CoinPack[] = [
  { id: 'coins_starter', name: 'Starter', pricePaise: 3000, coins: 40, bonus: 0 },
  { id: 'coins_basic', name: 'Basic', pricePaise: 9900, coins: 140, bonus: 10, tag: 'Popular' },
  { id: 'coins_plus', name: 'Plus', pricePaise: 29900, coins: 440, bonus: 60, tag: 'Best value' },
  { id: 'coins_max', name: 'Max', pricePaise: 99900, coins: 1550, bonus: 250 },
];

export type Gift = { id: 'rose' | 'coffee' | 'heart' | 'star' | 'diamond'; name: string; coins: number; icon: IconName; color: string };

/** Virtual gifts sent during a call. The host earns `appConfig.giftShareBps` of their coin value. */
export const GIFTS: Gift[] = [
  { id: 'rose', name: 'Rose', coins: 10, icon: 'rose', color: '#E11D48' },
  { id: 'coffee', name: 'Coffee', coins: 20, icon: 'cafe', color: '#B45309' },
  { id: 'heart', name: 'Big heart', coins: 30, icon: 'heart', color: '#DB2777' },
  { id: 'star', name: 'Star', coins: 50, icon: 'star', color: '#D97706' },
  { id: 'diamond', name: 'Diamond', coins: 100, icon: 'diamond', color: '#2563EB' },
];

export const RATING_TAGS = ['Friendly', 'Good listener', 'Funny', 'Respectful', 'Great advice', 'Clear voice'];

export const REPORT_CATEGORIES = [
  { key: 'sexual_content', label: 'Sexual or explicit content' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'abuse', label: 'Abusive language' },
  { key: 'fraud', label: 'Fraud or money request' },
  { key: 'underage', label: 'Looks under 18' },
  { key: 'sharing_contacts', label: 'Asked for phone / social contact' },
  { key: 'spam', label: 'Spam' },
  { key: 'other', label: 'Something else' },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]['key'];
