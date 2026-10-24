import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CoinPack } from '@/data/mock';
import { applyLedger, type Wallet } from '@/lib/billing';

import { persistStorage } from './storage';

type WalletState = Wallet & {
  /** Simulated Play/Apple purchase. In production the server verifies the token first. */
  purchase: (pack: CoinPack) => Promise<void>;
  /** Replace the wallet with the result of a billing operation. */
  commit: (wallet: Wallet) => void;
  reset: () => void;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      balance: 0,
      ledger: [],
      purchase: async (pack) => {
        await wait(900);
        const token = `demo-${Date.now()}`;
        const res = applyLedger(get(), {
          delta: pack.coins + pack.bonus,
          reason: 'purchase',
          idempotencyKey: `purchase:${token}`,
          refId: pack.id,
          note: `${pack.name} pack`,
        });
        set({ balance: res.wallet.balance, ledger: res.wallet.ledger });
      },
      commit: (wallet) => set({ balance: wallet.balance, ledger: wallet.ledger }),
      reset: () => set({ balance: 0, ledger: [] }),
    }),
    { name: 'wallet', storage: persistStorage, partialize: ({ balance, ledger }) => ({ balance, ledger }) },
  ),
);
