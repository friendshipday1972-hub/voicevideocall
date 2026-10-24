import { create } from 'zustand';

import { toast } from '@/components/Toast';
import { HOSTS, type Presence } from '@/data/mock';
import { t } from '@/i18n';

import { useSession } from './session';
import { useSocial } from './social';

/**
 * Simulated realtime presence. Replaced by a Supabase Realtime channel later;
 * screens only read `presence[hostId]`, so nothing else changes.
 */
type PresenceState = {
  presence: Record<string, Presence>;
  set: (hostId: string, p: Presence) => void;
  start: () => () => void;
};

const initial = Object.fromEntries(HOSTS.map((h) => [h.id, h.presence])) as Record<string, Presence>;

export const usePresence = create<PresenceState>()((set, get) => ({
  presence: initial,
  set: (hostId, p) => set((s) => ({ presence: { ...s.presence, [hostId]: p } })),
  start: () => {
    const id = setInterval(() => {
      const host = HOSTS[Math.floor(Math.random() * HOSTS.length)];
      const current = get().presence[host.id];
      const next: Presence = current === 'busy' ? 'online' : current === 'offline' ? 'online' : Math.random() < 0.6 ? 'busy' : 'offline';
      get().set(host.id, next);
      // "Favourite is online" alert (a push notification with the real backend).
      if (next === 'online' && current !== 'online' && useSocial.getState().favorites.includes(host.id) && useSession.getState().notifications.favoritesOnline) {
        toast.info(t('profile.favOnlineToast', { name: host.name }));
      }
    }, 6000);
    return () => clearInterval(id);
  },
}));
