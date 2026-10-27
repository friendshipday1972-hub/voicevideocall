import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import { toast } from '@/components/Toast';
import { hostColors, type Host, type LanguageCode, type Presence, type Review } from '@/data/catalog';
import { t } from '@/i18n';
import { computeQuality, type QualityInput } from '@/lib/quality';
import { supabase } from '@/lib/supabase';

import { useSession } from './session';
import { useSocial } from './social';

type PublicHostRow = {
  id: string;
  name: string;
  age: number | null;
  city: string;
  bio: string;
  languages: LanguageCode[];
  avatar_key: string | null;
  level: number;
  presence: Presence;
  featured: boolean;
  strikes: number;
  audio_rate: number;
  video_rate: number;
  rating_avg: number;
  rating_count: number;
  calls30d: number;
  avg_call_minutes: number;
  answer_rate: number;
  repeat_caller_rate: number;
  report_rate: number;
  active_days: number;
  total_calls: number;
};

function toHost(r: PublicHostRow): Host {
  const stats: QualityInput = {
    ratingAvg: r.rating_avg,
    ratingCount: r.rating_count,
    repeatCallerRate: r.repeat_caller_rate,
    avgCallMinutes: r.avg_call_minutes,
    answerRate: r.answer_rate,
    reportRate: r.report_rate,
    activeDays: r.active_days,
    calls30d: r.calls30d,
    strikes: r.strikes,
  };
  return {
    id: r.id,
    name: r.name,
    age: r.age ?? 0,
    city: r.city,
    bio: r.bio,
    languages: r.languages,
    rating: Math.round(r.rating_avg * 10) / 10,
    ratingCount: r.rating_count,
    totalCalls: r.total_calls,
    level: Math.min(4, Math.max(1, r.level)) as Host['level'],
    presence: r.presence,
    audioRate: r.audio_rate,
    videoRate: r.video_rate,
    colors: hostColors(r.id),
    avatarKey: r.avatar_key,
    interests: [],
    responseRate: Math.round(r.answer_rate * 100),
    stats,
    quality: computeQuality(stats),
    featured: r.featured,
  };
}

type HostsState = {
  hosts: Host[];
  loading: boolean;
  /** Loaded at least once (an empty list then means "no hosts yet", not "still loading"). */
  loaded: boolean;
  refresh: () => Promise<void>;
  /** Live presence and profile updates while a caller is signed in. Returns the unsubscribe. */
  start: () => () => void;
};

export const useHosts = create<HostsState>()((set, get) => ({
  hosts: [],
  loading: false,
  loaded: false,
  refresh: async () => {
    set({ loading: true });
    const { data } = await supabase.from('public_hosts').select('*').order('featured', { ascending: false }).order('rating_avg', { ascending: false });
    set({ hosts: (data ?? []).map((r) => toHost(r as PublicHostRow)), loading: false, loaded: true });
    usePresence.setState({ presence: Object.fromEntries(get().hosts.map((h) => [h.id, h.presence])) });
  },
  start: () => {
    get().refresh();
    let refetch: ReturnType<typeof setTimeout> | null = null;
    const channel: RealtimeChannel = supabase
      .channel('hosts-directory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hosts' }, (payload) => {
        const row = payload.new as { id?: string; presence?: Presence } | null;
        if (row?.id && row.presence) onPresence(row.id, row.presence);
        // Ratings, levels, featuring and approvals change the cards too: refetch, batched.
        if (refetch) clearTimeout(refetch);
        refetch = setTimeout(() => get().refresh(), 1500);
      })
      .subscribe();
    // Ratings and stats move slowly; a periodic refresh keeps them current without heavy traffic.
    const id = setInterval(() => get().refresh(), 60_000);
    return () => {
      clearInterval(id);
      if (refetch) clearTimeout(refetch);
      supabase.removeChannel(channel);
    };
  },
}));

/** Live presence by host id. Screens read `presence[hostId]`. */
type PresenceState = { presence: Record<string, Presence> };
export const usePresence = create<PresenceState>()(() => ({ presence: {} }));

function onPresence(hostId: string, next: Presence) {
  const current = usePresence.getState().presence[hostId];
  if (current === next) return;
  usePresence.setState((s) => ({ presence: { ...s.presence, [hostId]: next } }));
  useHosts.setState((s) => ({ hosts: s.hosts.map((h) => (h.id === hostId ? { ...h, presence: next } : h)) }));
  // "Favourite is online" alert (a push notification once Firebase is connected).
  const host = useHosts.getState().hosts.find((h) => h.id === hostId);
  if (host && next === 'online' && current !== 'online' && useSocial.getState().favorites.includes(hostId) && useSession.getState().notifications.favoritesOnline) {
    toast.info(t('profile.favOnlineToast', { name: host.name }));
  }
}

export function useHostById(id: string | undefined): Host | undefined {
  return useHosts((s) => s.hosts.find((h) => h.id === id));
}

/** Reviews on a host's profile, newest first. */
export async function fetchReviews(hostId: string, limit = 20): Promise<Review[]> {
  const { data } = await supabase.from('public_reviews').select('*').eq('host_id', hostId).order('created_at', { ascending: false }).limit(limit);
  return (data ?? []).map((r) => ({ id: r.id, author: r.author, avatarKey: r.avatar_key ?? 'sun', stars: r.stars, tags: r.tags ?? [], text: r.comment ?? '', createdAt: Date.parse(r.created_at) }));
}
