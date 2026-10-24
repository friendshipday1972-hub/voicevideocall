import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CallType } from '@/config/appConfig';
import type { ReportCategory } from '@/data/mock';
import type { CallEndReason } from '@/lib/billing';

import { persistStorage } from './storage';

export type CallRecord = {
  id: string;
  hostId: string;
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

export type Report = { id: string; targetId: string; sessionId?: string; category: ReportCategory; details: string; createdAt: number };

type SocialState = {
  calls: CallRecord[];
  favorites: string[];
  blocked: string[];
  reports: Report[];
  addCall: (call: CallRecord) => void;
  rateCall: (id: string, rating: number, tags: string[], comment?: string) => void;
  toggleFavorite: (hostId: string) => void;
  block: (id: string) => void;
  unblock: (id: string) => void;
  report: (r: Omit<Report, 'id' | 'createdAt'>) => void;
  reset: () => void;
};

export const useSocial = create<SocialState>()(
  persist(
    (set) => ({
      calls: [],
      favorites: [],
      blocked: [],
      reports: [],
      addCall: (call) => set((s) => ({ calls: [call, ...s.calls] })),
      rateCall: (id, rating, tags, comment) => set((s) => ({ calls: s.calls.map((c) => (c.id === id ? { ...c, rating, tags, comment: comment?.trim() || undefined } : c)) })),
      toggleFavorite: (hostId) =>
        set((s) => ({
          favorites: s.favorites.includes(hostId) ? s.favorites.filter((f) => f !== hostId) : [hostId, ...s.favorites],
        })),
      block: (id) => set((s) => ({ blocked: s.blocked.includes(id) ? s.blocked : [id, ...s.blocked], favorites: s.favorites.filter((f) => f !== id) })),
      unblock: (id) => set((s) => ({ blocked: s.blocked.filter((b) => b !== id) })),
      report: (r) => set((s) => ({ reports: [{ ...r, id: `r${Date.now()}`, createdAt: Date.now() }, ...s.reports] })),
      reset: () => set({ calls: [], favorites: [], blocked: [], reports: [] }),
    }),
    { name: 'social', storage: persistStorage },
  ),
);
