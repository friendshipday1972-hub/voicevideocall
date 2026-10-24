import { useHost } from '@/stores/host';
import { useSession } from '@/stores/session';
import { useSocial } from '@/stores/social';
import { useWallet } from '@/stores/wallet';

/**
 * Prototype only: all data lives on the device, so logging out clears it, letting the
 * next login start fresh (e.g. to demo the other gender's flow). With the real backend,
 * logout only clears the session and the account's data is loaded again on login.
 */
export function signOutAndReset() {
  useWallet.getState().reset();
  useSocial.getState().reset();
  useHost.getState().reset();
  useSession.getState().signOut();
}
