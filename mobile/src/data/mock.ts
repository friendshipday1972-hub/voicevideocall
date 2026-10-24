/**
 * Sample data for the prototype stage. Replaced by Supabase queries once the
 * real backend is connected.
 */
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import { computeQuality, type QualityInput, type QualityResult } from '@/lib/quality';

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
  interests: string[];
  responseRate: number;
  /** Trailing-30-day behaviour that feeds the Spotlight Score. */
  stats: QualityInput;
  quality: QualityResult;
  /** Set by admins to boost a host in Spotlight. */
  featured: boolean;
  reviews: Review[];
};

export type Review = { id: string; author: string; avatarKey: string; stars: number; tags: string[]; text: string; daysAgo: number };

const hostSeed: Omit<Host, 'audioRate' | 'videoRate' | 'stats' | 'quality' | 'featured' | 'reviews'>[] = [
  { id: 'h1', name: 'Ananya', age: 24, city: 'Hyderabad', bio: 'Movie buff and chai lover. Let’s talk about anything from Tollywood to travel.', languages: ['te', 'hi', 'en'], rating: 4.8, ratingCount: 1240, totalCalls: 3120, level: 4, presence: 'online', colors: ['#F472B6', '#7C3AED'], interests: ['Movies', 'Travel', 'Music'], responseRate: 96 },
  { id: 'h2', name: 'Priya', age: 26, city: 'Chennai', bio: 'Carnatic music student. Good listener, better storyteller.', languages: ['ta', 'en'], rating: 4.7, ratingCount: 860, totalCalls: 2050, level: 3, presence: 'online', colors: ['#FB923C', '#E11D48'], interests: ['Music', 'Books'], responseRate: 92 },
  { id: 'h3', name: 'Kavya', age: 23, city: 'Bengaluru', bio: 'Techie by day, foodie by night. Ask me for the best dosa spots!', languages: ['kn', 'en', 'hi'], rating: 4.6, ratingCount: 540, totalCalls: 1320, level: 3, presence: 'busy', colors: ['#34D399', '#0EA5E9'], interests: ['Food', 'Tech'], responseRate: 89 },
  { id: 'h4', name: 'Meera', age: 27, city: 'Kochi', bio: 'Yoga, poetry and long conversations about life.', languages: ['ml', 'en'], rating: 4.9, ratingCount: 1530, totalCalls: 4210, level: 4, presence: 'online', colors: ['#A78BFA', '#DB2777'], interests: ['Yoga', 'Poetry'], responseRate: 98 },
  { id: 'h5', name: 'Riya', age: 22, city: 'Delhi', bio: 'Cricket fan, Bollywood singer in the shower. Let’s laugh a little.', languages: ['hi', 'en'], rating: 4.5, ratingCount: 310, totalCalls: 720, level: 2, presence: 'online', colors: ['#FBBF24', '#F43F5E'], interests: ['Cricket', 'Bollywood'], responseRate: 87 },
  { id: 'h6', name: 'Sneha', age: 25, city: 'Pune', bio: 'Marathi theatre and weekend treks. Always up for a chat.', languages: ['mr', 'hi', 'en'], rating: 4.4, ratingCount: 190, totalCalls: 410, level: 2, presence: 'offline', colors: ['#2DD4BF', '#6366F1'], interests: ['Theatre', 'Trekking'], responseRate: 84 },
  { id: 'h7', name: 'Ishita', age: 24, city: 'Kolkata', bio: 'Rabindra sangeet, adda and mishti doi. Come say hello!', languages: ['bn', 'hi', 'en'], rating: 4.7, ratingCount: 670, totalCalls: 1610, level: 3, presence: 'online', colors: ['#F87171', '#9333EA'], interests: ['Music', 'Food'], responseRate: 93 },
  { id: 'h8', name: 'Divya', age: 28, city: 'Vijayawada', bio: 'Teacher who loves to listen. Telugu or Hindi, your choice.', languages: ['te', 'hi'], rating: 4.6, ratingCount: 420, totalCalls: 980, level: 2, presence: 'busy', colors: ['#60A5FA', '#E11D48'], interests: ['Teaching', 'Cooking'], responseRate: 90 },
  { id: 'h9', name: 'Lakshmi', age: 26, city: 'Madurai', bio: 'Temple town girl, big city dreams. Let’s talk career and life.', languages: ['ta', 'te'], rating: 4.3, ratingCount: 88, totalCalls: 150, level: 1, presence: 'online', colors: ['#FCA5A5', '#F59E0B'], interests: ['Careers', 'Dance'], responseRate: 81 },
  { id: 'h10', name: 'Neha', age: 23, city: 'Mumbai', bio: 'Fashion student and dog mom. Talk to me about style and pets.', languages: ['hi', 'mr', 'en'], rating: 4.8, ratingCount: 990, totalCalls: 2600, level: 4, presence: 'online', colors: ['#F0ABFC', '#BE123C'], interests: ['Fashion', 'Pets'], responseRate: 95 },
  { id: 'h11', name: 'Aishwarya', age: 25, city: 'Mysuru', bio: 'Classical dancer. Calm vibes only.', languages: ['kn', 'te'], rating: 4.5, ratingCount: 260, totalCalls: 600, level: 2, presence: 'offline', colors: ['#86EFAC', '#7C3AED'], interests: ['Dance', 'Art'], responseRate: 86 },
  { id: 'h12', name: 'Anjali', age: 24, city: 'Thrissur', bio: 'Football and filter coffee. Malayalam or English.', languages: ['ml', 'ta', 'en'], rating: 4.2, ratingCount: 64, totalCalls: 120, level: 1, presence: 'online', colors: ['#FDE68A', '#DB2777'], interests: ['Football', 'Coffee'], responseRate: 79 },
];

// [repeatCallerRate, avgCallMinutes, answerRate, reportRate, activeDays, calls30d]
const STATS: Record<string, [number, number, number, number, number, number]> = {
  h1: [0.41, 12.5, 0.96, 0.001, 26, 420],
  h2: [0.33, 10, 0.92, 0.002, 22, 260],
  h3: [0.28, 9, 0.89, 0.003, 18, 180],
  h4: [0.45, 14, 0.98, 0.0005, 27, 480],
  h5: [0.25, 8, 0.87, 0.004, 16, 120],
  h6: [0.2, 7, 0.84, 0.018, 10, 70],
  h7: [0.35, 11, 0.93, 0.002, 21, 230],
  h8: [0.3, 10, 0.9, 0.003, 19, 160],
  h9: [0.38, 11, 0.9, 0.001, 14, 38],
  h10: [0.4, 12, 0.95, 0.001, 25, 380],
  h11: [0.22, 7.5, 0.86, 0.005, 12, 90],
  h12: [0.36, 10.5, 0.88, 0, 15, 30],
};

const REVIEW_POOL: Omit<Review, 'id' | 'daysAgo'>[] = [
  { author: 'Rahul', avatarKey: 'moon', stars: 5, tags: ['Friendly', 'Good listener'], text: 'Felt like talking to an old friend. Made my evening.' },
  { author: 'Arjun', avatarKey: 'rocket', stars: 5, tags: ['Great advice'], text: 'Gave me really practical advice about my job switch. Thank you!' },
  { author: 'Sai', avatarKey: 'leaf', stars: 4, tags: ['Respectful', 'Clear voice'], text: 'Very polite and easy to talk to.' },
  { author: 'Karthik', avatarKey: 'flame', stars: 5, tags: ['Funny'], text: 'Laughed the whole call. Calling again tomorrow.' },
  { author: 'Vikram', avatarKey: 'planet', stars: 4, tags: ['Good listener'], text: 'Patient and kind. Helped me relax after a long day.' },
  { author: 'Aman', avatarKey: 'water', stars: 5, tags: ['Friendly', 'Respectful'], text: 'Remembered what we spoke about last time. Loved that.' },
  { author: 'Rohit', avatarKey: 'bolt', stars: 3, tags: ['Clear voice'], text: 'Nice chat, but the call felt a bit short.' },
];

function reviewsFor(index: number): Review[] {
  return [0, 1, 2].map((k) => {
    const r = REVIEW_POOL[(index * 2 + k * 3) % REVIEW_POOL.length];
    return { ...r, id: `rv${index}-${k}`, daysAgo: 1 + k * 3 + (index % 3) };
  });
}

export const HOSTS: Host[] = hostSeed.map((h, i) => {
  const [repeatCallerRate, avgCallMinutes, answerRate, reportRate, activeDays, calls30d] = STATS[h.id];
  const stats: QualityInput = { ratingAvg: h.rating, ratingCount: h.ratingCount, repeatCallerRate, avgCallMinutes, answerRate, reportRate, activeDays, calls30d, strikes: 0 };
  return { ...h, audioRate: 6, videoRate: 10, stats, quality: computeQuality(stats), featured: h.id === 'h7', reviews: reviewsFor(i) };
});

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
