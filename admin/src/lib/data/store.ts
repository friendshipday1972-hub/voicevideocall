'use client';

import { create } from 'zustand';

import { toast } from '@/components/ui';
import { getLang, translate, type TKey } from '@/i18n';
import { rpc, supabase } from '@/lib/supabase';

import { EMPTY_DATASET, loadDataset } from './load';
import type { AppConfig, Dataset, HostStatus, ReportDecision, UserStatus } from './types';

/**
 * Live admin data. Loaded from the database, refreshed automatically whenever a table the
 * dashboard shows changes (Supabase Realtime), and every action runs an admin_* database
 * function that checks the admin role, makes the change atomically and writes the audit log.
 * Actions resolve when the change is saved; on failure they show an error and reject.
 */
type Actions = {
  setUserStatus: (id: string, status: UserStatus, reason: string) => Promise<void>;
  adjustCoins: (id: string, delta: number, reason: string) => Promise<void>;
  setHostStatus: (id: string, status: HostStatus, reason: string) => Promise<void>;
  setFeatured: (id: string, featured: boolean) => Promise<void>;
  setLevelOverride: (id: string, level: 1 | 2 | 3 | 4 | null) => Promise<void>;
  addStrike: (id: string, reason: string) => Promise<void>;
  clearStrikes: (id: string, reason: string) => Promise<void>;
  approveApplication: (id: string, note: string) => Promise<void>;
  rejectApplication: (id: string, note: string) => Promise<void>;
  resolveReport: (id: string, decision: ReportDecision, note: string, refundCall?: boolean) => Promise<void>;
  setReviewHidden: (callId: string, hidden: boolean, reason: string) => Promise<void>;
  refundCall: (callId: string, reason: string) => Promise<void>;
  refundPurchase: (id: string, reason: string) => Promise<void>;
  decidePayout: (id: string, status: 'approved' | 'paid' | 'rejected', note: string) => Promise<void>;
  updateConfig: (patch: Partial<AppConfig>) => Promise<void>;
};

export type AdminState = Dataset & {
  actor: string;
  /** The first load finished (pages show a skeleton until then). */
  loaded: boolean;
  loadError: boolean;
  setActor: (email: string) => void;
  reload: () => Promise<void>;
  /** Loads the data and keeps it live. Returns the unsubscribe. */
  start: () => () => void;
} & Actions;

const ERRORS: Record<string, TKey> = {
  not_admin: 'errors.notAdmin',
  insufficient_coins: 'errors.insufficientCoins',
  nothing_to_refund: 'errors.nothingToRefund',
  not_pending: 'errors.alreadyDecided',
  not_open: 'errors.alreadyDecided',
  invalid_transition: 'errors.alreadyDecided',
};

export const useAdmin = create<AdminState>()((set, get) => {
  /** Runs one admin function, then refreshes so every page shows the result. */
  const run = async (fn: string, args: Record<string, unknown>) => {
    try {
      await rpc(fn, args);
    } catch (e) {
      toast.bad(translate(getLang(), ERRORS[(e as Error).message] ?? 'errors.generic'));
      throw e;
    }
    await get().reload();
  };

  return {
    ...EMPTY_DATASET,
    actor: '',
    loaded: false,
    loadError: false,
    setActor: (actor) => set({ actor }),
    reload: async () => {
      try {
        const data = await loadDataset();
        set({ ...data, loaded: true, loadError: false });
      } catch {
        set({ loaded: true, loadError: true });
      }
    },
    start: () => {
      get().reload();
      let timer: ReturnType<typeof setTimeout> | null = null;
      const later = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => get().reload(), 1200);
      };
      let channel = supabase.channel('admin-live');
      for (const table of ['profiles', 'hosts', 'call_sessions', 'ratings', 'reports', 'payout_requests', 'purchases', 'wallets', 'audit_log', 'app_config']) {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, later);
      }
      channel.subscribe();
      // Durations of live calls and "x min ago" labels move on their own.
      const tick = setInterval(() => get().reload(), 60_000);
      return () => {
        if (timer) clearTimeout(timer);
        clearInterval(tick);
        supabase.removeChannel(channel);
      };
    },

    setUserStatus: (id, status, reason) => run('admin_set_user_status', { p_user: id, p_status: status, p_reason: reason }),
    adjustCoins: (id, delta, reason) => run('admin_adjust_coins', { p_user: id, p_delta: delta, p_reason: reason }),
    setHostStatus: (id, status, reason) => run('admin_set_host_status', { p_host: id, p_status: status, p_reason: reason }),
    setFeatured: (id, featured) => run('admin_set_featured', { p_host: id, p_featured: featured }),
    setLevelOverride: (id, level) => run('admin_set_level_override', { p_host: id, p_level: level }),
    addStrike: (id, reason) => run('admin_add_strike', { p_host: id, p_reason: reason }),
    clearStrikes: (id, reason) => run('admin_clear_strikes', { p_host: id, p_reason: reason }),
    approveApplication: (id, note) => run('admin_decide_application', { p_host: id, p_approve: true, p_note: note }),
    rejectApplication: (id, note) => run('admin_decide_application', { p_host: id, p_approve: false, p_note: note }),
    resolveReport: (id, decision, note, refundCall) => run('admin_resolve_report', { p_report: id, p_decision: decision, p_note: note, p_refund: !!refundCall }),
    setReviewHidden: (callId, hidden, reason) => run('admin_set_review_hidden', { p_session: callId, p_hidden: hidden, p_reason: reason }),
    refundCall: (callId, reason) => run('admin_refund_call', { p_session: callId, p_reason: reason }),
    refundPurchase: (id, reason) => run('admin_refund_purchase', { p_purchase: id, p_reason: reason }),
    decidePayout: (id, status, note) => run('admin_decide_payout', { p_payout: id, p_status: status, p_note: note }),
    updateConfig: (patch) => run('admin_update_config', { p_patch: patch }),
  };
});

/** True once the first load from the database has finished. */
export function useAdminHydrated(): boolean {
  return useAdmin((s) => s.loaded);
}
