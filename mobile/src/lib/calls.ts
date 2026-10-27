import type { RealtimeChannel } from '@supabase/supabase-js';

import type { CallType } from '@/config/appConfig';
import type { Translate } from '@/i18n/labels';

import type { CallEndReason } from './billing';
import { supabase } from './supabase';

export type CallState = 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | 'cancelled';

/** A call as both apps see it (from the `my_calls` view plus live row updates). */
export type LiveCall = {
  id: string;
  callerId: string;
  hostId: string;
  type: CallType;
  state: CallState;
  language: string | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  rate: number;
  coinValuePaise: number;
  hostShareBps: number;
  billedMinutes: number;
  coinsCharged: number;
  refundedCoins: number;
  giftCoins: number;
  hostEarnedPaise: number;
  endReason: CallEndReason | null;
  agoraChannel: string;
  callerName: string;
  callerAvatar: string | null;
  callerLanguages: string[];
  hostName: string;
  hostAvatar: string | null;
};

type Row = Record<string, unknown>;

const ms = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : null);

function apply(base: LiveCall | null, r: Row): LiveCall {
  const prev = base ?? ({} as LiveCall);
  return {
    ...prev,
    id: (r.id as string) ?? prev.id,
    callerId: (r.caller_id as string) ?? prev.callerId,
    hostId: (r.host_id as string) ?? prev.hostId,
    type: (r.type as CallType) ?? prev.type,
    state: (r.state as CallState) ?? prev.state,
    language: (r.language as string | null) ?? prev.language ?? null,
    createdAt: ms(r.created_at) ?? prev.createdAt,
    startedAt: 'started_at' in r ? ms(r.started_at) : prev.startedAt,
    endedAt: 'ended_at' in r ? ms(r.ended_at) : prev.endedAt,
    rate: Number(r.rate_coins_per_min ?? prev.rate),
    coinValuePaise: Number(r.coin_value_paise ?? prev.coinValuePaise),
    hostShareBps: Number(r.host_share_bps ?? prev.hostShareBps),
    billedMinutes: Number(r.billed_minutes ?? prev.billedMinutes ?? 0),
    coinsCharged: Number(r.coins_charged ?? prev.coinsCharged ?? 0),
    refundedCoins: Number(r.refunded_coins ?? prev.refundedCoins ?? 0),
    giftCoins: Number(r.gift_coins ?? prev.giftCoins ?? 0),
    hostEarnedPaise: Number(r.host_earned_paise ?? prev.hostEarnedPaise ?? 0),
    endReason: ('end_reason' in r ? (r.end_reason as CallEndReason | null) : prev.endReason) ?? null,
    agoraChannel: (r.agora_channel as string) ?? prev.agoraChannel,
    callerName: (r.caller_name as string) ?? prev.callerName ?? '',
    callerAvatar: (r.caller_avatar as string | null) ?? prev.callerAvatar ?? null,
    callerLanguages: (r.caller_languages as string[]) ?? prev.callerLanguages ?? [],
    hostName: (r.host_name as string) ?? prev.hostName ?? '',
    hostAvatar: (r.host_avatar as string | null) ?? prev.hostAvatar ?? null,
  };
}

export async function fetchCall(id: string): Promise<LiveCall | null> {
  const { data } = await supabase.from('my_calls').select('*').eq('id', id).maybeSingle();
  return data ? apply(null, data as Row) : null;
}

/** Follows one call live (accepted, ended, billing counters). Returns the unsubscribe. */
export function watchCall(id: string, onChange: (update: (prev: LiveCall | null) => LiveCall) => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`call-${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `id=eq.${id}` }, (payload) => {
      onChange((prev) => apply(prev, payload.new as Row));
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Gifts arriving during a call (host side). Returns the unsubscribe. */
export function watchGifts(sessionId: string, onGift: (gift: { giftId: string; coins: number; hostEarnedPaise: number }) => void): () => void {
  const channel = supabase
    .channel(`gifts-${sessionId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gift_events', filter: `session_id=eq.${sessionId}` }, (payload) => {
      const g = payload.new as { gift_id: string; coins: number; host_earned_paise: number };
      onGift({ giftId: g.gift_id, coins: g.coins, hostEarnedPaise: Number(g.host_earned_paise) });
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** New rings for a host. Returns the unsubscribe. */
export function watchIncoming(hostId: string, onRing: (sessionId: string) => void): () => void {
  const channel = supabase
    .channel(`incoming-${hostId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_sessions', filter: `host_id=eq.${hostId}` }, (payload) => {
      const row = payload.new as { id: string; state: string };
      if (row.state === 'ringing') onRing(row.id);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** A ringing call for this host, if any (e.g. when the app comes back to the foreground). */
export async function findRinging(hostId: string): Promise<string | null> {
  const { data } = await supabase.from('call_sessions').select('id').eq('host_id', hostId).eq('state', 'ringing').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
}

/** Server error code → message for the person (falls back to a generic "try again"). */
export function callErrorText(t: Translate, code: string, hostName = ''): string {
  switch (code) {
    case 'insufficient_coins':
    case 'caller_no_coins':
      return t('call.noCoinsToStart');
    case 'host_busy':
      return t('startCall.busy', { name: hostName });
    case 'host_offline':
    case 'host_unavailable':
      return t('startCall.offline', { name: hostName });
    case 'blocked':
      return t('startCall.blocked', { name: hostName });
    case 'already_in_call':
      return t('errors.alreadyInCall');
    case 'call_over':
      return t('errors.callOver');
    case 'network':
      return t('errors.network');
    default:
      return t('errors.generic');
  }
}
