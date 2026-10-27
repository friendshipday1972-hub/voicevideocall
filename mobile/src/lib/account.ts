import { useSession } from '@/stores/session';

/**
 * Logs out. The account and its data stay on the server and load again on the next login;
 * the live stores clear themselves when the session ends (see the root layout).
 */
export function signOutAndReset() {
  return useSession.getState().signOut();
}
