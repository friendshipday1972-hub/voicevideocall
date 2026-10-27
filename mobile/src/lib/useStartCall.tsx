import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { toast } from '@/components/Toast';
import { TopUpSheet } from '@/components/TopUpSheet';
import type { CallType } from '@/config/appConfig';
import type { Host } from '@/data/catalog';
import { t } from '@/i18n';
import { usePresence } from '@/stores/hosts';
import { useSocial } from '@/stores/social';
import { useWallet } from '@/stores/wallet';

import { haptic } from './haptics';

/**
 * Client-side pre-checks before starting a call. The server repeats every check in
 * `call-start` (spec §7.2); these only give instant feedback.
 */
export function useStartCall() {
  const [topUp, setTopUp] = useState<string | null>(null);

  const start = useCallback((host: Host, type: CallType) => {
    const presence = usePresence.getState().presence[host.id] ?? host.presence;
    if (useSocial.getState().blocked.some((b) => b.id === host.id)) {
      toast.error(t('startCall.blocked', { name: host.name }));
      return;
    }
    if (presence !== 'online') {
      haptic.warning();
      toast.info(t(presence === 'busy' ? 'startCall.busy' : 'startCall.offline', { name: host.name }));
      return;
    }
    const rate = type === 'audio' ? host.audioRate : host.videoRate;
    if (useWallet.getState().balance < rate) {
      haptic.warning();
      setTopUp(t(type === 'audio' ? 'startCall.needCoinsVoice' : 'startCall.needCoinsVideo', { n: rate }));
      return;
    }
    router.push({ pathname: '/call/[hostId]', params: { hostId: host.id, type } });
  }, []);

  const sheet = <TopUpSheet visible={topUp !== null} reason={topUp ?? undefined} onClose={() => setTopUp(null)} />;

  return { start, sheet };
}
