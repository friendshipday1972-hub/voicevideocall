import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { CoinPack } from '@/data/catalog';
import type { LedgerEntry, LedgerReason } from '@/lib/billing';
import { supabase } from '@/lib/supabase';

type LedgerRow = { id: number; delta: number; reason: LedgerReason; idempotency_key: string; balance_after: number; ref_id: string | null; note: string | null; created_at: string };

const toEntry = (r: LedgerRow): LedgerEntry => ({
  id: String(r.id),
  delta: Number(r.delta),
  reason: r.reason,
  idempotencyKey: r.idempotency_key,
  balanceAfter: Number(r.balance_after),
  refId: r.ref_id ?? undefined,
  note: r.note ?? undefined,
  createdAt: Date.parse(r.created_at),
});

type WalletState = {
  balance: number;
  ledger: LedgerEntry[];
  refresh: () => Promise<void>;
  /** Server-reported balance (e.g. from a call tick) without waiting for the realtime event. */
  setBalance: (balance: number) => void;
  /**
   * Coin purchases need Google Play / App Store billing, which comes with the payments stage.
   * Until then this throws 'payments_coming_soon' and the sheet explains it.
   */
  purchase: (pack: CoinPack) => Promise<void>;
  /** Live wallet updates for the signed-in caller. Returns the unsubscribe. */
  start: (userId: string) => () => void;
  reset: () => void;
};

export const useWallet = create<WalletState>()((set, get) => ({
  balance: 0,
  ledger: [],
  refresh: async () => {
    const [{ data: wallet }, { data: rows }] = await Promise.all([
      supabase.from('wallets').select('coin_balance').maybeSingle(),
      supabase.from('coin_ledger').select('*').order('id', { ascending: false }).limit(100),
    ]);
    set({ balance: Number(wallet?.coin_balance ?? 0), ledger: (rows ?? []).map((r) => toEntry(r as LedgerRow)) });
  },
  setBalance: (balance) => set({ balance }),
  purchase: async () => {
    throw new Error('payments_coming_soon');
  },
  start: (userId) => {
    get().refresh();
    const channel: RealtimeChannel = supabase
      .channel(`wallet-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, (payload) => {
        const row = payload.new as { coin_balance?: number };
        if (row?.coin_balance !== undefined) set({ balance: Number(row.coin_balance) });
        // The ledger line arrives in the same transaction; reload the history quietly.
        get().refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
  reset: () => set({ balance: 0, ledger: [] }),
}));
