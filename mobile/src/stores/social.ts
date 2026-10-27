import { create } from 'zustand';

import type { CallType } from '@/config/appConfig';
import type { ReportCategory } from '@/data/catalog';
import type { CallEndReason } from '@/lib/billing';
import { rpc, supabase } from '@/lib/supabase';

export type CallRecord = {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatar: string | null;
  type: CallType;
  startedAt: number;
  durationSec: number;
  coinsCharged: number;
  refundedCoins: number;
  endReason: CallEndReason;
  rating?: number;
  tags?: string[];
  comment?: string;
  giftCoins?: number;
};

export type BlockedPerson = { id: string; name: string; avatarKey: string | null; role: 'user' | 'host' };

/** Row of the `my_calls` view (a call I took part in, with the other side's public details). */
export type MyCallRow = {
  id: string;
  caller_id: string;
  host_id: string;
  type: CallType;
  state: string;
  language: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  coins_charged: number;
  refunded_coins: number;
  gift_coins: number;
  host_earned_paise: number;
  end_reason: CallEndReason | null;
  caller_name: string;
  caller_avatar: string | null;
  caller_languages: string[];
  host_name: string;
  host_avatar: string | null;
  rating: number | null;
  rating_tags: string[] | null;
  rating_comment: string | null;
};

export const callDuration = (r: Pick<MyCallRow, 'started_at' | 'ended_at'>) =>
  r.started_at && r.ended_at ? Math.max(0, Math.round((Date.parse(r.ended_at) - Date.parse(r.started_at)) / 1000)) : 0;

const toRecord = (r: MyCallRow): CallRecord => ({
  id: r.id,
  hostId: r.host_id,
  hostName: r.host_name,
  hostAvatar: r.host_avatar,
  type: r.type,
  startedAt: Date.parse(r.started_at ?? r.created_at),
  durationSec: callDuration(r),
  coinsCharged: r.coins_charged - r.refunded_coins,
  refundedCoins: r.refunded_coins,
  endReason: r.end_reason ?? 'caller_hangup',
  rating: r.rating ?? undefined,
  tags: r.rating_tags ?? undefined,
  comment: r.rating_comment ?? undefined,
  giftCoins: r.gift_coins,
});

type SocialState = {
  calls: CallRecord[];
  favorites: string[];
  blocked: BlockedPerson[];
  refresh: () => Promise<void>;
  refreshCalls: () => Promise<void>;
  rateCall: (id: string, rating: number, tags: string[], comment?: string) => Promise<void>;
  toggleFavorite: (hostId: string) => Promise<void>;
  block: (id: string) => Promise<void>;
  unblock: (id: string) => Promise<void>;
  /** Files a report (and optionally blocks). The admin team sees it in the Reports queue. */
  report: (r: { targetId: string; sessionId?: string; category: ReportCategory; details: string; block: boolean }) => Promise<void>;
  reset: () => void;
};

export const useSocial = create<SocialState>()((set, get) => ({
  calls: [],
  favorites: [],
  blocked: [],
  refresh: async () => {
    const [{ data: favs }, { data: blocks }] = await Promise.all([supabase.from('favorites').select('host_id'), supabase.from('my_blocks').select('*').order('created_at', { ascending: false })]);
    set({
      favorites: (favs ?? []).map((f) => f.host_id),
      blocked: (blocks ?? []).map((b) => ({ id: b.id, name: b.name, avatarKey: b.avatar_key, role: b.role })),
    });
    await get().refreshCalls();
  },
  refreshCalls: async () => {
    const { data } = await supabase.from('my_calls').select('*').not('started_at', 'is', null).order('created_at', { ascending: false }).limit(100);
    set({ calls: (data ?? []).map((r) => toRecord(r as MyCallRow)) });
  },
  rateCall: async (id, rating, tags, comment) => {
    await rpc('rate_call', { p_session: id, p_stars: rating, p_tags: tags, p_comment: comment?.trim() ?? '' });
    set((s) => ({ calls: s.calls.map((c) => (c.id === id ? { ...c, rating, tags, comment: comment?.trim() || undefined } : c)) }));
  },
  toggleFavorite: async (hostId) => {
    const on = get().favorites.includes(hostId);
    set((s) => ({ favorites: on ? s.favorites.filter((f) => f !== hostId) : [hostId, ...s.favorites] }));
    const { data: auth } = await supabase.auth.getUser();
    const { error } = on
      ? await supabase.from('favorites').delete().eq('host_id', hostId)
      : await supabase.from('favorites').insert({ user_id: auth.user?.id, host_id: hostId });
    if (error) {
      set((s) => ({ favorites: on ? [hostId, ...s.favorites] : s.favorites.filter((f) => f !== hostId) }));
      throw new Error('network');
    }
  },
  block: async (id) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('blocks').insert({ blocker_id: auth.user?.id, blocked_id: id });
    if (error && error.code !== '23505') throw new Error('network');
    if (get().favorites.includes(id)) await supabase.from('favorites').delete().eq('host_id', id);
    await get().refresh();
  },
  unblock: async (id) => {
    set((s) => ({ blocked: s.blocked.filter((b) => b.id !== id) }));
    await supabase.from('blocks').delete().eq('blocked_id', id);
  },
  report: async ({ targetId, sessionId, category, details, block }) => {
    await rpc('report_user', { p_target: targetId, p_session: sessionId ?? null, p_category: category, p_details: details, p_block: block });
    if (block) await get().refresh();
  },
  reset: () => set({ calls: [], favorites: [], blocked: [] }),
}));

/** Ids of everyone I blocked (for filtering lists). */
export function useBlockedIds(): string[] {
  return useSocial((s) => s.blocked).map((b) => b.id);
}
