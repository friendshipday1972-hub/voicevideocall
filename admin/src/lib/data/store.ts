'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { generateDataset } from './seed';
import type { AppConfig, AuditEntry, Dataset, HostStatus, ReportStatus, UserStatus } from './types';

/**
 * Admin data + actions. Prototype: the dataset lives in this browser (localStorage) and every
 * action writes an audit entry. With the backend, each action becomes a server route using the
 * service role, and reads come from Supabase.
 */
type Actions = {
  setUserStatus: (id: string, status: UserStatus, reason: string) => void;
  adjustCoins: (id: string, delta: number, reason: string) => void;
  setHostStatus: (id: string, status: HostStatus, reason: string) => void;
  setFeatured: (id: string, featured: boolean) => void;
  setLevelOverride: (id: string, level: 1 | 2 | 3 | 4 | null) => void;
  addStrike: (id: string, reason: string) => void;
  clearStrikes: (id: string, reason: string) => void;
  approveApplication: (id: string, note: string) => void;
  rejectApplication: (id: string, note: string) => void;
  resolveReport: (id: string, status: ReportStatus, resolution: string, action?: 'warn' | 'strike' | 'suspend' | 'ban', refundCall?: boolean) => void;
  setReviewHidden: (callId: string, hidden: boolean, reason: string) => void;
  refundCall: (callId: string, reason: string) => void;
  refundPurchase: (id: string, reason: string) => void;
  decidePayout: (id: string, status: 'approved' | 'paid' | 'rejected', note: string) => void;
  updateConfig: (patch: Partial<AppConfig>) => void;
  resetDemo: () => void;
};

export type AdminState = Dataset & { actor: string; setActor: (email: string) => void } & Actions;

let auditSeq = 0;

export const useAdmin = create<AdminState>()(
  persist(
    (set, get) => {
      const audit = (action: string, targetType: AuditEntry['targetType'], targetId: string, detail: string) =>
        set((s) => ({ audit: [{ id: `au${Date.now()}${auditSeq++}`, at: Date.now(), actor: s.actor, action, targetType, targetId, detail }, ...s.audit].slice(0, 500) }));

      const hostName = (id: string) => get().hosts.find((h) => h.id === id)?.name ?? id;
      const userName = (id: string) => get().users.find((u) => u.id === id)?.name ?? id;

      return {
        ...generateDataset(Date.now()),
        actor: 'admin',
        setActor: (actor) => set({ actor }),

        setUserStatus: (id, status, reason) => {
          set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, status } : u)) }));
          audit(status === 'active' ? 'Reactivated caller' : status === 'deleted' ? 'Deleted caller' : `${status === 'banned' ? 'Banned' : 'Suspended'} caller`, 'user', id, `${userName(id)} · ${reason}`);
        },
        adjustCoins: (id, delta, reason) => {
          set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, coins: Math.max(0, u.coins + delta) } : u)) }));
          audit(delta >= 0 ? 'Added coins' : 'Removed coins', 'user', id, `${userName(id)} · ${delta > 0 ? '+' : ''}${delta} coins · ${reason}`);
        },
        setHostStatus: (id, status, reason) => {
          set((s) => ({ hosts: s.hosts.map((h) => (h.id === id ? { ...h, status, presence: status === 'active' ? h.presence : 'offline', featured: status === 'active' ? h.featured : false } : h)) }));
          audit(status === 'active' ? 'Reactivated host' : `${status === 'banned' ? 'Banned' : 'Suspended'} host`, 'host', id, `${hostName(id)} · ${reason}`);
        },
        setFeatured: (id, featured) => {
          set((s) => ({ hosts: s.hosts.map((h) => (h.id === id ? { ...h, featured } : h)) }));
          audit(featured ? 'Featured host in Spotlight' : 'Removed Spotlight feature', 'host', id, hostName(id));
        },
        setLevelOverride: (id, level) => {
          set((s) => ({ hosts: s.hosts.map((h) => (h.id === id ? { ...h, levelOverride: level } : h)) }));
          audit(level ? `Set level override to L${level}` : 'Cleared level override', 'host', id, hostName(id));
        },
        addStrike: (id, reason) => {
          set((s) => ({ hosts: s.hosts.map((h) => (h.id === id ? { ...h, strikes: h.strikes + 1 } : h)) }));
          audit('Added strike', 'host', id, `${hostName(id)} · ${reason}`);
        },
        clearStrikes: (id, reason) => {
          set((s) => ({ hosts: s.hosts.map((h) => (h.id === id ? { ...h, strikes: 0 } : h)) }));
          audit('Cleared strikes', 'host', id, `${hostName(id)} · ${reason}`);
        },

        approveApplication: (id, note) => {
          const app = get().applications.find((a) => a.id === id);
          if (!app || app.status !== 'pending') return;
          const now = Date.now();
          set((s) => ({
            applications: s.applications.map((a) => (a.id === id ? { ...a, status: 'approved', decisionNote: note, decidedAt: now } : a)),
            hosts: [
              ...s.hosts,
              {
                id: `h${s.hosts.length + 1}-${app.id}`,
                name: app.name,
                age: app.age,
                city: app.city,
                phone: app.phone,
                languages: app.languages,
                bio: app.bio,
                level: 1,
                levelOverride: null,
                status: 'active',
                presence: 'offline',
                featured: false,
                joinedAt: now,
                // New host: neutral starting stats; the Bayesian prior keeps her score fair until real ratings arrive.
                stats: { ratingAvg: 0, ratingCount: 0, repeatCallerRate: 0, avgCallMinutes: 0, answerRate: 1, reportRate: 0, activeDays: 0, calls30d: 0 },
                strikes: 0,
                kyc: { pan: app.pan, aadhaarLast4: app.aadhaarLast4, faceMatch: app.faceMatch },
                payout: app.payout,
                colors: ['#F472B6', '#7C3AED'],
              },
            ],
          }));
          audit('Approved host KYC', 'application', id, `${app.name} · ${note || 'All checks passed'}`);
        },
        rejectApplication: (id, note) => {
          const app = get().applications.find((a) => a.id === id);
          set((s) => ({ applications: s.applications.map((a) => (a.id === id ? { ...a, status: 'rejected', decisionNote: note, decidedAt: Date.now() } : a)) }));
          audit('Rejected host KYC', 'application', id, `${app?.name ?? id} · ${note}`);
        },

        resolveReport: (id, status, resolution, action, refundCall) => {
          const rep = get().reports.find((r) => r.id === id);
          if (!rep) return;
          set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, status, resolution, resolvedAt: status === 'open' || status === 'reviewing' ? undefined : Date.now() } : r)) }));
          const target = rep.targetRole === 'host' ? hostName(rep.targetId) : userName(rep.targetId);
          audit(`Report ${status}`, 'report', id, `${target} · ${resolution}`);
          if (action === 'strike' && rep.targetRole === 'host') get().addStrike(rep.targetId, `Report ${id}: ${resolution}`);
          if (action === 'suspend' || action === 'ban') {
            if (rep.targetRole === 'host') get().setHostStatus(rep.targetId, action === 'ban' ? 'banned' : 'suspended', `Report ${id}`);
            else get().setUserStatus(rep.targetId, action === 'ban' ? 'banned' : 'suspended', `Report ${id}`);
          }
          if (action === 'warn') audit('Sent warning', rep.targetRole, rep.targetId, `${target} · Report ${id}`);
          if (refundCall && rep.callId) get().refundCall(rep.callId, `Report ${id}`);
        },

        setReviewHidden: (callId, hidden, reason) => {
          set((s) => ({ calls: s.calls.map((c) => (c.id === callId ? { ...c, reviewHidden: hidden } : c)) }));
          audit(hidden ? 'Hid review' : 'Restored review', 'review', callId, reason);
        },
        refundCall: (callId, reason) => {
          const call = get().calls.find((c) => c.id === callId);
          if (!call || call.coins === 0) return;
          const coins = call.coins;
          set((s) => ({
            calls: s.calls.map((c) => (c.id === callId ? { ...c, refundedCoins: c.refundedCoins + coins, coins: 0, hostEarnedPaise: 0 } : c)),
            users: s.users.map((u) => (u.id === call.userId ? { ...u, coins: u.coins + coins } : u)),
          }));
          audit('Refunded call', 'call', callId, `${coins} coins to ${userName(call.userId)} · host earning clawed back · ${reason}`);
        },
        refundPurchase: (id, reason) => {
          const p = get().purchases.find((x) => x.id === id);
          if (!p || p.status === 'refunded') return;
          set((s) => ({
            purchases: s.purchases.map((x) => (x.id === id ? { ...x, status: 'refunded' } : x)),
            users: s.users.map((u) => (u.id === p.userId ? { ...u, coins: Math.max(0, u.coins - p.coins), spentPaise: Math.max(0, u.spentPaise - p.pricePaise) } : u)),
          }));
          audit('Refunded purchase', 'purchase', id, `${userName(p.userId)} · ${p.pack} · ${reason}`);
        },
        decidePayout: (id, status, note) => {
          const p = get().payouts.find((x) => x.id === id);
          set((s) => ({ payouts: s.payouts.map((x) => (x.id === id ? { ...x, status, note, decidedAt: Date.now() } : x)) }));
          audit(status === 'approved' ? 'Approved payout' : status === 'paid' ? 'Marked payout paid' : 'Rejected payout', 'payout', id, `${p ? hostName(p.hostId) : id}${note ? ` · ${note}` : ''}`);
        },
        updateConfig: (patch) => {
          set((s) => ({ config: { ...s.config, ...patch } }));
          audit('Updated app config', 'config', 'app_config', Object.entries(patch).map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join('/') : v}`).join(', '));
        },
        resetDemo: () => {
          set({ ...generateDataset(Date.now()) });
        },
      };
    },
    {
      name: 'baatein-admin',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ generatedAt, users, hosts, applications, calls, purchases, payouts, reports, audit, config }) => ({ generatedAt, users, hosts, applications, calls, purchases, payouts, reports, audit, config }),
    },
  ),
);

/** True once the browser copy of the dataset has loaded (avoids a flash of the fresh seed). */
export function useAdminHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useAdmin.persist.onFinishHydration(cb),
    () => useAdmin.persist.hasHydrated(),
    () => false,
  );
}
